import "server-only";
import { einstellungen, type Einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { melden, verlauf } from "../ereignisse";
import { datum, euro } from "../format";
import { mail } from "../email/vorlagen";
import { mailer } from "../services/email";
import { db, pruefe } from "../supabase/admin";
import { berlinDatum, plusTage } from "../zeit";
import { laufendeAngebote } from "../angebote/daten";
import { angeboteAnwenden, type GebuchterAngebotsPreis } from "../angebote/preise";
import { berechne, nettoAusBruttoPreis, type Position, vorzeichenWechseln } from "./berechnung";
import { kundeAusBeleg, markeUndModell } from "../kunden";
import { merken, type PaketWunsch } from "./preisgedaechtnis";
import { rechnungPdf } from "./pdf";
import { alsZugferd, eRechnungPruefen, istXRechnung, zugferdXml } from "./zugferd";

export type Empfaenger = {
  name: string;
  firma?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  ust_id?: string;
  leitweg_id?: string;
};

export type Rechnung = {
  id: string;
  nummer: string | null;
  status: "entwurf" | "gestellt" | "bezahlt" | "storniert";
  storno_zu: string | null;
  termin_id: string | null;
  kunde_id: string | null;
  empfaenger: Empfaenger;
  /** Bei Belegen vor der Trennung steht in modell der ganze Text („VW Golf“) und marke fehlt. */
  fahrzeug: { kennzeichen?: string; marke?: string; modell?: string; km?: number | null };
  positionen: Position[];
  rechnungsdatum: string | null;
  leistungsdatum: string | null;
  faellig_am: string | null;
  hinweis: string;
  summe_netto_cent: number;
  summe_mwst_cent: number;
  summe_brutto_cent: number;
  firma: Einstellungen["firma"] | null;
  token: string;
  gesendet_am: string | null;
  gesendet_an: string | null;
  bezahlt_am: string | null;
  zahlungsart: "bar" | "ueberweisung" | null;
  erstellt_am: string;
  gestellt_am: string | null;
  kunde?: { nummer: number } | null;
};

export const RECHNUNG_STATUS: Record<Rechnung["status"], string> = {
  entwurf: "Entwurf",
  gestellt: "Offen",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

export type PreislistenPosition = {
  id: string;
  name: string;
  einheit: string;
  /** Geltender Preis: während eines Angebots der Angebotspreis. */
  preis_brutto_cent: number;
  mwst_satz: number;
  sprachnamen: string[];
  /** Titel des laufenden Angebots, sonst null. Ein Angebotspreis hat Vorrang vor gemerkten Preisen. */
  angebot: string | null;
  listen_brutto_cent: number;
};

/**
 * Auswahl „Aus der Preisliste“ im Rechnungseditor: alles Aktive, Leistungen und Teile, in der Reihenfolge der
 * Preisliste. Laufende Angebote sind schon eingerechnet (Stichtag: heute, der Tag, an dem der Beleg entsteht).
 */
export async function preislisteFuerBelege(): Promise<PreislistenPosition[]> {
  const [{ data }, angebote] = await Promise.all([db().from("leistungen").select("*").order("sortierung"), laufendeAngebote()]);
  const aktiv = (data ?? []).filter((l) => l.aktiv !== false);
  return angeboteAnwenden(aktiv, angebote, berlinDatum()).map((l) => ({
    id: l.id,
    name: l.name,
    einheit: l.einheit ?? "Pauschal",
    preis_brutto_cent: l.preis_cent ?? 0,
    mwst_satz: Number(l.mwst_satz ?? 19),
    // Vor der Migration „sprachnamen“ fehlt die Spalte
    sprachnamen: Array.isArray(l.sprachnamen) ? l.sprachnamen : [],
    angebot: l.angebot && l.preis_cent !== null ? l.angebot.titel : null,
    listen_brutto_cent: l.angebot?.listen_cent ?? l.preis_cent ?? 0,
  }));
}

export async function rechnungLaden(id: string): Promise<Rechnung | null> {
  const { data } = await db().from("rechnungen").select("*, kunde:kunden(nummer)").eq("id", id).maybeSingle();
  return data as Rechnung | null;
}

export async function rechnungPerToken(token: string): Promise<Rechnung | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await db().from("rechnungen").select("*, kunde:kunden(nummer)").eq("token", token).neq("status", "entwurf").maybeSingle();
  return data as Rechnung | null;
}

/** Entwurf aus einem Termin: Kunde, Fahrzeug und jede Leistung mit ihrem Festpreis sind schon eingetragen. */
export async function entwurfAusTermin(terminId: string, vonBenutzer: string): Promise<string> {
  // Stornorechnungen zählen nicht: Sie tragen dieselbe termin_id und stehen auf „gestellt“, sonst führte
  // „Rechnung erstellen“ nach einem Storno immer wieder zur Stornorechnung statt zu einem neuen Entwurf.
  const { data: vorhanden } = await db()
    .from("rechnungen")
    .select("id")
    .eq("termin_id", terminId)
    .in("status", ["entwurf", "gestellt", "bezahlt"])
    .is("storno_zu", null)
    .limit(1)
    .maybeSingle();
  if (vorhanden) return vorhanden.id;

  // „*“ statt einzelner Spalten: leistung_ids gibt es erst nach der Migration „mehrere_leistungen“.
  const { data: t } = await db()
    .from("termine")
    .select("*, kunde:kunden(*), fahrzeug:fahrzeuge(kennzeichen, marke_modell, marke, modell, km_stand)")
    .eq("id", terminId)
    .single();
  if (!t) throw new Error("Termin nicht gefunden.");
  const kunde = t.kunde as unknown as Record<string, string> | null;
  const fahrzeug = t.fahrzeug as unknown as { kennzeichen: string; marke_modell: string; marke: string; modell: string; km_stand: number | null } | null;
  const ids: string[] = (t.leistung_ids as string[] | undefined)?.length ? t.leistung_ids : t.leistung_id ? [t.leistung_id] : [];

  // Derselbe Preis wie auf der Website: Es gibt ihn nur einmal, in der Preisliste (brutto, rund). Im Beleg steht
  // er netto, so genau, dass brutto wieder derselbe runde Betrag herauskommt. Bei „ab“-Preisen steht der
  // Startwert drin und wird in der Rechnung angepasst. Reihenfolge wie im Termin.
  const { data: gefunden } = ids.length ? await db().from("leistungen").select("*").in("id", ids) : { data: [] };
  // Wurde die Leistung während eines Angebots angefragt, gilt der damals festgehaltene Angebotspreis.
  const leistungen = ids.map((id) => (gefunden ?? []).find((l) => l.id === id)).filter(Boolean);
  const angebotPreise = (t.angebot_preise ?? {}) as Record<string, GebuchterAngebotsPreis>;
  const positionen: Position[] = leistungen.map((l) => {
    const a = angebotPreise[l.id]?.cent != null ? angebotPreise[l.id] : null;
    return {
      text: l.name,
      menge: 1,
      einheit: l.einheit ?? "Pauschal",
      einzel_netto_cent: nettoAusBruttoPreis(a?.cent ?? l.preis_cent ?? 0, Number(l.mwst_satz ?? 19)),
      mwst_satz: Number(l.mwst_satz ?? 19),
      artikel_id: l.id,
      ...(a && { angebot: a.titel }),
    };
  });
  // Frei eingetragene Arbeit steht hinter den Namen der Leistungen in leistung_name (terminEintragen).
  const namen = leistungen.map((l) => l.name).join(", ");
  const name = String(t.leistung_name ?? "");
  const frei = !namen ? name : name.startsWith(`${namen}, `) ? name.slice(namen.length + 2) : "";
  if (frei || !positionen.length) positionen.push({ text: frei || name || "Arbeit", menge: 1, einheit: "Pauschal", einzel_netto_cent: 0, mwst_satz: 19 });

  return entwurfAnlegen(
    {
      termin_id: t.id,
      kunde_id: kunde?.id ?? null,
      empfaenger: kunde
        ? { name: kunde.name, firma: kunde.firma, strasse: kunde.strasse, plz: kunde.plz, ort: kunde.ort, email: kunde.email, ust_id: kunde.ust_id, leitweg_id: kunde.leitweg_id }
        : { name: "" },
      fahrzeug: { kennzeichen: fahrzeug?.kennzeichen, ...(fahrzeug ? markeUndModell(fahrzeug) : {}), km: t.km_stand ?? fahrzeug?.km_stand ?? null },
      positionen,
      leistungsdatum: berlinDatum(new Date(t.beginn)),
    },
    vonBenutzer,
  );
}

export async function entwurfAnlegen(
  r: Partial<Pick<Rechnung, "termin_id" | "kunde_id" | "empfaenger" | "fahrzeug" | "positionen" | "leistungsdatum" | "hinweis">>,
  vonBenutzer: string,
): Promise<string> {
  const summen = berechne(r.positionen ?? []);
  const neu = pruefe(
    await db()
      .from("rechnungen")
      .insert({
        ...r,
        summe_netto_cent: summen.netto,
        summe_mwst_cent: summen.steuer,
        summe_brutto_cent: summen.brutto,
        erstellt_von: vonBenutzer,
      })
      .select("id")
      .single(),
  );
  await verlauf("rechnung", neu.id, "Entwurf angelegt", vonBenutzer);
  return neu.id;
}

export async function entwurfSpeichern(
  id: string,
  r: Pick<Rechnung, "empfaenger" | "fahrzeug" | "positionen" | "leistungsdatum" | "hinweis"> & { kunde_id?: string | null },
): Promise<void> {
  const summen = berechne(r.positionen);
  const { data, error } = await db()
    .from("rechnungen")
    .update({ ...r, summe_netto_cent: summen.netto, summe_mwst_cent: summen.steuer, summe_brutto_cent: summen.brutto })
    .eq("id", id)
    .eq("status", "entwurf")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Nur Entwürfe lassen sich ändern. Für eine gestellte Rechnung bitte eine Stornorechnung erstellen.");
}

/**
 * Vergibt die Nummer und friert die Rechnung ein. Danach ist sie unveränderlich. Anschließend merken sich die
 * Positionen ihren Preis für Marke + Modell des Fahrzeugs, dazu die benannten Pakete.
 */
export async function stellen(id: string, vonBenutzer: string, pakete: PaketWunsch[] = []): Promise<string> {
  const r = await rechnungLaden(id);
  if (!r) throw new Error("Rechnung nicht gefunden.");
  if (!r.empfaenger?.name?.trim()) throw new Error("Bitte einen Rechnungsempfänger eintragen.");
  // Vor dem Anlegen des Kunden: sonst entstünde er auch, wenn das Stellen gleich danach scheitert
  if (!r.positionen?.length) throw new Error("Die Rechnung hat keine Positionen.");
  const { firma, rechnung } = await einstellungen();
  // Pflichtangaben der E-Rechnung jetzt prüfen: Nach dem Stellen ist die Rechnung unveränderlich.
  const fehlt = eRechnungPruefen({ empfaenger: r.empfaenger, firma, positionen: r.positionen });
  if (fehlt.length) {
    const art = istXRechnung(r) ? "XRechnung (Behörde, Leitweg-ID)" : "E-Rechnung";
    throw new Error(`Für eine gültige ${art} fehlt noch: ${fehlt.join("; ")}.`);
  }
  const heute = berlinDatum();
  // Empfänger ohne Kunden: jetzt in die Kartei (gefunden oder neu). Stornos übernehmen den Kunden des Originals.
  const kundeId = r.kunde_id ?? (r.storno_zu ? null : await kundeAusBeleg(r.empfaenger, r.fahrzeug));
  await db()
    .from("rechnungen")
    .update({ rechnungsdatum: heute, faellig_am: plusTage(heute, rechnung.zahlungszielTage), leistungsdatum: r.leistungsdatum ?? heute, kunde_id: kundeId })
    .eq("id", id)
    .eq("status", "entwurf");
  const { data: nummer, error } = await db().rpc("rechnung_stellen", { p_id: id, p_firma: firma });
  if (error) {
    if (error.message.includes("KEINE_POSITIONEN")) throw new Error("Die Rechnung hat keine Positionen.");
    throw new Error(error.message);
  }
  await verlauf("rechnung", id, `Gestellt als ${nummer}`, vonBenutzer);
  const neu = (await rechnungLaden(id))!;
  await melden("rechnung.gestellt", ereignisDaten(neu));
  try {
    await merken(neu, pakete);
  } catch (e) {
    console.error("Preise der Rechnung nicht gemerkt", id, e);
  }
  return nummer as string;
}

const ereignisDaten = (r: Rechnung) => ({
  rechnung_id: r.id,
  nummer: r.nummer,
  status: r.status,
  brutto_cent: r.summe_brutto_cent,
  netto_cent: r.summe_netto_cent,
  rechnungsdatum: r.rechnungsdatum,
  kunde_id: r.kunde_id,
  termin_id: r.termin_id,
  empfaenger: r.empfaenger?.firma || r.empfaenger?.name,
});

/** Die gespeicherten Daten einer gestellten Rechnung, so wie PDF und E-Rechnung sie brauchen. */
async function gestellteDaten(r: Rechnung) {
  if (!r.nummer || !r.firma || !r.rechnungsdatum) throw new Error("Nur gestellte Rechnungen haben ein PDF. Für Entwürfe gibt es die Vorschau.");
  let stornoZu: string | null = null;
  if (r.storno_zu) {
    const { data } = await db().from("rechnungen").select("nummer").eq("id", r.storno_zu).maybeSingle();
    stornoZu = data?.nummer ?? null;
  }
  return {
    nummer: r.nummer,
    storno: Boolean(r.storno_zu),
    storno_zu_nummer: stornoZu,
    rechnungsdatum: r.rechnungsdatum,
    leistungsdatum: r.leistungsdatum,
    faellig_am: r.faellig_am,
    hinweis: r.hinweis,
    positionen: r.positionen,
    empfaenger: r.empfaenger,
    firma: r.firma,
  };
}

/** Die E-Rechnung als reine XML-Datei (für Behördenportale, die keine PDFs annehmen). */
export async function xmlErzeugen(r: Rechnung): Promise<string> {
  return zugferdXml(await gestellteDaten(r));
}

/** Das PDF zu einer gestellten Rechnung, mit eingebetteter E-Rechnung (ZUGFeRD, bei Behörden XRechnung). */
export async function pdfErzeugen(r: Rechnung): Promise<Buffer> {
  const { rechnung } = await einstellungen();
  const daten = await gestellteDaten(r);
  const pdf = await rechnungPdf({
    ...daten,
    kundennummer: r.kunde?.nummer ?? null,
    fahrzeug: r.fahrzeug ?? {},
    einleitung: `Sehr geehrte Damen und Herren,\n${rechnung.einleitung}`,
    fusstext: rechnung.fusstext,
    bezahlt: r.status === "bezahlt",
  });
  return Buffer.from(await alsZugferd(new Uint8Array(pdf), zugferdXml(daten), daten.nummer));
}

/** Vorschau eines Entwurfs (ohne Nummer, ohne E-Rechnung). */
export async function vorschauPdf(r: Rechnung): Promise<Buffer> {
  const { firma, rechnung } = await einstellungen();
  return rechnungPdf({
    nummer: "ENTWURF",
    storno: false,
    rechnungsdatum: berlinDatum(),
    leistungsdatum: r.leistungsdatum,
    faellig_am: plusTage(berlinDatum(), rechnung.zahlungszielTage),
    hinweis: r.hinweis,
    positionen: r.positionen,
    empfaenger: r.empfaenger,
    firma,
    kundennummer: r.kunde?.nummer ?? null,
    fahrzeug: r.fahrzeug ?? {},
    einleitung: `Sehr geehrte Damen und Herren,\n${rechnung.einleitung}`,
    fusstext: rechnung.fusstext,
    bezahlt: false,
  });
}

export function dateiname(r: Pick<Rechnung, "nummer" | "storno_zu">, endung: "pdf" | "xml" = "pdf"): string {
  return `${r.storno_zu ? "Stornorechnung" : "Rechnung"}-${(r.nummer ?? "Entwurf").replace(/[^A-Za-z0-9-]/g, "_")}.${endung}`;
}

export async function versenden(id: string, an: string, vonBenutzer: string): Promise<void> {
  const r = await rechnungLaden(id);
  if (!r || r.status === "entwurf") throw new Error("Bitte die Rechnung zuerst stellen.");
  const { firma } = await einstellungen();
  const pdf = await pdfErzeugen(r);
  const xrechnung = istXRechnung(r);
  const link = `${ENV.siteUrl}/r/${r.token}`;
  const storno = Boolean(r.storno_zu);
  const { html, text } = mail(firma, {
    ueberschrift: storno ? `Stornorechnung ${r.nummer}` : `Ihre Rechnung ${r.nummer}`,
    bausteine: [
      { art: "absatz", text: `Hallo ${r.empfaenger.name},\n${storno ? "anbei die Stornorechnung." : "vielen Dank für Ihren Auftrag. Ihre Rechnung hängt als PDF an dieser Mail."}` },
      {
        art: "fakten",
        zeilen: [
          ["Rechnungsnummer", r.nummer!],
          ["Betrag", euro(r.summe_brutto_cent)],
          ...(!storno && r.status !== "bezahlt" && r.faellig_am ? ([["Zahlbar bis", datum(r.faellig_am)]] as [string, string][]) : []),
          ...(r.fahrzeug?.kennzeichen ? ([["Fahrzeug", r.fahrzeug.kennzeichen]] as [string, string][]) : []),
        ],
      },
      ...(!storno && r.status !== "bezahlt" && firma.iban
        ? [{ art: "absatz" as const, text: `Bitte überweisen Sie auf ${firma.iban} mit dem Verwendungszweck ${r.nummer}. Auf dem PDF ist ein QR-Code für Ihre Banking-App.` }]
        : []),
      { art: "knopf", text: "Rechnung online ansehen", url: link },
      {
        art: "absatz",
        text: xrechnung
          ? "Die Rechnung liegt zusätzlich als XRechnung (XML, Version 3.0) bei; dieselbe XML ist auch im PDF eingebettet."
          : "Geschäftskunden: Das PDF enthält die Rechnung zusätzlich als E-Rechnung (ZUGFeRD, EN 16931).",
      },
    ],
  });
  const ergebnis = await mailer().senden({
    an,
    betreff: `${storno ? "Stornorechnung" : "Rechnung"} ${r.nummer} von ${firma.name}`,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: [
      { dateiname: dateiname(r), inhalt: pdf, typ: "application/pdf" },
      ...(xrechnung ? [{ dateiname: dateiname(r, "xml"), inhalt: Buffer.from(await xmlErzeugen(r), "utf8"), typ: "application/xml" }] : []),
    ],
  });
  if (!ergebnis.ok) throw new Error(`Die Mail wurde nicht versendet: ${ergebnis.fehler}`);
  await db().from("rechnungen").update({ gesendet_am: new Date().toISOString(), gesendet_an: an }).eq("id", id);
  await verlauf("rechnung", id, `Per E-Mail an ${an} gesendet`, vonBenutzer);
  await melden("rechnung.versendet", { ...ereignisDaten(r), an });
}

export async function alsBezahlt(id: string, zahlungsart: "bar" | "ueberweisung", am: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("rechnungen")
    .update({ status: "bezahlt", zahlungsart, bezahlt_am: am })
    .eq("id", id)
    .eq("status", "gestellt")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Nur offene Rechnungen lassen sich als bezahlt markieren.");
  await verlauf("rechnung", id, `Bezahlt (${zahlungsart === "bar" ? "bar" : "Überweisung"}) am ${datum(am)}`, vonBenutzer);
  const r = (await rechnungLaden(id))!;
  await melden("rechnung.bezahlt", { ...ereignisDaten(r), zahlungsart, bezahlt_am: am });
}

/**
 * Nimmt eine versehentlich vermerkte Zahlung zurück. Die Rechnung selbst bleibt unverändert, nur Status,
 * Zahlungsart und Datum gehen auf offen zurück. Der Verlauf behält beide Einträge, damit nachvollziehbar
 * bleibt, dass die Rechnung zwischendurch als bezahlt galt.
 */
export async function alsUnbezahlt(id: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("rechnungen")
    .update({ status: "gestellt", zahlungsart: null, bezahlt_am: null })
    .eq("id", id)
    .eq("status", "bezahlt")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Nur bezahlte Rechnungen lassen sich als nicht bezahlt markieren.");
  await verlauf("rechnung", id, "Zahlung zurückgenommen, wieder offen", vonBenutzer);
  const r = (await rechnungLaden(id))!;
  await melden("rechnung.unbezahlt", ereignisDaten(r));
}

/**
 * Storno: eine eigene Rechnung mit negativen Beträgen und eigener Nummer, die auf das Original verweist.
 * Das Original bleibt unverändert erhalten (GoBD) und bekommt nur den Status „storniert“.
 */
export async function stornieren(id: string, vonBenutzer: string): Promise<string> {
  const r = await rechnungLaden(id);
  if (!r || !["gestellt", "bezahlt"].includes(r.status) || r.storno_zu) throw new Error("Diese Rechnung kann nicht storniert werden.");
  const stornoId = await entwurfAnlegen(
    {
      kunde_id: r.kunde_id,
      termin_id: r.termin_id,
      empfaenger: r.empfaenger,
      fahrzeug: r.fahrzeug,
      leistungsdatum: r.leistungsdatum,
      positionen: vorzeichenWechseln(r.positionen),
      hinweis: `Storno zu Rechnung ${r.nummer}`,
    },
    vonBenutzer,
  );
  await db().from("rechnungen").update({ storno_zu: id }).eq("id", stornoId);
  const nummer = await stellen(stornoId, vonBenutzer);
  await db().from("rechnungen").update({ status: "storniert" }).eq("id", id);
  await verlauf("rechnung", id, `Storniert durch ${nummer}`, vonBenutzer);
  await melden("rechnung.storniert", { ...ereignisDaten(r), storno_nummer: nummer });
  return stornoId;
}
