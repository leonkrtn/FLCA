import "server-only";
import { einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { melden, verlauf } from "../ereignisse";
import { datum, euro } from "../format";
import { mail } from "../email/vorlagen";
import { mailer } from "../services/email";
import { pushSenden } from "../services/push";
import { db, pruefe } from "../supabase/admin";
import { berlinDatum, plusTage } from "../zeit";
import { berechne, type Position } from "./berechnung";
import { rechnungPdf } from "./pdf";
import { entwurfAnlegen, einzigerEntwurf, type Empfaenger, type Rechnung, rechnungZumTermin } from "./rechnungen";
import { auftragAusKv } from "../auftrag";
import { positionenAusLeistungen } from "../auftrag-regeln";
import { alsBelegFahrzeug, alsEmpfaenger, kundeAusBeleg, kundeLaden } from "../kunden";

export type Kostenvoranschlag = {
  id: string;
  nummer: string | null;
  status: "entwurf" | "offen" | "angenommen" | "abgelehnt";
  termin_id: string | null;
  kunde_id: string | null;
  empfaenger: Empfaenger;
  fahrzeug: Rechnung["fahrzeug"];
  positionen: Position[];
  datum: string | null;
  gueltig_bis: string | null;
  hinweis: string;
  summe_netto_cent: number;
  summe_mwst_cent: number;
  summe_brutto_cent: number;
  firma: Rechnung["firma"];
  token: string;
  gesendet_am: string | null;
  gesendet_an: string | null;
  beantwortet_am: string | null;
  rechnung_id: string | null;
  erstellt_am: string;
  abgeschlossen_am: string | null;
  kunde?: { nummer: number } | null;
};

export const KV_STATUS: Record<Kostenvoranschlag["status"], string> = {
  entwurf: "Entwurf",
  offen: "Offen",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
};

/** „Abgelaufen“ ist kein gespeicherter Status: Ein offener Kostenvoranschlag läuft mit seinem Datum ab. */
export function kvAbgelaufen(k: Pick<Kostenvoranschlag, "status" | "gueltig_bis">, heute = berlinDatum()): boolean {
  return k.status === "offen" && Boolean(k.gueltig_bis && k.gueltig_bis < heute);
}

export function kvStatusText(k: Pick<Kostenvoranschlag, "status" | "gueltig_bis">): string {
  return kvAbgelaufen(k) ? "Abgelaufen" : KV_STATUS[k.status];
}

/** Farbe der Statusmarke (Marke in components/admin/ui). */
export function kvTon(k: Pick<Kostenvoranschlag, "status" | "gueltig_bis">): "ok" | "warnung" | "hell" {
  if (kvAbgelaufen(k)) return "hell";
  return k.status === "angenommen" ? "ok" : k.status === "offen" ? "warnung" : "hell";
}

export async function kvLaden(id: string): Promise<Kostenvoranschlag | null> {
  const { data } = await db().from("kostenvoranschlaege").select("*, kunde:kunden(nummer)").eq("id", id).maybeSingle();
  return data as Kostenvoranschlag | null;
}

export async function kvPerToken(token: string): Promise<Kostenvoranschlag | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await db().from("kostenvoranschlaege").select("*, kunde:kunden(nummer)").eq("token", token).neq("status", "entwurf").maybeSingle();
  return data as Kostenvoranschlag | null;
}

type Inhalt = Pick<Kostenvoranschlag, "empfaenger" | "fahrzeug" | "positionen" | "hinweis"> & { kunde_id?: string | null; termin_id?: string | null; gueltig_bis?: string | null };

const summenFelder = (positionen: Position[]) => {
  const s = berechne(positionen);
  return { summe_netto_cent: s.netto, summe_mwst_cent: s.steuer, summe_brutto_cent: s.brutto };
};

export async function kvAnlegen(k: Partial<Inhalt>, vonBenutzer: string): Promise<string> {
  const neu = pruefe(
    await db()
      .from("kostenvoranschlaege")
      .insert({ ...k, ...summenFelder(k.positionen ?? []), erstellt_von: vonBenutzer })
      .select("id")
      .single(),
  );
  await verlauf("kostenvoranschlag", neu.id, "Entwurf angelegt", vonBenutzer);
  return neu.id;
}

export async function kvSpeichern(id: string, k: Inhalt): Promise<void> {
  const { data, error } = await db()
    .from("kostenvoranschlaege")
    .update({ ...k, ...summenFelder(k.positionen) })
    .eq("id", id)
    .eq("status", "entwurf")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Nur Entwürfe lassen sich ändern. Für eine Änderung bitte als neuen Entwurf kopieren.");
}

/** Vergibt die Nummer (Kreis „KV-“) und friert den Inhalt ein. */
export async function kvAbschliessen(id: string, vonBenutzer: string): Promise<string> {
  const k = await kvLaden(id);
  if (!k) throw new Error("Kostenvoranschlag nicht gefunden.");
  if (!k.empfaenger?.name?.trim()) throw new Error("Bitte einen Empfänger eintragen.");
  // Vor dem Anlegen des Kunden: sonst entstünde er auch, wenn das Abschließen gleich danach scheitert
  if (!k.positionen?.length) throw new Error("Der Kostenvoranschlag hat keine Positionen.");
  const { firma, kostenvoranschlag } = await einstellungen();
  const heute = berlinDatum();
  // Empfänger ohne Kunden: jetzt in die Kartei (gefunden oder neu)
  const kundeId = k.kunde_id ?? (await kundeAusBeleg(k.empfaenger, k.fahrzeug));
  await db()
    .from("kostenvoranschlaege")
    .update({ kunde_id: kundeId, datum: heute, gueltig_bis: k.gueltig_bis && k.gueltig_bis >= heute ? k.gueltig_bis : plusTage(heute, kostenvoranschlag.gueltigTage) })
    .eq("id", id)
    .eq("status", "entwurf");
  const { data: nummer, error } = await db().rpc("kostenvoranschlag_abschliessen", { p_id: id, p_firma: firma });
  if (error) {
    if (error.message.includes("KEINE_POSITIONEN")) throw new Error("Der Kostenvoranschlag hat keine Positionen.");
    throw new Error(error.message);
  }
  await verlauf("kostenvoranschlag", id, `Abgeschlossen als ${nummer}`, vonBenutzer);
  await melden("kostenvoranschlag.abgeschlossen", ereignisDaten((await kvLaden(id))!));
  return nummer as string;
}

const ereignisDaten = (k: Kostenvoranschlag) => ({
  kostenvoranschlag_id: k.id,
  nummer: k.nummer,
  status: k.status,
  brutto_cent: k.summe_brutto_cent,
  netto_cent: k.summe_netto_cent,
  datum: k.datum,
  gueltig_bis: k.gueltig_bis,
  kunde_id: k.kunde_id,
  termin_id: k.termin_id,
  empfaenger: k.empfaenger?.firma || k.empfaenger?.name,
});

/** Das PDF: dasselbe Layout wie die Rechnung, Entwürfe mit „ENTWURF“ statt Nummer. */
export async function kvPdf(k: Kostenvoranschlag): Promise<Buffer> {
  const e = await einstellungen();
  const entwurf = k.status === "entwurf";
  const heute = berlinDatum();
  return rechnungPdf({
    art: "kostenvoranschlag",
    nummer: k.nummer ?? "ENTWURF",
    storno: false,
    rechnungsdatum: entwurf ? heute : (k.datum ?? heute),
    gueltig_bis: entwurf ? (k.gueltig_bis ?? plusTage(heute, e.kostenvoranschlag.gueltigTage)) : k.gueltig_bis,
    leistungsdatum: null,
    faellig_am: null,
    hinweis: k.hinweis,
    positionen: k.positionen,
    empfaenger: k.empfaenger,
    firma: entwurf || !k.firma ? e.firma : k.firma,
    kundennummer: k.kunde?.nummer ?? null,
    fahrzeug: k.fahrzeug ?? {},
    einleitung: `Sehr geehrte Damen und Herren,\n${e.kostenvoranschlag.einleitung}`,
    fusstext: e.kostenvoranschlag.fusstext,
    bezahlt: false,
  });
}

export function kvDateiname(k: Pick<Kostenvoranschlag, "nummer">): string {
  return `Kostenvoranschlag-${(k.nummer ?? "Entwurf").replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
}

export const kvLink = (k: Pick<Kostenvoranschlag, "token">) => `${ENV.siteUrl}/k/${k.token}`;

export async function kvVersenden(id: string, an: string, vonBenutzer: string): Promise<void> {
  const k = await kvLaden(id);
  if (!k || k.status === "entwurf") throw new Error("Bitte den Kostenvoranschlag zuerst abschließen.");
  const { firma } = await einstellungen();
  const pdf = await kvPdf(k);
  const { html, text } = mail(firma, {
    ueberschrift: `Ihr Kostenvoranschlag ${k.nummer}`,
    bausteine: [
      { art: "absatz", text: `Hallo ${k.empfaenger.name},\nvielen Dank für Ihre Anfrage. Unser Kostenvoranschlag hängt als PDF an dieser Mail.` },
      {
        art: "fakten",
        zeilen: [
          ["Nummer", k.nummer!],
          ["Betrag", euro(k.summe_brutto_cent)],
          ...(k.gueltig_bis ? ([["Gültig bis", datum(k.gueltig_bis)]] as [string, string][]) : []),
          ...(k.fahrzeug?.kennzeichen ? ([["Fahrzeug", k.fahrzeug.kennzeichen]] as [string, string][]) : []),
        ],
      },
      {
        art: "absatz",
        text: k.termin_id
          ? "Passt alles? Dann nehmen Sie den Kostenvoranschlag mit einem Klick an. Damit ist der Auftrag für Ihren Termin erteilt."
          : "Passt alles? Dann nehmen Sie den Kostenvoranschlag mit einem Klick an und wählen gleich einen Termin.",
      },
      { art: "knopf", text: "Ansehen und annehmen", url: kvLink(k) },
    ],
  });
  const ergebnis = await mailer().senden({
    an,
    betreff: `Kostenvoranschlag ${k.nummer} von ${firma.name}`,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: [{ dateiname: kvDateiname(k), inhalt: pdf, typ: "application/pdf" }],
  });
  if (!ergebnis.ok) throw new Error(`Die Mail wurde nicht versendet: ${ergebnis.fehler}`);
  await db().from("kostenvoranschlaege").update({ gesendet_am: new Date().toISOString(), gesendet_an: an }).eq("id", id);
  await verlauf("kostenvoranschlag", id, `Per E-Mail an ${an} gesendet`, vonBenutzer);
  await melden("kostenvoranschlag.versendet", { ...ereignisDaten(k), an });
}

/**
 * Antwort des Kunden über seinen Link (ohne Login) oder Vermerk aus der Verwaltung („Kunde hat angerufen“).
 * Nur ein offener, nicht abgelaufener Kostenvoranschlag lässt sich beantworten; die Bedingung steht im
 * Update selbst, zwei gleichzeitige Klicks ergeben also nur eine Antwort.
 */
export async function kvBeantworten(id: string, antwort: "angenommen" | "abgelehnt", von: { benutzer?: string; kunde?: boolean }): Promise<void> {
  const k = await kvLaden(id);
  if (!k || k.status !== "offen") throw new Error("Dieser Kostenvoranschlag ist schon beantwortet.");
  if (von.kunde && kvAbgelaufen(k)) throw new Error("Dieser Kostenvoranschlag ist abgelaufen. Bitte rufen Sie uns kurz an.");
  const { data, error } = await db()
    .from("kostenvoranschlaege")
    .update({ status: antwort, beantwortet_am: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "offen")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Dieser Kostenvoranschlag ist schon beantwortet.");

  const wer = von.kunde ? "vom Kunden online" : "in der Verwaltung vermerkt";
  await verlauf("kostenvoranschlag", id, `${antwort === "angenommen" ? "Angenommen" : "Abgelehnt"} (${wer})`, von.benutzer ?? null);
  // Am Termin wird der angenommene Kostenvoranschlag zum erteilten Werkstattauftrag.
  if (antwort === "angenommen" && k.termin_id) {
    try {
      await auftragAusKv(k.termin_id, k, von.benutzer ?? null);
    } catch (error) {
      console.error("Auftrag aus Kostenvoranschlag nicht angelegt", id, error);
    }
  }
  await melden(`kostenvoranschlag.${antwort}`, { ...ereignisDaten(k), status: antwort, online: Boolean(von.kunde) });
  if (von.kunde) {
    const name = k.empfaenger.firma || k.empfaenger.name;
    await pushSenden(
      { rollen: ["inhaber", "buero"] },
      {
        titel: antwort === "angenommen" ? "Kostenvoranschlag angenommen" : "Kostenvoranschlag abgelehnt",
        text: `${name} · ${k.nummer} · ${euro(k.summe_brutto_cent)}${k.fahrzeug?.kennzeichen ? ` · ${k.fahrzeug.kennzeichen}` : ""}`,
        url: `/app/kostenvoranschlaege/${k.id}`,
        tag: `kv-${k.id}`,
      },
    );
  }
}

/**
 * Rechnungsentwurf aus dem Kostenvoranschlag: Empfänger, Fahrzeug und Positionen werden übernommen und
 * lassen sich in der Rechnung noch anpassen (Mehraufwand). Ein zweiter Klick öffnet denselben Entwurf. Gehört
 * der Kostenvoranschlag zu einem Termin, der schon eine Rechnung hat, ist es diese (keine zweite Rechnung).
 */
export async function kvInRechnung(id: string, vonBenutzer: string): Promise<string> {
  const k = await kvLaden(id);
  if (!k || k.status === "entwurf") throw new Error("Bitte den Kostenvoranschlag zuerst abschließen.");
  if (k.status === "abgelehnt") throw new Error("Ein abgelehnter Kostenvoranschlag wird nicht zur Rechnung.");
  if (k.rechnung_id) {
    const { data } = await db().from("rechnungen").select("id").eq("id", k.rechnung_id).maybeSingle();
    if (data) return data.id;
  }
  const amTermin = k.termin_id ? await rechnungZumTermin(k.termin_id) : null;
  if (amTermin) {
    await db().from("kostenvoranschlaege").update({ rechnung_id: amTermin }).eq("id", id);
    await verlauf("kostenvoranschlag", id, "Rechnung des Termins übernommen", vonBenutzer);
    return amTermin;
  }
  const rechnungId = await entwurfAnlegen(
    {
      kunde_id: k.kunde_id,
      termin_id: k.termin_id,
      empfaenger: k.empfaenger,
      fahrzeug: k.fahrzeug,
      positionen: k.positionen,
      leistungsdatum: berlinDatum(),
      hinweis: k.hinweis,
    },
    vonBenutzer,
  );
  // Zwei gleichzeitige Klicks: Nur der erste Entwurf bleibt, der zweite fällt wieder weg.
  const { data: gesetzt } = await db().from("kostenvoranschlaege").update({ rechnung_id: rechnungId }).eq("id", id).is("rechnung_id", null).select("id");
  if (!gesetzt?.length) {
    await db().from("rechnungen").delete().eq("id", rechnungId).eq("status", "entwurf");
    await db().from("verlauf").delete().eq("bezug_typ", "rechnung").eq("bezug_id", rechnungId);
    return (await kvLaden(id))?.rechnung_id ?? rechnungId;
  }
  const ergebnis = k.termin_id ? await einzigerEntwurf(k.termin_id, rechnungId) : rechnungId;
  if (ergebnis !== rechnungId) {
    await db().from("kostenvoranschlaege").update({ rechnung_id: ergebnis }).eq("id", id);
    return ergebnis;
  }
  await verlauf("rechnung", rechnungId, `Aus Kostenvoranschlag ${k.nummer} übernommen`, vonBenutzer);
  await verlauf("kostenvoranschlag", id, "Rechnungsentwurf erstellt", vonBenutzer);
  await melden("kostenvoranschlag.umgewandelt", { ...ereignisDaten(k), rechnung_id: rechnungId });
  return rechnungId;
}

/**
 * Kostenvoranschlag an einen Termin hängen (gleicher Kunde, z. B. die Anfrage, für die er geschrieben wurde,
 * oder ein Termin, den das Büro nach der Annahme eingetragen hat). Ist er angenommen, wird er am Termin zum
 * erteilten Werkstattauftrag. Eine schon aus ihm entstandene Rechnung geht mit, wenn der Termin noch keine hat.
 */
export async function kvMitTerminVerknuepfen(id: string, terminId: string, vonBenutzer: string | null): Promise<void> {
  const k = await kvLaden(id);
  if (!k) throw new Error("Kostenvoranschlag nicht gefunden.");
  const { data: t } = await db().from("termine").select("id, nummer, kunde_id, status").eq("id", terminId).maybeSingle();
  if (!t) throw new Error("Termin nicht gefunden.");
  if (k.termin_id === terminId) return;
  if (k.termin_id) throw new Error("Der Kostenvoranschlag gehört schon zu einem anderen Termin. Bitte dort zuerst lösen.");
  const { error } = await db().from("kostenvoranschlaege").update({ termin_id: terminId }).eq("id", id).is("termin_id", null);
  if (error) throw new Error(error.message);
  if (k.rechnung_id && !(await rechnungZumTermin(terminId))) {
    await db().from("rechnungen").update({ termin_id: terminId }).or(`id.eq.${k.rechnung_id},storno_zu.eq.${k.rechnung_id}`).is("termin_id", null);
  }
  const name = k.nummer ?? "Kostenvoranschlag (Entwurf)";
  await verlauf("kostenvoranschlag", id, `Mit Termin Nr. ${t.nummer} verknüpft`, vonBenutzer);
  await verlauf("termin", terminId, `${name} verknüpft`, vonBenutzer);
  await melden("kostenvoranschlag.termin_verknuepft", { ...ereignisDaten(k), termin_id: terminId, verknuepft: true });
  if (k.status === "angenommen") await auftragAusKv(terminId, k, vonBenutzer);
}

/** Verknüpfung lösen (falscher Termin). Ein daraus erteilter Auftrag bleibt, wie er ist. */
export async function kvTerminLoesen(id: string, vonBenutzer: string): Promise<void> {
  const k = await kvLaden(id);
  if (!k?.termin_id) return;
  await db().from("kostenvoranschlaege").update({ termin_id: null }).eq("id", id);
  await verlauf("kostenvoranschlag", id, "Vom Termin gelöst", vonBenutzer);
  await verlauf("termin", k.termin_id, `${k.nummer ?? "Kostenvoranschlag (Entwurf)"} gelöst`, vonBenutzer);
  await melden("kostenvoranschlag.termin_verknuepft", { ...ereignisDaten(k), verknuepft: false });
}

/** Neuer Kostenvoranschlag zu einem Termin: Kunde, Fahrzeug und Leistungen des Termins sind schon drin. */
export async function kvAusTermin(terminId: string, vonBenutzer: string): Promise<string> {
  const { data: t } = await db().from("termine").select("*").eq("id", terminId).maybeSingle();
  if (!t) throw new Error("Termin nicht gefunden.");
  const kunde = t.kunde_id ? await kundeLaden(t.kunde_id) : null;
  const ids: string[] = (t.leistung_ids as string[] | undefined)?.length ? t.leistung_ids : t.leistung_id ? [t.leistung_id] : [];
  const { data: gefunden } = ids.length ? await db().from("leistungen").select("*").in("id", ids) : { data: [] };
  const id = await kvAnlegen(
    {
      termin_id: terminId,
      kunde_id: kunde?.id ?? null,
      empfaenger: kunde ? alsEmpfaenger(kunde) : { name: "" },
      fahrzeug: { ...alsBelegFahrzeug(kunde?.fahrzeuge.find((f) => f.id === t.fahrzeug_id)), km: t.km_stand ?? null },
      positionen: positionenAusLeistungen(ids.map((x) => (gefunden ?? []).find((l) => l.id === x)).filter(Boolean), String(t.leistung_name ?? "")),
      hinweis: "",
    },
    vonBenutzer,
  );
  await verlauf("termin", terminId, "Kostenvoranschlag angelegt", vonBenutzer);
  return id;
}

/** Für eine Änderung nach dem Abschließen: ein neuer Entwurf mit demselben Inhalt. */
export async function kvKopieren(id: string, vonBenutzer: string): Promise<string> {
  const k = await kvLaden(id);
  if (!k) throw new Error("Kostenvoranschlag nicht gefunden.");
  const neu = await kvAnlegen(
    { kunde_id: k.kunde_id, termin_id: k.termin_id, empfaenger: k.empfaenger, fahrzeug: k.fahrzeug, positionen: k.positionen, hinweis: k.hinweis },
    vonBenutzer,
  );
  await verlauf("kostenvoranschlag", neu, `Kopie von ${k.nummer ?? "Entwurf"}`, vonBenutzer);
  return neu;
}
