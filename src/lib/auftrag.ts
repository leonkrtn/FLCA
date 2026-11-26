import "server-only";
import { after } from "next/server";
import { type Annahme, annahmeZeilen, auftragStand, bruttoVon, type ErteiltWie, erteiltText, freigabeText, grenzeText, positionenAusLeistungen, ueberKostengrenze } from "./auftrag-regeln";
import { einstellungen } from "./einstellungen";
import { ENV } from "./env";
import { melden, verlauf } from "./ereignisse";
import { datum, datumLangText, datumZeit, euro, zeit } from "./format";
import { mail } from "./email/vorlagen";
import { markeUndModell } from "./kunden";
import type { Position } from "./rechnung/berechnung";
import { rechnungPdf } from "./rechnung/pdf";
import { entwurfAusTermin, type Empfaenger } from "./rechnung/rechnungen";
import { mailer } from "./services/email";
import { pushSenden } from "./services/push";
import { db, DbFehler, dbRoh } from "./supabase/admin";
import { type Termin, TerminFehler, terminLaden } from "./termine";
import { berlinDatum } from "./zeit";
import { fehlerMelden } from "./fehler";
import { widerrufText } from "./rechtstexte-standard";

/**
 * Werkstattauftrag: Der Kunde erteilt ihn, bevor gearbeitet wird. Er hängt am Termin (Spalten auftrag_* in
 * termine) und ist der einzige Weg dorthin; Regeln ohne Datenbank stehen in auftrag-regeln.ts.
 *
 * Ablauf: Anfrage oder Termin → Auftrag anlegen (von Hand am Termin, oder ein angenommener Kostenvoranschlag
 * am Termin) → erteilt per Unterschrift, online über den Terminlink oder durch den Kostenvoranschlag →
 * Werkstatt arbeitet (geht auch ohne Erteilung, mit Warnung) → „fertig“ legt den Rechnungsentwurf an.
 *
 * Ein angenommener Kostenvoranschlag ohne Termin wird sofort zum erteilten Auftrag, der ohne Termin wartet
 * (Stand „ungeplant“, `ungeplantAnlegen` in termine.ts) und später eingeplant wird. Ab da ist der Auftrag das
 * lebende Dokument (Mehrarbeit, Rechnung), der Kostenvoranschlag bleibt, wie der Kunde ihn bekommen hat.
 */

/** Abgesagte oder abgelehnte Termine bekommen keinen Auftrag und können keinen erteilen. */
const BEENDET = ["abgelehnt", "storniert", "nicht_erschienen"];

type FahrzeugVoll = { id: string; kennzeichen: string; marke_modell: string; marke?: string; modell?: string; fin: string; hsn: string; tsn: string; erstzulassung?: string; km_stand: number | null };

/** Termin mit allem, was Auftrag, PDF und Mail brauchen: Kunde mit Adresse, Fahrzeug mit Fahrzeugschein-Daten. */
export async function auftragLaden(terminId: string) {
  const t = await terminLaden(terminId);
  if (!t) return null;
  const [{ data: kunde }, { data: fahrzeug }, { data: bild }] = await Promise.all([
    t.kunde ? db().from("kunden").select("*").eq("id", t.kunde.id).maybeSingle() : Promise.resolve({ data: null }),
    t.fahrzeug ? db().from("fahrzeuge").select("*").eq("id", t.fahrzeug.id).maybeSingle() : Promise.resolve({ data: null }),
    t.auftrag_erteilt_wie === "unterschrift" ? db().from("auftrag_unterschriften").select("bild").eq("termin_id", terminId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    ...t,
    kundeVoll: kunde as (Empfaenger & { id: string; nummer: number; telefon: string }) | null,
    fahrzeugVoll: fahrzeug as FahrzeugVoll | null,
    unterschrift: (bild?.bild as string | undefined) ?? null,
  };
}

export type AuftragTermin = NonNullable<Awaited<ReturnType<typeof auftragLaden>>>;

const ereignisDaten = (t: Termin) => ({
  termin_id: t.id,
  auftrag_nummer: t.auftrag_nummer,
  stand: auftragStand(t),
  brutto_cent: t.auftrag_summe_brutto_cent ?? 0,
  kostengrenze_cent: t.auftrag_kostengrenze_cent ?? null,
  erteilt_wie: t.auftrag_erteilt_wie ?? null,
  kunde_id: t.kunde?.id ?? null,
  kennzeichen: t.fahrzeug?.kennzeichen ?? null,
});

/** Wann der Auftrag dran ist, für Mail, PDF und Kundenseite. */
export const terminText = (t: Pick<Termin, "beginn">) => (t.beginn ? `${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr` : "wird noch vereinbart");

/** Positionen aus den Leistungen des Termins (wie der Rechnungsentwurf ohne Auftrag). */
async function positionenAusTermin(t: Termin): Promise<Position[]> {
  const ids = t.leistung_ids?.length ? t.leistung_ids : t.leistung_id ? [t.leistung_id] : [];
  const { data } = ids.length ? await db().from("leistungen").select("*").in("id", ids) : { data: [] };
  return positionenAusLeistungen(ids.map((id) => (data ?? []).find((l) => l.id === id)).filter(Boolean), t.leistung_name, t.angebot_preise ?? {});
}

type KvKurz = { id: string; nummer: string | null; positionen: Position[]; empfaenger: Empfaenger; vorab_am?: string | null };

/** Kostenvoranschlag am Termin mit diesem Stand, der jüngste zuerst. */
async function kvAmTermin(terminId: string, status: "angenommen" | "offen"): Promise<KvKurz | null> {
  const { data } = await db()
    .from("kostenvoranschlaege")
    .select("id, nummer, positionen, empfaenger, vorab_am")
    .eq("termin_id", terminId)
    .eq("status", status)
    .order(status === "angenommen" ? "beantwortet_am" : "erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as KvKurz | null;
}

/**
 * Auftrag am Termin anlegen (Knopf am Termin, auch an Anfragen). Vorbefüllt mit den Positionen eines
 * angenommenen Kostenvoranschlags (dann ist er gleich erteilt), sonst eines noch offenen (erteilt wird er mit
 * der Annahme), sonst mit den Leistungen des Termins.
 * Ein zweiter Aufruf ändert nichts. Ohne Benutzer: angelegt am Kundenbildschirm, wo der Kunde ihn gleich unterschreibt.
 */
export async function auftragAnlegen(terminId: string, vonBenutzer: string | null): Promise<string> {
  const t = await terminLaden(terminId);
  if (!t) throw new TerminFehler("Termin nicht gefunden.");
  if (t.auftrag_nummer) return t.auftrag_nummer;
  if (BEENDET.includes(t.status)) throw new TerminFehler("Zu einem abgesagten oder abgelehnten Termin gibt es keinen Auftrag.");
  const kv = await kvAmTermin(terminId, "angenommen");
  if (kv) return auftragAusKv(terminId, kv, vonBenutzer);

  const offen = await kvAmTermin(terminId, "offen");
  const nummer = await nummerVergeben(terminId);
  const positionen = offen?.positionen.length ? offen.positionen : await positionenAusTermin(t);
  await db()
    .from("termine")
    .update({ auftrag_positionen: positionen, auftrag_summe_brutto_cent: bruttoVon(positionen), auftrag_beschreibung: t.notiz_kunde ?? "" })
    .eq("id", terminId)
    .is("auftrag_erteilt_am", null);
  await verlauf("termin", terminId, `Werkstattauftrag ${nummer} angelegt${offen?.positionen.length ? ` (Positionen aus Kostenvoranschlag ${offen.nummer})` : ""}`, vonBenutzer);
  const neu = (await terminLaden(terminId))!;
  after(() => melden("auftrag.angelegt", ereignisDaten(neu)));
  return nummer;
}

async function nummerVergeben(terminId: string): Promise<string> {
  const { data, error } = await dbRoh().rpc("auftrag_anlegen", { p_id: terminId });
  if (error) throw new Error(error.message.includes("NICHT_GEFUNDEN") ? "Termin nicht gefunden." : error.message);
  return data as string;
}

/**
 * Angenommener Kostenvoranschlag am Termin: Er wird der Auftrag (Positionen übernommen) und gilt als erteilt.
 * Ist der Auftrag schon erteilt, bleibt sein Inhalt; dann wird nur vermerkt.
 */
export async function auftragAusKv(terminId: string, kv: KvKurz, vonBenutzer: string | null): Promise<string> {
  const t = await terminLaden(terminId);
  if (!t) throw new TerminFehler("Termin nicht gefunden.");
  if (BEENDET.includes(t.status)) return t.auftrag_nummer ?? "";
  const neuAngelegt = !t.auftrag_nummer;
  const nummer = t.auftrag_nummer ?? (await nummerVergeben(terminId));
  if (!t.auftrag_erteilt_am && kv.positionen.length) {
    await db()
      .from("termine")
      .update({ auftrag_positionen: kv.positionen, auftrag_summe_brutto_cent: bruttoVon(kv.positionen), ...(neuAngelegt && { auftrag_beschreibung: t.notiz_kunde ?? "" }) })
      .eq("id", terminId)
      .is("auftrag_erteilt_am", null);
  }
  await verlauf("termin", terminId, `Werkstattauftrag ${nummer} ${neuAngelegt ? "aus" : "mit"} Kostenvoranschlag ${kv.nummer ?? ""}`.trim(), vonBenutzer);
  if (neuAngelegt) {
    const neu = (await terminLaden(terminId))!;
    after(() => melden("auftrag.angelegt", { ...ereignisDaten(neu), kostenvoranschlag_id: kv.id }));
  }
  await auftragErteilen(terminId, "kostenvoranschlag", { name: kv.empfaenger?.name ?? "", vonBenutzer, stumm: true, vorab: Boolean(kv.vorab_am) });
  return nummer;
}

/** Positionen und Kostengrenze aus dem Editor. Geht auch nach der Erteilung (Ergänzungen, ohne Nachtrag). */
export async function auftragSpeichern(terminId: string, a: { positionen: Position[]; kostengrenze_cent: number | null }, vonBenutzer: string): Promise<Termin> {
  const summe = bruttoVon(a.positionen);
  const { data, error } = await db()
    .from("termine")
    .update({ auftrag_positionen: a.positionen, auftrag_summe_brutto_cent: summe, auftrag_kostengrenze_cent: a.kostengrenze_cent })
    .eq("id", terminId)
    .not("auftrag_nummer", "is", null)
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new TerminFehler("Zu diesem Termin gibt es keinen Werkstattauftrag.");
  const t = (await terminLaden(terminId))!;
  const warnung = grenzeText(t);
  await verlauf("termin", terminId, `Werkstattauftrag geändert: ${euro(summe)}${warnung ? " (über der Kostengrenze)" : ""}`, vonBenutzer);
  return t;
}

/**
 * Der Kunde hat Mehrkosten über der Kostengrenze zugestimmt (Telefon, WhatsApp …): freigegeben ist die aktuelle
 * Summe. Wie, wann und von wem eingetragen, steht am Auftrag und im Verlauf, denn ohne nachweisbare Zustimmung
 * schuldet der Kunde den Mehrbetrag nicht. Kommt danach noch etwas dazu, warnt der Auftrag erneut.
 */
export async function mehrkostenFreigeben(terminId: string, wie: string, vonBenutzer: string): Promise<void> {
  const t = await terminLaden(terminId);
  if (!t?.auftrag_nummer) throw new TerminFehler("Zu diesem Termin gibt es keinen Werkstattauftrag.");
  if (!ueberKostengrenze(t)) throw new TerminFehler("Der Auftrag liegt nicht über der Kostengrenze.");
  const bis = t.auftrag_summe_brutto_cent ?? 0;
  const { error } = await db()
    .from("termine")
    .update({ auftrag_freigabe_bis_cent: bis, auftrag_freigabe_am: new Date().toISOString(), auftrag_freigabe_wie: wie, auftrag_freigabe_von: vonBenutzer })
    .eq("id", terminId);
  if (error) throw new DbFehler(error);
  const neu = (await terminLaden(terminId))!;
  await verlauf("termin", terminId, `${freigabeText(neu)} (Kostengrenze ${euro(t.auftrag_kostengrenze_cent ?? 0)})`, vonBenutzer);
  after(() => melden("auftrag.mehrkosten_freigegeben", { ...ereignisDaten(neu), freigegeben_bis_cent: bis, wie }));
}

/**
 * Fahrzeugannahme: Tank, Schlüssel, Vorschäden und was der Kunde beanstandet am Termin, km und Daten aus dem
 * Fahrzeugschein am Fahrzeug (dort gelten sie auch für spätere Termine). Nichts davon ist Pflicht.
 */
export async function annahmeSpeichern(
  terminId: string,
  e: { annahme: Annahme; km: number | null; beschreibung: string; fin: string; hsn: string; tsn: string; erstzulassung: string },
  vonBenutzer: string,
): Promise<void> {
  const { data: t } = await db().from("termine").select("fahrzeug_id").eq("id", terminId).maybeSingle();
  if (!t) throw new TerminFehler("Termin nicht gefunden.");
  const { error } = await db().from("termine").update({ annahme: e.annahme, km_stand: e.km, auftrag_beschreibung: e.beschreibung }).eq("id", terminId);
  if (error) throw new DbFehler(error);
  if (t.fahrzeug_id) {
    await db()
      .from("fahrzeuge")
      .update({ ...(e.km != null && { km_stand: e.km }), fin: e.fin, hsn: e.hsn, tsn: e.tsn, erstzulassung: e.erstzulassung })
      .eq("id", t.fahrzeug_id);
  }
  await verlauf("termin", terminId, "Fahrzeugannahme gespeichert", vonBenutzer);
}

/**
 * Der Kunde erteilt den Auftrag. Die Bedingung steht im Update selbst: Zwei gleichzeitige Erteilungen ergeben
 * eine. Danach bekommt der Kunde den Auftrag als PDF; erteilt er online, erfährt es das Büro per Push.
 * `stumm`: ohne Fehler, wenn schon erteilt (Kostenvoranschlag, der später verknüpft wird).
 */
export async function auftragErteilen(
  terminId: string,
  wie: ErteiltWie,
  o: { name?: string; bild?: string | null; vonBenutzer?: string | null; stumm?: boolean; vorab?: boolean } = {},
): Promise<void> {
  const t = await terminLaden(terminId);
  if (!t?.auftrag_nummer) throw new TerminFehler("Zu diesem Termin gibt es noch keinen Werkstattauftrag.");
  if (BEENDET.includes(t.status)) throw new TerminFehler("Dieser Termin ist abgesagt. Der Auftrag kann nicht mehr erteilt werden.");
  const { data, error } = await db()
    .from("termine")
    .update({
      auftrag_erteilt_am: new Date().toISOString(),
      auftrag_erteilt_wie: wie,
      auftrag_erteilt_name: (o.name ?? "").trim().slice(0, 120),
      auftrag_erteilt_brutto_cent: t.auftrag_summe_brutto_cent ?? 0,
      auftrag_erteilt_von: o.vonBenutzer ?? null,
      // Nachweis für § 356 Abs. 4 BGB: Der Kunde hat online verlangt, dass wir sofort anfangen.
      auftrag_vorab_am: o.vorab ? new Date().toISOString() : null,
    })
    .eq("id", terminId)
    .is("auftrag_erteilt_am", null)
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) {
    if (o.stumm) return;
    throw new TerminFehler("Der Auftrag ist schon erteilt.");
  }
  if (o.bild) await db().from("auftrag_unterschriften").upsert({ termin_id: terminId, bild: o.bild, erstellt_am: new Date().toISOString() });
  const neu = (await terminLaden(terminId))!;
  await verlauf("termin", terminId, erteiltText(neu), o.vonBenutzer ?? null);
  after(async () => {
    await Promise.all([
      melden("auftrag.erteilt", ereignisDaten(neu)),
      kundeBestaetigen(terminId),
      wie === "online"
        ? pushSenden(
            { rollen: ["inhaber", "buero"] },
            { titel: "Auftrag online erteilt", text: `${neu.kunde?.name ?? "Kunde"} · ${neu.auftrag_nummer} · ${euro(neu.auftrag_summe_brutto_cent ?? 0)}${neu.fahrzeug ? ` · ${neu.fahrzeug.kennzeichen}` : ""}`, url: `/app/termine/${terminId}`, tag: `auftrag-${terminId}` },
          )
        : Promise.resolve(),
    ]);
  });
}

/** Versehentlich erteilt (falsche Unterschrift, falscher Termin): zurück auf „nicht erteilt“. */
export async function erteilungZuruecknehmen(terminId: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("termine")
    .update({ auftrag_erteilt_am: null, auftrag_erteilt_wie: null, auftrag_erteilt_name: "", auftrag_erteilt_brutto_cent: null, auftrag_erteilt_von: null })
    .eq("id", terminId)
    .not("auftrag_erteilt_am", "is", null)
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new TerminFehler("Der Auftrag ist nicht erteilt.");
  await db().from("auftrag_unterschriften").delete().eq("termin_id", terminId);
  await verlauf("termin", terminId, "Erteilung des Werkstattauftrags zurückgenommen", vonBenutzer);
  const neu = (await terminLaden(terminId))!;
  after(() => melden("auftrag.zurueckgenommen", ereignisDaten(neu)));
}

export const auftragLink = (t: Pick<Termin, "token">) => `${ENV.siteUrl}/t/${t.token}#auftrag`;

export function auftragDateiname(t: Pick<Termin, "auftrag_nummer">): string {
  return `Werkstattauftrag-${(t.auftrag_nummer ?? "Entwurf").replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
}

/** Das PDF des Auftrags: dasselbe Layout wie Rechnung und Kostenvoranschlag. `vorschau` zeigt ungespeicherte Positionen. */
export async function auftragPdf(t: AuftragTermin, vorschau?: { positionen: Position[]; kostengrenze_cent: number | null }): Promise<Buffer> {
  const e = await einstellungen();
  const k = t.kundeVoll;
  const f = t.fahrzeugVoll;
  return rechnungPdf({
    art: "auftrag",
    nummer: t.auftrag_nummer ?? "ENTWURF",
    storno: false,
    rechnungsdatum: t.auftrag_angelegt_am ? berlinDatum(new Date(t.auftrag_angelegt_am)) : berlinDatum(),
    leistungsdatum: null,
    faellig_am: null,
    hinweis: "",
    positionen: vorschau?.positionen ?? t.auftrag_positionen ?? [],
    empfaenger: k ? { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, ust_id: k.ust_id } : { name: t.kunde?.name ?? "" },
    firma: e.firma,
    kundennummer: k?.nummer ?? null,
    fahrzeug: { kennzeichen: f?.kennzeichen ?? t.fahrzeug?.kennzeichen, ...(f ? markeUndModell(f) : {}), km: t.km_stand },
    einleitung: `Sehr geehrte Damen und Herren,\n${e.auftrag.einleitung}`,
    fusstext: e.auftrag.fusstext,
    bezahlt: false,
    auftrag: {
      termin: t.beginn ? `${datumZeit(t.beginn)} Uhr` : "wird noch vereinbart",
      telefon: k?.telefon ?? t.kunde?.telefon ?? "",
      beschreibung: t.auftrag_beschreibung ?? "",
      kostengrenze_cent: vorschau ? vorschau.kostengrenze_cent : (t.auftrag_kostengrenze_cent ?? null),
      annahme: annahmeZeilen(t.annahme, null, f),
      erteilt: erteiltText(t),
      ortDatum: t.auftrag_erteilt_am ? `${e.firma.ort}, ${datum(t.auftrag_erteilt_am)}` : "",
      name: t.auftrag_erteilt_name ?? "",
      unterschrift: t.unterschrift,
    },
  });
}

/** Auftrag zur Freigabe an den Kunden: PDF im Anhang, Knopf zum Terminlink, dort erteilt er ihn. */
export async function auftragVersenden(terminId: string, an: string, vonBenutzer: string): Promise<void> {
  const t = await auftragLaden(terminId);
  if (!t?.auftrag_nummer) throw new TerminFehler("Zu diesem Termin gibt es noch keinen Werkstattauftrag.");
  if (!t.auftrag_positionen?.length) throw new TerminFehler("Der Auftrag hat noch keine Positionen.");
  const { firma } = await einstellungen();
  const erteilt = Boolean(t.auftrag_erteilt_am);
  const { html, text } = mail(firma, {
    ueberschrift: erteilt ? `Ihr Werkstattauftrag ${t.auftrag_nummer}` : `Bitte bestätigen: Werkstattauftrag ${t.auftrag_nummer}`,
    bausteine: [
      {
        art: "absatz",
        text: `Hallo ${t.kunde?.name ?? ""},\n${erteilt ? "anbei Ihr Werkstattauftrag als PDF." : "anbei der Werkstattauftrag für Ihr Fahrzeug. Bitte prüfen Sie ihn und erteilen Sie uns den Auftrag mit einem Klick."}`,
      },
      { art: "fakten", zeilen: auftragFakten(t) },
      ...(erteilt ? [] : [{ art: "knopf" as const, text: "Ansehen und Auftrag erteilen", url: auftragLink(t) }]),
      { art: "absatz", text: `Fragen? Rufen Sie uns an: ${firma.telefon}` },
    ],
  });
  const ergebnis = await mailer().senden({
    an,
    betreff: `Werkstattauftrag ${t.auftrag_nummer} von ${firma.name}`,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: [{ dateiname: auftragDateiname(t), inhalt: await auftragPdf(t), typ: "application/pdf" }],
  });
  if (!ergebnis.ok) throw new Error(`Die Mail wurde nicht versendet: ${ergebnis.fehler}`);
  await db().from("termine").update({ auftrag_gesendet_am: new Date().toISOString(), auftrag_gesendet_an: an }).eq("id", terminId);
  await verlauf("termin", terminId, `Werkstattauftrag per E-Mail an ${an} gesendet`, vonBenutzer);
  after(() => melden("auftrag.versendet", { ...ereignisDaten(t), an }));
}

function auftragFakten(t: AuftragTermin): [string, string][] {
  return [
    ["Auftrag", t.auftrag_nummer ?? ""],
    ["Termin", terminText(t)],
    ...(t.fahrzeug ? ([["Fahrzeug", [t.fahrzeug.kennzeichen, t.fahrzeug.marke_modell].filter(Boolean).join(", ")]] as [string, string][]) : []),
    ["Betrag (voraussichtlich)", euro(t.auftrag_summe_brutto_cent ?? 0)],
    ...(t.auftrag_kostengrenze_cent != null ? ([["Kostengrenze", euro(t.auftrag_kostengrenze_cent)]] as [string, string][]) : []),
  ];
}

/** Nach der Erteilung: Bestätigung mit dem Auftrag als PDF (mit Unterschrift), wenn eine E-Mail bekannt ist. */
async function kundeBestaetigen(terminId: string): Promise<void> {
  const t = await auftragLaden(terminId);
  const an = t?.kundeVoll?.email || t?.kunde?.email;
  if (!t || !an) return;
  const { firma } = await einstellungen();
  // Nicht in der Werkstatt erteilt (online, über einen KV per Mail oder Telefon): Fernabsatz. Die Bestätigung auf
  // einem dauerhaften Datenträger muss dann die Widerrufsbelehrung und das Verlangen nach sofortigem Beginn
  // enthalten (§ 312f Abs. 2 BGB). Lieber einmal zu oft als zu selten: Bei Firmenkunden schadet sie nicht.
  const fernabsatz = t.auftrag_erteilt_wie !== "unterschrift";
  const { html, text } = mail(firma, {
    ueberschrift: "Danke für Ihren Auftrag.",
    bausteine: [
      { art: "absatz", text: `Hallo ${t.kunde?.name ?? ""},\nIhr Werkstattauftrag ist bei uns. Eine Kopie hängt als PDF an dieser Mail.` },
      { art: "fakten", zeilen: [...auftragFakten(t), ["Erteilt", erteiltText(t).replace(/^Erteilt am /, "")]] },
      { art: "knopf", text: "Termin und Auftrag ansehen", url: auftragLink(t) },
      ...(fernabsatz
        ? ([
            {
              art: "hinweis",
              text: `${t.auftrag_vorab_am ? `Sie haben am ${datumZeit(t.auftrag_vorab_am)} ausdrücklich verlangt, dass wir vor Ablauf der Widerrufsfrist mit den Arbeiten beginnen, und bestätigt, dass Ihr Widerrufsrecht erlischt, sobald der Auftrag vollständig ausgeführt ist. ` : ""}Es gelten unsere Allgemeinen Geschäftsbedingungen: ${ENV.siteUrl}/agb`,
            },
            { art: "klein", text: widerrufText(firma) },
          ] as const)
        : []),
    ],
  });
  const ergebnis = await mailer().senden({
    an,
    betreff: `Auftragsbestätigung ${t.auftrag_nummer} von ${firma.name}`,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: [{ dateiname: auftragDateiname(t), inhalt: await auftragPdf(t), typ: "application/pdf" }],
  });
  if (!ergebnis.ok) await fehlerMelden(new Error(`Auftragsbestätigung ${t.auftrag_nummer} nicht versendet: ${ergebnis.fehler}`), "Auftragsbestätigung an den Kunden");
}

/**
 * Die Werkstatt meldet „fertig“ (Team-App, Handy-App oder „Erledigt“ in der Verwaltung): Der Rechnungsentwurf
 * entsteht sofort aus dem Auftrag, das Büro bekommt (außer es meldet selbst) einen Push mit dem Weg dorthin. Scheitert das, bleibt
 * „fertig“ trotzdem stehen; der Entwurf lässt sich am Termin anlegen.
 */
export async function nachFertig(terminId: string, vonBenutzer: string, wer: string, push = true): Promise<string | null> {
  let rechnungId: string | null = null;
  try {
    rechnungId = await entwurfAusTermin(terminId, vonBenutzer);
  } catch (error) {
    await fehlerMelden(error, "Rechnungsentwurf nach „fertig“ anlegen");
  }
  const t = await terminLaden(terminId);
  if (!t) return rechnungId;
  after(async () => {
    await Promise.all([
      melden("auftrag.fertig", { ...ereignisDaten(t), rechnung_id: rechnungId }),
      // Meldet das Büro selbst „erledigt“, braucht es keinen Push an sich.
      push
        ? pushSenden(
            { rollen: ["inhaber", "buero"] },
            {
              titel: "Auftrag fertig",
              text: `${wer}: ${t.leistung_name}${t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}${rechnungId ? " · Rechnungsentwurf liegt bereit" : ""}`,
              url: rechnungId ? `/app/rechnungen/${rechnungId}` : `/app/termine/${terminId}`,
              tag: `auftrag-${terminId}`,
            },
          )
        : Promise.resolve(),
    ]);
  });
  return rechnungId;
}
