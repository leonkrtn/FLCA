import "server-only";
import { after } from "next/server";
import { einstellungen, type Einstellungen } from "./einstellungen";
import { ENV } from "./env";
import { melden, verlauf } from "./ereignisse";
import { datumLangText, kennzeichen as kennzeichenFormat, telHref, zeit } from "./format";
import { ics } from "./ics";
import { mail } from "./email/vorlagen";
import { mailer } from "./services/email";
import { pushSenden } from "./services/push";
import { belegungenAm, belegungenMitPerson, leistungNamen, planPersonen, planungAktiv } from "./mitarbeiter";
import { besteFreiePerson, freieSlotsMitPersonen, konflikte, type PersonSlot } from "./planung";
import { arbeitsende, type Belegung, freieSlots, type Slot } from "./slots";
import { db, DbFehler, dbRoh, pruefe } from "./supabase/admin";
import { berlin, berlinDatum, berlinUhrzeit, minuten, plusTage, uhrzeit as uhrzeitAus, wochentag } from "./zeit";
import { markeModellTrennen } from "./rechnung/aehnlich";
import type { AuftragFelder } from "./auftrag-regeln";
import { angebotsPreiseFesthalten } from "./angebote/daten";
import type { AngebotsPreis, GebuchterAngebotsPreis } from "./angebote/preise";

export type Leistung = {
  id: string;
  slug: string;
  name: string;
  kurz: string;
  beschreibung: string;
  kategorie: string;
  preis_cent: number | null;
  preis_ab: boolean;
  dauer_min: number;
  online_anfragbar: boolean;
  sichtbar: boolean;
  sortierung: number;
  bild_pfad: string | null;
  /** Felder für Rechnungen (seit der Migration „angebot“; in den Startdaten nicht vorhanden). */
  nummer?: string;
  einheit?: string;
  mwst_satz?: number;
  /** „leistung“ = Arbeit mit Dauer (Website, Termine); „position“ = Teil, Material, Zuschlag (nur Rechnung). */
  art?: "leistung" | "position";
  aktiv?: boolean;
  /** Weitere Namen, unter denen die Spracheingabe den Eintrag erkennt (seit der Migration „sprachnamen“). */
  sprachnamen?: string[];
  /** Nur für die Anzeige (Website): laufendes Angebot. preis_cent ist dann schon der Angebotspreis. */
  angebot?: AngebotsPreis | null;
};

/** Was als Termin eingetragen werden kann: Leistungen, keine Teile, nichts Ausgeblendetes. */
export const istTerminLeistung = (l: Pick<Leistung, "art" | "aktiv">) => (l.art ?? "leistung") === "leistung" && l.aktiv !== false;

export type Termin = {
  id: string;
  nummer: number;
  status: "angefragt" | "bestaetigt" | "abgelehnt" | "storniert" | "erledigt" | "nicht_erschienen";
  beginn: string;
  ende: string;
  belegt_bis: string;
  leistung_id: string | null;
  /** Alle Leistungen des Termins (seit der Migration „mehrere_leistungen“, vorher fehlt das Feld). */
  leistung_ids?: string[];
  /** Namen aller Leistungen, mit Komma getrennt (bei frei eingetragener Arbeit auch deren Text). */
  leistung_name: string;
  notiz_kunde: string;
  notiz_intern: string;
  quelle: string;
  token: string;
  halten_bis: string | null;
  zugewiesen_an: string | null;
  auftrag_status: "offen" | "in_arbeit" | "fertig";
  km_stand: number | null;
  absage_grund: string;
  /** Am Tag der Anfrage geltende Angebotspreise je Leistung (seit der Migration „angebote“). */
  angebot_preise?: Record<string, GebuchterAngebotsPreis>;
  erstellt_am: string;
  /** Seit der Migration „gegenvorschlag“: War die Wunschzeit frei, ursprüngliche Wunschzeit, offener Vorschlag */
  wunschzeit_frei?: boolean;
  wunsch_beginn?: string | null;
  vorschlag_am?: string | null;
  vorschlag_nachricht?: string;
  kunde: { id: string; name: string; email: string; telefon: string; firma: string } | null;
  fahrzeug: { id: string; kennzeichen: string; marke_modell: string } | null;
  mitarbeiter: { id: string; name: string } | null;
} & AuftragFelder;

// Der Fremdschlüssel ist ausgeschrieben, weil termine mehrfach auf profile zeigt (zugewiesen_an, auftrag_erteilt_von).
// Ohne ihn kann PostgREST die Verbindung nicht zuordnen und jede Abfrage schlägt fehl.
export const TERMIN_FELDER =
  "*, kunde:kunden(id, name, email, telefon, firma), fahrzeug:fahrzeuge(id, kennzeichen, marke_modell), mitarbeiter:profile!termine_zugewiesen_an_fkey(id, name)";

export const STATUS_TEXT: Record<Termin["status"], string> = {
  angefragt: "Angefragt",
  bestaetigt: "Bestätigt",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
  erledigt: "Erledigt",
  nicht_erschienen: "Nicht erschienen",
};

export class TerminFehler extends Error {}

/**
 * Die gewählte Person passt nicht (arbeitet nicht, ist abwesend, darf die Leistung nicht, hat schon etwas).
 * In der Verwaltung nur eine Warnung: Mit „trotzdem“ wird gespeichert.
 */
export class PlanungsWarnung extends TerminFehler {
  constructor(readonly gruende: string[]) {
    super(gruende.join(" "));
  }
}

/** Fehlermeldungen der Datenbankfunktionen in Sätze für Menschen übersetzen. */
function dbFehler(error: unknown, intern = false): never {
  const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  // In der Verwaltung ist „voll“ nur eine Warnung, die sich mit „Trotzdem speichern“ übergehen lässt.
  if (intern && text.includes("SLOT_BELEGT")) throw new PlanungsWarnung(["Zu der Zeit ist die Werkstatt voll (alle Arbeitsplätze belegt)."]);
  if (text.includes("PERSON_BELEGT")) throw new PlanungsWarnung(["Der Mitarbeiter hat zu der Zeit schon einen anderen Termin."]);
  if (text.includes("SLOT_BELEGT")) throw new TerminFehler("Dieser Termin ist inzwischen vergeben. Bitte wählen Sie eine andere Uhrzeit.");
  if (text.includes("FALSCHER_STATUS")) throw new TerminFehler("Der Termin wurde in der Zwischenzeit schon bearbeitet.");
  if (text.includes("NICHT_GEFUNDEN")) throw new TerminFehler("Termin nicht gefunden.");
  // Alles andere ist ein Fehler im System, kein Planungsproblem: mit Ursache und Abhilfe weiterreichen.
  throw error instanceof Error ? error : new DbFehler(error as { message: string; code?: string });
}

export async function leistungen(nurSichtbar = true): Promise<Leistung[]> {
  let q = db().from("leistungen").select("*").order("sortierung");
  if (nurSichtbar) q = q.eq("sichtbar", true);
  return pruefe<Leistung[]>(await q);
}

/** Höchstens so viele Leistungen pro Termin; mehr passt ohnehin nicht in einen Werkstatttag. */
export const MAX_LEISTUNGEN = 8;

/** Leistungen eines Termins in der Reihenfolge der Preisliste, doppelte und unbekannte fallen weg. */
export async function terminLeistungen(ids: string[], nurOnline = false): Promise<Leistung[]> {
  const eindeutig = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)))].slice(0, MAX_LEISTUNGEN);
  if (!eindeutig.length) return [];
  let q = db().from("leistungen").select("*").in("id", eindeutig).order("sortierung");
  if (nurOnline) q = q.eq("sichtbar", true).eq("online_anfragbar", true);
  return pruefe<Leistung[]>(await q).filter(istTerminLeistung);
}

/** Gesamtdauer: Die Arbeiten laufen nacheinander am selben Auto. */
export const gesamtDauer = (l: Pick<Leistung, "dauer_min">[]) => l.reduce((s, x) => s + x.dauer_min, 0);

export async function terminLaden(id: string): Promise<Termin | null> {
  // Fehler weiterreichen statt null: Sonst sieht eine kaputte Abfrage aus wie „Termin nicht gefunden“.
  return pruefe<Termin | null>(await db().from("termine").select(TERMIN_FELDER).eq("id", id).maybeSingle());
}

export async function terminPerToken(token: string): Promise<Termin | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return pruefe<Termin | null>(await db().from("termine").select(TERMIN_FELDER).eq("token", token).maybeSingle());
}

// ---------------------------------------------------------------------------
// Freie Termine
// ---------------------------------------------------------------------------

/** Belegte Zeiten: bestätigte Termine und Anfragen, deren Haltezeit noch läuft (wie belegung_max in der Datenbank). */
async function belegungen(von: Date, bis: Date): Promise<(Belegung & { id: string })[]> {
  const termine = await db()
    .from("termine")
    .select("id, beginn, belegt_bis, status, halten_bis")
    .in("status", ["angefragt", "bestaetigt"])
    .lt("beginn", bis.toISOString())
    .gt("belegt_bis", von.toISOString());
  const jetzt = Date.now();
  return pruefe<{ id: string; beginn: string; belegt_bis: string; status: string; halten_bis: string | null }[]>(termine)
    .filter((t) => t.status === "bestaetigt" || !t.halten_bis || new Date(t.halten_bis).getTime() > jetzt)
    .map((t) => ({ id: t.id, beginn: new Date(t.beginn).getTime(), bis: new Date(t.belegt_bis).getTime(), gewicht: 1 }));
}

/**
 * Ein Tag für die Terminwahl. `slots`: frei (sofort zu halten). `anfragbar`: alle anderen Startzeiten in der
 * Öffnungszeit, zu denen die Arbeit am selben Tag fertig würde; die sind belegt, lassen sich aber trotzdem
 * anfragen (der Betrieb sagt zu, lehnt ab oder schlägt eine andere Zeit vor).
 */
export type Tagesangebot = { datum: string; slots: string[]; anfragbar: string[] };

/** Was für freie Zeiten zählt: Dauer und (für die Mitarbeiterplanung) welche Leistungen. */
export type Bedarf = { dauer_min: number; ids?: string[] };

const fensterAm = (e: Einstellungen, datum: string) => e.oeffnungszeiten[String(wochentag(datum)) as keyof Einstellungen["oeffnungszeiten"]] ?? [];

/**
 * Freie Startzeiten eines Datumsbereichs. Nimmt jemand Aufträge an, muss zusätzlich ein passender Mitarbeiter
 * frei sein (planung.ts); sonst zählen wie früher nur Öffnungszeiten und Arbeitsplätze.
 */
async function slotsImBereich(bedarf: Bedarf, start: string, bisDatum: string, e: Einstellungen, ausser?: string): Promise<Map<string, PersonSlot[]>> {
  const { buchung } = e;
  const fruehestens = new Date(Date.now() + buchung.vorlaufStd * 3600000);
  const ergebnis = new Map<string, PersonSlot[]>();
  const mitPersonen = await planungAktiv();
  const [geladen, personen] = await Promise.all([
    mitPersonen ? belegungenMitPerson(berlin(start), berlin(bisDatum)) : belegungen(berlin(start), berlin(bisDatum)),
    mitPersonen ? planPersonen(start, bisDatum) : Promise.resolve([]),
  ]);
  // Ein Termin, der umgeplant wird, belegt seine eigene Zeit nicht
  const alle = ausser ? geladen.filter((b) => b.id !== ausser) : geladen;
  for (let d = start; d < bisDatum; d = plusTage(d, 1)) {
    const fenster = fensterAm(e, d);
    if (!fenster.length) {
      ergebnis.set(d, []);
      continue;
    }
    const basis = { dauerMin: bedarf.dauer_min, pufferMin: buchung.pufferMin, rasterMin: buchung.rasterMin, kapazitaet: buchung.kapazitaet, fruehestens };
    ergebnis.set(
      d,
      mitPersonen
        ? freieSlotsMitPersonen({ ...basis, datum: d, oeffnung: fenster, personen, leistungIds: bedarf.ids ?? [], belegungen: alle as Awaited<ReturnType<typeof belegungenMitPerson>> })
        : freieSlots({ ...basis, datum: d, fenster, belegungen: alle }).map((s) => ({ ...s, kandidaten: [] })),
    );
  }
  return ergebnis;
}

/** Freie Startzeiten für eine oder mehrere Leistungen in einem Datumsbereich. */
export async function freieTermine(bedarf: Bedarf, vonDatum: string, tage: number, e?: Einstellungen): Promise<Tagesangebot[]> {
  const einst = e ?? (await einstellungen());
  const heute = berlinDatum();
  const letzter = plusTage(heute, einst.buchung.maxTage);
  const start = vonDatum < heute ? heute : vonDatum;
  const ende = plusTage(start, tage);
  const bisDatum = ende > letzter ? plusTage(letzter, 1) : ende;
  if (start > letzter) return [];
  const slots = await slotsImBereich(bedarf, start, bisDatum, einst);
  return [...slots].map(([datum, liste]) => {
    const frei = liste.map((s) => zeit(s.beginn));
    return { datum, slots: frei, anfragbar: moeglicheZeiten(bedarf, datum, einst).filter((z) => !frei.includes(z)) };
  });
}

/** Alle Startzeiten im Raster der Öffnungszeit, zu denen die Arbeit am selben Tag fertig würde (ohne Belegung). */
function moeglicheZeiten(bedarf: Bedarf, datum: string, e: Einstellungen): string[] {
  const fenster = fensterAm(e, datum);
  const fruehestens = Date.now() + e.buchung.vorlaufStd * 3600000;
  const zeiten: string[] = [];
  for (const [von, bis] of fenster) {
    for (let start = minuten(von); start < minuten(bis); start += e.buchung.rasterMin) {
      if (arbeitsende(fenster, start, bedarf.dauer_min) === null) continue;
      if (berlin(datum, uhrzeitAus(start)).getTime() < fruehestens) continue;
      zeiten.push(uhrzeitAus(start));
    }
  }
  return zeiten;
}

/** Zeitraum einer Anfrage zu einer belegten Zeit: wie ein freier Slot, Pausen der Öffnungszeit übersprungen. */
function zeitraumInOeffnung(bedarf: Bedarf, datum: string, uhr: string, e: Einstellungen): Slot | null {
  if (!moeglicheZeiten(bedarf, datum, e).includes(uhr)) return null;
  const endeMin = arbeitsende(fensterAm(e, datum), minuten(uhr), bedarf.dauer_min)!;
  const ende = berlin(datum, uhrzeitAus(endeMin));
  return { beginn: berlin(datum, uhr), ende, bis: new Date(ende.getTime() + e.buchung.pufferMin * 60000) };
}

/** Zeitraum für einen frei gewählten Termin (Admin), auch außerhalb des Rasters. */
export function zeitraum(datum: string, uhrzeit: string, dauerMin: number, pufferMin: number): Slot {
  const beginn = berlin(datum, uhrzeit);
  const ende = new Date(beginn.getTime() + dauerMin * 60000);
  return { beginn, ende, bis: new Date(ende.getTime() + pufferMin * 60000) };
}

// ---------------------------------------------------------------------------
// Kunden und Fahrzeuge
// ---------------------------------------------------------------------------

export async function kundeFindenOderAnlegen(k: { name: string; email: string; telefon: string; firma?: string }): Promise<string> {
  const email = k.email.trim().toLowerCase();
  const telefon = k.telefon.trim();
  let gefunden: { id: string } | null = null;
  if (email) {
    const { data } = await db().from("kunden").select("id").ilike("email", email).limit(1).maybeSingle();
    gefunden = data;
  }
  if (!gefunden && telefon) {
    const { data } = await db().from("kunden").select("id").eq("telefon", telefon).limit(1).maybeSingle();
    gefunden = data;
  }
  if (gefunden) {
    await db()
      .from("kunden")
      .update({ name: k.name, ...(email && { email }), ...(telefon && { telefon }) })
      .eq("id", gefunden.id);
    return gefunden.id;
  }
  const neu = pruefe(
    await db().from("kunden").insert({ name: k.name, email, telefon, firma: k.firma ?? "" }).select("id, nummer").single(),
  );
  await melden("kunde.angelegt", { kunde_id: neu.id, nummer: neu.nummer, name: k.name });
  return neu.id;
}

/**
 * Kunde, der im Formular aus der Kartei gewählt wurde: Der Termin hängt genau an ihm. Was dort eingetragen
 * ist (Name, Telefon, E-Mail), übernimmt die Kartei; leere Felder löschen nichts.
 */
export async function gewaehlterKunde(id: string, k: { name: string; email: string; telefon: string }): Promise<string> {
  const { data } = await db().from("kunden").select("id").eq("id", id).maybeSingle();
  if (!data) throw new TerminFehler("Der gewählte Kunde ist nicht mehr in der Kartei. Bitte neu wählen.");
  const email = k.email.trim().toLowerCase();
  const telefon = k.telefon.trim();
  const aenderung = { ...(k.name.trim() && { name: k.name.trim() }), ...(email && { email }), ...(telefon && { telefon }) };
  if (Object.keys(aenderung).length) await db().from("kunden").update(aenderung).eq("id", id);
  return id;
}

/** Gewähltes Fahrzeug, wenn es zu diesem Kunden gehört; sonst über das Kennzeichen wie bisher. */
async function gewaehltesFahrzeug(fahrzeugId: string | null | undefined, kennzeichen: string, kundeId: string, markeModell = ""): Promise<string | null> {
  if (fahrzeugId) {
    const { data } = await db().from("fahrzeuge").select("id").eq("id", fahrzeugId).eq("kunde_id", kundeId).maybeSingle();
    if (data) return data.id;
  }
  return fahrzeugFindenOderAnlegen(kennzeichen, kundeId, markeModell);
}

export async function fahrzeugFindenOderAnlegen(kennzeichen: string, kundeId: string, markeModell = ""): Promise<string | null> {
  const kz = kennzeichenFormat(kennzeichen);
  if (!kz) return null;
  const norm = kz.replace(/[^A-ZÄÖÜ0-9]/g, "");
  const { data } = await db().from("fahrzeuge").select("id, marke_modell").eq("kennzeichen_norm", norm).maybeSingle();
  if (data) {
    await db()
      .from("fahrzeuge")
      .update({ kunde_id: kundeId, kennzeichen: kz, ...(markeModell && !data.marke_modell && { marke_modell: markeModell, ...markeModellTrennen(markeModell) }) })
      .eq("id", data.id);
    return data.id;
  }
  // Die Website hat nur ein Feld „Marke/Modell“; getrennt wird geschätzt und ist im Beleg änderbar.
  return pruefe(await db().from("fahrzeuge").insert({ kennzeichen: kz, kunde_id: kundeId, marke_modell: markeModell, ...markeModellTrennen(markeModell) }).select("id").single()).id;
}

// ---------------------------------------------------------------------------
// Mails rund um den Termin
// ---------------------------------------------------------------------------

function terminLink(t: Pick<Termin, "token">) {
  return `${ENV.siteUrl}/t/${t.token}`;
}

function terminFakten(t: Termin, firma: Einstellungen["firma"]): [string, string][] {
  return [
    [(t.leistung_ids?.length ?? 0) > 1 ? "Leistungen" : "Leistung", t.leistung_name],
    ["Wann", `${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr`],
    ...(t.fahrzeug ? ([["Fahrzeug", [t.fahrzeug.kennzeichen, t.fahrzeug.marke_modell].filter(Boolean).join(", ")]] as [string, string][]) : []),
    ["Wo", `${firma.strasse}, ${firma.plz} ${firma.ort}`],
  ];
}

async function kundenMail(t: Termin, art: "eingang" | "eingang_eng" | "gegenvorschlag" | "bestaetigt" | "abgelehnt" | "storniert" | "verschoben" | "erinnerung") {
  if (!t.kunde?.email) return;
  const { firma, buchung } = await einstellungen();
  const fakten = terminFakten(t, firma);
  const link = terminLink(t);
  const inhalte = {
    eingang: {
      betreff: `Ihre Terminanfrage: ${t.leistung_name}`,
      ueberschrift: "Danke, Ihre Anfrage ist da.",
      bausteine: [
        { art: "absatz" as const, text: `Hallo ${t.kunde.name},\nwir haben Ihre Anfrage erhalten und halten den Termin für Sie frei. Sie bekommen eine zweite Mail, sobald wir ihn bestätigt haben, meist am selben Tag.` },
        { art: "fakten" as const, zeilen: fakten },
        { art: "knopf" as const, text: "Anfrage ansehen", url: link },
      ],
    },
    eingang_eng: {
      betreff: `Ihre Terminanfrage: ${t.leistung_name}`,
      ueberschrift: "Danke, Ihre Anfrage ist da.",
      bausteine: [
        {
          art: "absatz" as const,
          text: `Hallo ${t.kunde.name},\nzu Ihrer Wunschzeit ist es bei uns eng. Wir schauen, ob es trotzdem klappt, und melden uns meist am selben Tag: mit einer Zusage oder einem anderen Terminvorschlag.`,
        },
        { art: "fakten" as const, zeilen: fakten },
        { art: "knopf" as const, text: "Anfrage ansehen", url: link },
      ],
    },
    gegenvorschlag: {
      betreff: `Unser Vorschlag: ${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr`,
      ueberschrift: "Wie wäre es mit diesem Termin?",
      bausteine: [
        {
          art: "absatz" as const,
          text: `Hallo ${t.kunde.name},\n${t.wunsch_beginn ? `am ${datumLangText(t.wunsch_beginn)} um ${zeit(t.wunsch_beginn)} Uhr` : "zu Ihrer Wunschzeit"} klappt es leider nicht. Wir schlagen Ihnen diesen Termin vor und halten ihn für Sie frei${t.halten_bis ? ` bis ${datumLangText(t.halten_bis)}, ${zeit(t.halten_bis)} Uhr` : ""}.`,
        },
        { art: "fakten" as const, zeilen: fakten },
        ...(t.vorschlag_nachricht ? [{ art: "hinweis" as const, text: t.vorschlag_nachricht }] : []),
        { art: "knopf" as const, text: "Vorschlag annehmen oder ablehnen", url: link },
        { art: "absatz" as const, text: `Oder rufen Sie uns an: ${firma.telefon}` },
      ],
    },
    bestaetigt: {
      betreff: `Termin bestätigt: ${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr`,
      ueberschrift: "Ihr Termin steht.",
      bausteine: [
        { art: "absatz" as const, text: `Hallo ${t.kunde.name},\nwir haben Ihren Termin bestätigt. Die Kalenderdatei hängt an dieser Mail.` },
        { art: "fakten" as const, zeilen: fakten },
        { art: "hinweis" as const, text: firma.hinweisAnfahrt },
        { art: "knopf" as const, text: "Termin ansehen oder absagen", url: link },
        { art: "absatz" as const, text: `Absagen ist bis ${buchung.stornoFristStd} Stunden vorher kostenlos über den Link möglich.` },
      ],
    },
    verschoben: {
      betreff: `Neuer Termin: ${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr`,
      ueberschrift: "Ihr Termin wurde verschoben.",
      bausteine: [
        { art: "absatz" as const, text: `Hallo ${t.kunde.name},\nIhr Termin hat eine neue Uhrzeit. Die aktualisierte Kalenderdatei hängt an.` },
        { art: "fakten" as const, zeilen: fakten },
        { art: "knopf" as const, text: "Termin ansehen", url: link },
      ],
    },
    abgelehnt: {
      betreff: `Ihre Terminanfrage: ${t.leistung_name}`,
      ueberschrift: "Zu dieser Zeit klappt es leider nicht.",
      bausteine: [
        {
          art: "absatz" as const,
          text: `Hallo ${t.kunde.name},\nden angefragten Termin am ${datumLangText(t.beginn)} um ${zeit(t.beginn)} Uhr können wir leider nicht annehmen.${t.absage_grund ? `\n\n${t.absage_grund}` : ""}`,
        },
        { art: "knopf" as const, text: "Anderen Termin wählen", url: `${ENV.siteUrl}/termin` },
        { art: "absatz" as const, text: `Oder rufen Sie uns an: ${firma.telefon}` },
      ],
    },
    storniert: {
      betreff: `Termin abgesagt: ${datumLangText(t.beginn)}`,
      ueberschrift: "Ihr Termin ist abgesagt.",
      bausteine: [
        { art: "absatz" as const, text: `Hallo ${t.kunde.name},\nder folgende Termin ist abgesagt.` },
        { art: "fakten" as const, zeilen: fakten },
        { art: "knopf" as const, text: "Neuen Termin anfragen", url: `${ENV.siteUrl}/termin` },
      ],
    },
    erinnerung: {
      betreff: `Erinnerung: morgen ${zeit(t.beginn)} Uhr bei ${firma.name}`,
      ueberschrift: "Bis morgen.",
      bausteine: [
        { art: "absatz" as const, text: `Hallo ${t.kunde.name},\nwir erinnern Sie an Ihren Termin.` },
        { art: "fakten" as const, zeilen: fakten },
        { art: "hinweis" as const, text: firma.hinweisAnfahrt },
        { art: "knopf" as const, text: "Termin ansehen oder absagen", url: link },
      ],
    },
  }[art];

  const { html, text } = mail(firma, { ueberschrift: inhalte.ueberschrift, bausteine: inhalte.bausteine });
  const mitKalender = art === "bestaetigt" || art === "verschoben" || art === "storniert";
  const ergebnis = await mailer().senden({
    an: t.kunde.email,
    betreff: inhalte.betreff,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: mitKalender
      ? [
          {
            dateiname: "termin.ics",
            typ: "text/calendar",
            inhalt: Buffer.from(
              ics({
                uid: t.id,
                beginn: new Date(t.beginn),
                ende: new Date(t.ende),
                titel: `${t.leistung_name} bei ${firma.name}`,
                ort: `${firma.name}, ${firma.strasse}, ${firma.plz} ${firma.ort}`,
                beschreibung: `${firma.hinweisAnfahrt}\nTermin ansehen: ${link}\nTelefon: ${firma.telefon}`,
                storniert: art === "storniert",
              }),
            ),
          },
        ]
      : undefined,
  });
  if (!ergebnis.ok) console.warn(`Mail „${art}“ zu Termin ${t.nummer} nicht versendet: ${ergebnis.fehler}`);
}

async function betriebBenachrichtigen(t: Termin, art: "neu" | "storniert" | "vorschlag_ja" | "vorschlag_nein") {
  const { firma, benachrichtigung } = await einstellungen();
  const titel = {
    neu: `Neue Anfrage${t.wunschzeit_frei === false ? " (Wunschzeit belegt)" : ""}: ${t.leistung_name}`,
    storniert: `Kunde hat abgesagt: ${t.leistung_name}`,
    vorschlag_ja: `Vorschlag angenommen: ${t.leistung_name}`,
    vorschlag_nein: `Vorschlag passt dem Kunden nicht: ${t.leistung_name}`,
  }[art];
  const text = `${t.kunde?.name ?? "Kunde"} · ${datumLangText(t.beginn)} ${zeit(t.beginn)} Uhr${t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}`;
  await Promise.all([
    pushSenden({ rollen: ["inhaber", "buero"] }, { titel, text, url: `/app/termine/${t.id}`, tag: `termin-${t.id}` }),
    (async () => {
      const { html, text: klartext } = mail(firma, {
        ueberschrift: titel,
        gruss: false,
        bausteine: [
          {
            art: "fakten",
            zeilen: [
              ...terminFakten(t, firma).slice(0, 3),
              ["Kunde", t.kunde?.name ?? ""],
              ["Telefon", t.kunde?.telefon ?? ""],
              ["E-Mail", t.kunde?.email ?? ""],
              ...(t.notiz_kunde ? ([["Notiz", t.notiz_kunde]] as [string, string][]) : []),
            ],
          },
          { art: "knopf", text: art === "neu" ? "Anfrage öffnen" : "Termin öffnen", url: `${ENV.siteUrl}/admin/termine/${t.id}` },
          ...(t.kunde?.telefon ? [{ art: "absatz" as const, text: `Anrufen: ${telHref(t.kunde.telefon).replace("tel:", "")}` }] : []),
        ],
      });
      const an = benachrichtigung.emails.length ? benachrichtigung.emails : [firma.email];
      await mailer().senden({ an, betreff: titel, html, text: klartext, antwortAn: t.kunde?.email || undefined });
    })(),
  ]);
}

const ereignisDaten = (t: Termin) => ({
  termin_id: t.id,
  nummer: t.nummer,
  status: t.status,
  beginn: t.beginn,
  ende: t.ende,
  leistung: t.leistung_name,
  leistung_ids: t.leistung_ids ?? (t.leistung_id ? [t.leistung_id] : []),
  kunde: t.kunde ? { id: t.kunde.id, name: t.kunde.name, email: t.kunde.email, telefon: t.kunde.telefon } : null,
  kennzeichen: t.fahrzeug?.kennzeichen ?? null,
  mitarbeiter: t.mitarbeiter ? { id: t.mitarbeiter.id, name: t.mitarbeiter.name } : null,
});

/**
 * Mitarbeiter über ihre Aufträge informieren (Push in der Team-App). Bescheid bekommt nur, wer einen
 * bestätigten Termin hat: Anfragen sind noch nicht sicher und erscheinen dort auch nicht.
 */
async function personBenachrichtigen(profil: string | null | undefined, t: Termin, art: "neu" | "geaendert" | "entfaellt") {
  if (!profil) return;
  const titel = { neu: "Neuer Auftrag für dich", geaendert: "Auftrag geändert", entfaellt: "Auftrag entfällt" }[art];
  const text = `${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr · ${t.leistung_name}${t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}`;
  await pushSenden({ profile: [profil] }, { titel, text, url: "/team/woche", tag: `auftrag-${t.id}` });
}

// ---------------------------------------------------------------------------
// Abläufe
// ---------------------------------------------------------------------------

export type AnfrageEingabe = {
  leistungIds: string[];
  datum: string;
  uhrzeit: string;
  name: string;
  email: string;
  telefon: string;
  kennzeichen: string;
  fahrzeug?: string;
  notiz?: string;
};

/** Anfrage von der Website: hält den Slot, bis der Betrieb bestätigt (Standard 48 Stunden). */
export async function anfrageStellen(e: AnfrageEingabe): Promise<Termin> {
  const einst = await einstellungen();
  if (!einst.buchung.aktiv) throw new TerminFehler("Online-Anfragen sind gerade pausiert. Bitte rufen Sie uns an.");
  const gewaehlt = await terminLeistungen(e.leistungIds, true);
  if (!gewaehlt.length) throw new TerminFehler("Bitte mindestens eine Leistung wählen.");
  if (gewaehlt.length !== new Set(e.leistungIds).size) throw new TerminFehler("Eine der gewählten Leistungen kann nicht online angefragt werden.");
  const { termin, eng } = await anfrageSpeichern(
    {
      bedarf: { dauer_min: gesamtDauer(gewaehlt), ids: gewaehlt.map((l) => l.id) },
      leistungen: gewaehlt,
      leistungName: gewaehlt.map((l) => l.name).join(", "),
      datum: e.datum,
      uhrzeit: e.uhrzeit,
      notiz: e.notiz ?? "",
      kontakt: async () => {
        const kundeId = await kundeFindenOderAnlegen({ name: e.name, email: e.email, telefon: e.telefon });
        return { kundeId, fahrzeugId: await fahrzeugFindenOderAnlegen(e.kennzeichen, kundeId, e.fahrzeug) };
      },
    },
    einst,
  );
  after(async () => {
    await Promise.all([kundenMail(termin, eng ? "eingang_eng" : "eingang"), betriebBenachrichtigen(termin, "neu"), melden("termin.angefragt", { ...ereignisDaten(termin), wunschzeit_frei: !eng })]);
  });
  return termin;
}

/**
 * Was ein Kostenvoranschlag an Werkstattzeit braucht: die Leistungen aus der Preisliste unter seinen Positionen
 * (mit ihrer Dauer). Stehen nur Teile oder freie Texte drin, gilt eine Stunde.
 */
export async function bedarfAusPositionen(artikelIds: (string | null | undefined)[]): Promise<{ bedarf: Bedarf; leistungen: Leistung[] }> {
  const leistungen = await terminLeistungen(artikelIds.filter((x): x is string => Boolean(x)));
  return { bedarf: { dauer_min: leistungen.length ? gesamtDauer(leistungen) : 60, ids: leistungen.map((l) => l.id) }, leistungen };
}

/**
 * Der Kunde hat einen Kostenvoranschlag angenommen und wählt über seinen Link gleich einen Termin: eine Anfrage
 * wie von der Website, mit Kunde und Fahrzeug aus dem Kostenvoranschlag. Verknüpft (und damit zum erteilten
 * Auftrag) wird sie vom Aufrufer über kvMitTerminVerknuepfen.
 */
export async function anfrageAusKv(
  kv: { nummer: string | null; kunde_id: string | null; empfaenger: { name: string; email?: string }; fahrzeug: { kennzeichen?: string; marke?: string; modell?: string }; positionen: { artikel_id?: string | null }[] },
  datum: string,
  uhrzeit: string,
): Promise<Termin> {
  const einst = await einstellungen();
  if (!einst.buchung.aktiv) throw new TerminFehler("Online-Termine sind gerade pausiert. Bitte rufen Sie uns an.");
  const { bedarf, leistungen: gewaehlt } = await bedarfAusPositionen(kv.positionen.map((p) => p.artikel_id));
  const { termin, eng } = await anfrageSpeichern(
    {
      bedarf,
      leistungen: [],
      leistungName: gewaehlt.map((l) => l.name).join(", ") || `Arbeiten laut Kostenvoranschlag ${kv.nummer ?? ""}`.trim(),
      datum,
      uhrzeit,
      notiz: `Zum Kostenvoranschlag ${kv.nummer ?? ""}`.trim(),
      kontakt: async () => {
        const kundeId = kv.kunde_id ?? (await kundeFindenOderAnlegen({ name: kv.empfaenger.name, email: kv.empfaenger.email ?? "", telefon: "" }));
        const markeModell = [kv.fahrzeug?.marke, kv.fahrzeug?.modell].filter(Boolean).join(" ");
        return { kundeId, fahrzeugId: await fahrzeugFindenOderAnlegen(kv.fahrzeug?.kennzeichen ?? "", kundeId, markeModell) };
      },
    },
    einst,
  );
  after(async () => {
    await Promise.all([kundenMail(termin, eng ? "eingang_eng" : "eingang"), betriebBenachrichtigen(termin, "neu"), melden("termin.angefragt", { ...ereignisDaten(termin), wunschzeit_frei: !eng })]);
  });
  return termin;
}

/**
 * Speichert eine Anfrage zur gewählten Zeit. Frei: Termin wird gehalten und bekommt einen Mitarbeiter. Belegt,
 * aber in der Öffnungszeit: Anfrage trotzdem möglich, sie hält nichts frei; der Betrieb sagt zu, lehnt ab oder
 * schlägt eine andere Zeit vor. Kunde und Fahrzeug (`kontakt`) entstehen erst, wenn die Zeit passt.
 */
async function anfrageSpeichern(
  a: {
    bedarf: Bedarf;
    /** Leistungen, deren Angebotspreis am Termin festgehalten wird (vom Kostenvoranschlag: keine, dort gilt sein Preis) */
    leistungen: Leistung[];
    leistungName: string;
    datum: string;
    uhrzeit: string;
    notiz: string;
    kontakt: () => Promise<{ kundeId: string; fahrzeugId: string | null }>;
  },
  einst: Einstellungen,
): Promise<{ termin: Termin; eng: boolean }> {
  const { bedarf } = a;
  if (a.datum > plusTage(berlinDatum(), einst.buchung.maxTage)) throw new TerminFehler("So weit im Voraus können wir noch keine Termine vergeben.");
  const frei = (await slotsImBereich(bedarf, a.datum, plusTage(a.datum, 1), einst)).get(a.datum)?.find((s) => zeit(s.beginn) === a.uhrzeit);
  const eng = frei ? null : zeitraumInOeffnung(bedarf, a.datum, a.uhrzeit, einst);
  if (!frei && !eng) throw new TerminFehler("Zu dieser Uhrzeit können wir den Termin nicht annehmen. Bitte wählen Sie eine andere Uhrzeit.");
  const slot = frei ?? { ...eng!, kandidaten: [] };
  const { kundeId, fahrzeugId } = await a.kontakt();
  const ids = bedarf.ids ?? [];

  // Der am wenigsten Ausgelastete zuerst. Hat ihn gerade jemand anders bekommen (gleichzeitige Anfrage), der Nächste.
  // Ist auch der Letzte weg, wird es eine Anfrage zur belegten Zeit statt einer Fehlermeldung.
  const versuche: { profil: string | null; ende: Date; bis: Date; eng?: boolean }[] = frei?.kandidaten.length ? [...frei.kandidaten] : [{ profil: null, ende: slot.ende, bis: slot.bis, eng: !frei }];
  if (frei) versuche.push({ profil: null, ende: slot.ende, bis: slot.bis, eng: true });
  let id: string | null = null;
  let warEng = false;
  for (const k of versuche) {
    const { data, error } = await dbRoh().rpc("termin_anlegen", {
      p: {
        beginn: slot.beginn.toISOString(),
        ende: k.ende.toISOString(),
        belegt_bis: k.bis.toISOString(),
        leistung_id: ids[0] ?? null,
        leistung_ids: ids,
        leistung_name: a.leistungName,
        kunde_id: kundeId,
        fahrzeug_id: fahrzeugId,
        notiz_kunde: a.notiz,
        quelle: "website",
        // Eine Anfrage zur belegten Zeit hält nichts frei, sonst sperrte sie anderen Kunden die Zeit.
        halten_bis: new Date(Date.now() + (k.eng ? 0 : einst.buchung.haltenStd * 3600000)).toISOString(),
        zugewiesen_an: k.profil,
      },
      p_kapazitaet: einst.buchung.kapazitaet,
      p_ueberbuchen: Boolean(k.eng),
    });
    if (!error) {
      id = data as string;
      warEng = Boolean(k.eng);
      break;
    }
    if (!error.message.includes("PERSON_BELEGT") && !error.message.includes("SLOT_BELEGT")) dbFehler(error);
  }
  if (!id) throw new TerminFehler("Die Anfrage konnte gerade nicht gespeichert werden. Bitte noch einmal versuchen.");
  if (warEng) await db().from("termine").update({ wunschzeit_frei: false }).eq("id", id);
  await angebotsPreiseFesthalten(id, a.leistungen);
  return { termin: (await terminLaden(id))!, eng: warEng };
}

/** Planungsdaten rund um einen Zeitraum: wer kommt in Frage, was ist schon belegt. */
async function planungFuer(beginn: Date) {
  const datum = berlinDatum(beginn);
  const [personen, alle, aktiv] = await Promise.all([planPersonen(datum, datum, false), belegungenAm(datum), planungAktiv()]);
  return { datum, personen, alle, aktiv };
}

/**
 * Prüft, ob die Person den Termin machen kann, und wirft sonst eine PlanungsWarnung (außer bei `trotzdem`).
 * Wer nicht in der Planung steht (deaktiviert), wird nicht geprüft.
 */
async function personPruefen(profil: string | null, t: { beginn: Date; ende: Date; bis: Date; leistungIds: string[]; id?: string }, trotzdem: boolean) {
  if (!profil || trotzdem) return;
  const { personen, alle } = await planungFuer(t.beginn);
  const person = personen.find((p) => p.id === profil);
  if (!person) return;
  const gruende = konflikte(person, t, alle, await leistungNamen(t.leistungIds));
  if (gruende.length) throw new PlanungsWarnung(gruende);
}

/** Wer frei ist und passt (nur wer Aufträge annimmt). null, wenn niemand oder die Planung aus ist. */
async function automatischePerson(t: { beginn: Date; ende: Date; bis: Date; leistungIds: string[]; id?: string }, ausser: string[] = []): Promise<string | null> {
  const datum = berlinDatum(t.beginn);
  if (!(await planungAktiv())) return null;
  const [personen, alle] = await Promise.all([planPersonen(datum, datum), belegungenAm(datum)]);
  return besteFreiePerson(personen, t, alle, ausser)?.id ?? null;
}

/**
 * Termin direkt eintragen (Telefonkunde). Ist sofort bestätigt. Neben Leistungen aus der Preisliste kann eine
 * frei beschriebene Arbeit dazukommen; die Dauer ist dann von Hand anzugeben, sonst gilt die Summe.
 * `mitarbeiter`: eine Person, null = niemand, „auto“ = wer frei ist und passt.
 */
export async function terminEintragen(
  e: AnfrageEingabe & {
    leistungName?: string;
    dauerMin?: number;
    ueberbuchen?: boolean;
    mitarbeiter?: string | null | "auto";
    /** Aus der Kartei gewählt: Der Termin hängt direkt an diesem Kunden (und Fahrzeug) */
    kundeId?: string | null;
    fahrzeugId?: string | null;
  },
  vonBenutzer: string,
): Promise<Termin> {
  const einst = await einstellungen();
  const gewaehlt = await terminLeistungen(e.leistungIds);
  const frei = e.leistungName?.trim() ?? "";
  const dauer = e.dauerMin ?? (gewaehlt.length ? gesamtDauer(gewaehlt) : 60);
  const slot = zeitraum(e.datum, e.uhrzeit, dauer, einst.buchung.pufferMin);
  const plan = { ...slot, leistungIds: gewaehlt.map((l) => l.id) };
  const mitarbeiter = e.mitarbeiter === "auto" || e.mitarbeiter === undefined ? await automatischePerson(plan) : e.mitarbeiter;
  // Vor Kunde und Fahrzeug: Passt die Person nicht, soll noch nichts angelegt sein.
  if (e.mitarbeiter !== "auto") await personPruefen(mitarbeiter, plan, Boolean(e.ueberbuchen));
  const kontakt = { name: e.name, email: e.email, telefon: e.telefon };
  const kundeId = e.kundeId ? await gewaehlterKunde(e.kundeId, kontakt) : await kundeFindenOderAnlegen(kontakt);
  const fahrzeugId = await gewaehltesFahrzeug(e.fahrzeugId, e.kennzeichen, kundeId, e.fahrzeug);

  const { data: id, error } = await dbRoh().rpc("termin_anlegen", {
    p: {
      status: "bestaetigt",
      beginn: slot.beginn.toISOString(),
      ende: slot.ende.toISOString(),
      belegt_bis: slot.bis.toISOString(),
      leistung_id: gewaehlt[0]?.id ?? null,
      leistung_ids: gewaehlt.map((l) => l.id),
      leistung_name: [...gewaehlt.map((l) => l.name), frei].filter(Boolean).join(", ") || "Termin",
      kunde_id: kundeId,
      fahrzeug_id: fahrzeugId,
      notiz_intern: e.notiz ?? "",
      quelle: "admin",
      zugewiesen_an: mitarbeiter ?? null,
    },
    p_kapazitaet: einst.buchung.kapazitaet,
    p_ueberbuchen: Boolean(e.ueberbuchen),
  });
  if (error) dbFehler(error);
  await angebotsPreiseFesthalten(id as string, gewaehlt);
  const termin = (await terminLaden(id as string))!;
  await verlauf("termin", termin.id, `Termin eingetragen${termin.mitarbeiter ? ` für ${termin.mitarbeiter.name}` : ""}`, vonBenutzer);
  after(async () => {
    await Promise.all([
      kundenMail(termin, "bestaetigt"),
      personBenachrichtigen(termin.zugewiesen_an, termin, "neu"),
      melden("termin.bestaetigt", ereignisDaten(termin)),
    ]);
  });
  return termin;
}

const leistungIdsVon = (t: Pick<Termin, "leistung_ids" | "leistung_id">) => t.leistung_ids ?? (t.leistung_id ? [t.leistung_id] : []);

export async function bestaetigen(id: string, vonBenutzer: string | null, ueberbuchen = false, verlaufText?: string): Promise<void> {
  const { buchung } = await einstellungen();
  // Anfragen ohne Person (Planung war aus, Person fiel aus) bekommen beim Bestätigen jemanden, wenn möglich.
  const vorher = await terminLaden(id);
  if (vorher && vorher.status === "angefragt" && !vorher.zugewiesen_an) {
    const zr = { beginn: new Date(vorher.beginn), ende: new Date(vorher.ende), bis: new Date(vorher.belegt_bis), leistungIds: leistungIdsVon(vorher), id };
    const person = await automatischePerson(zr);
    // Klappt das nicht (gerade vergeben), wird trotzdem bestätigt, nur eben ohne Person.
    if (person) await umplanenRpc(id, zr, person, buchung.kapazitaet, false).catch(() => undefined);
  }
  const { error } = await dbRoh().rpc("termin_bestaetigen", { p_id: id, p_kapazitaet: buchung.kapazitaet, p_ueberbuchen: ueberbuchen });
  if (error) dbFehler(error, vonBenutzer !== null);
  const termin = (await terminLaden(id))!;
  await verlauf("termin", id, verlaufText ?? (ueberbuchen ? "Bestätigt (trotz Warnung)" : "Bestätigt"), vonBenutzer);
  after(async () => {
    await Promise.all([
      kundenMail(termin, "bestaetigt"),
      personBenachrichtigen(termin.zugewiesen_an, termin, "neu"),
      melden("termin.bestaetigt", ereignisDaten(termin)),
    ]);
  });
}

export async function ablehnen(id: string, grund: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("termine")
    .update({ status: "abgelehnt", absage_grund: grund, halten_bis: null })
    .eq("id", id)
    .eq("status", "angefragt")
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new TerminFehler("Die Anfrage wurde in der Zwischenzeit schon bearbeitet.");
  const termin = (await terminLaden(id))!;
  await verlauf("termin", id, `Abgelehnt${grund ? `: ${grund}` : ""}`, vonBenutzer);
  after(async () => {
    await Promise.all([kundenMail(termin, "abgelehnt"), melden("termin.abgelehnt", ereignisDaten(termin))]);
  });
}

/** Absage durch den Betrieb oder (über den Link, mit Frist) durch den Kunden. */
export async function stornieren(id: string, durch: { kunde: true } | { benutzer: string }, grund = ""): Promise<void> {
  const termin = await terminLaden(id);
  if (!termin || !["angefragt", "bestaetigt"].includes(termin.status)) throw new TerminFehler("Dieser Termin kann nicht mehr abgesagt werden.");
  if ("kunde" in durch) {
    const { buchung } = await einstellungen();
    if (termin.status === "bestaetigt" && new Date(termin.beginn).getTime() - Date.now() < buchung.stornoFristStd * 3600000) {
      throw new TerminFehler(`Absagen ist online nur bis ${buchung.stornoFristStd} Stunden vorher möglich. Bitte rufen Sie uns an.`);
    }
  }
  // Die Bedingung steht im Update selbst: Hat jemand den Termin inzwischen erledigt oder abgelehnt, bleibt er so.
  const { data, error } = await db()
    .from("termine")
    .update({ status: "storniert", halten_bis: null, absage_grund: grund })
    .eq("id", id)
    .in("status", ["angefragt", "bestaetigt"])
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new TerminFehler("Dieser Termin kann nicht mehr abgesagt werden.");
  const neu = (await terminLaden(id))!;
  await verlauf("termin", id, "kunde" in durch ? "Vom Kunden abgesagt" : `Abgesagt${grund ? `: ${grund}` : ""}`, "kunde" in durch ? null : durch.benutzer);
  after(async () => {
    await Promise.all([
      kundenMail(neu, "storniert"),
      "kunde" in durch ? betriebBenachrichtigen(neu, "storniert") : Promise.resolve(),
      termin.status === "bestaetigt" ? personBenachrichtigen(termin.zugewiesen_an, termin, "entfaellt") : Promise.resolve(),
      melden("termin.storniert", { ...ereignisDaten(neu), durch_kunde: "kunde" in durch }),
    ]);
  });
}

type Zeitraum = { beginn: Date; ende: Date; bis: Date };

async function umplanenRpc(id: string, z: Zeitraum, person: string | null, kapazitaet: number, ueberbuchen: boolean) {
  const { error } = await dbRoh().rpc("termin_umplanen", {
    p_id: id,
    p_beginn: z.beginn.toISOString(),
    p_ende: z.ende.toISOString(),
    p_bis: z.bis.toISOString(),
    p_person: person,
    p_kapazitaet: kapazitaet,
    p_ueberbuchen: ueberbuchen,
  });
  if (error) dbFehler(error, true);
}

/**
 * Zeit und/oder Mitarbeiter eines offenen Termins ändern (Verschieben, Zuteilen, Ziehen im Kalender). Die Dauer
 * bleibt. Passt die Person nicht, gibt es eine PlanungsWarnung, außer bei `trotzdem`. Der Kunde bekommt nur
 * bei einer neuen Uhrzeit eine Mail, die Mitarbeiter bei jeder Änderung einen Push.
 */
export async function umplanen(
  id: string,
  ziel: { datum?: string; uhrzeit?: string; mitarbeiter?: string | null },
  vonBenutzer: string,
  trotzdem = false,
): Promise<Termin> {
  const termin = await terminLaden(id);
  if (!termin) throw new TerminFehler("Termin nicht gefunden.");
  if (!["angefragt", "bestaetigt"].includes(termin.status)) throw new TerminFehler("Nur offene Termine lassen sich umplanen.");
  const { buchung } = await einstellungen();
  const alt = new Date(termin.beginn);
  const datum = ziel.datum ?? berlinDatum(alt);
  const uhr = ziel.uhrzeit ?? berlinUhrzeit(alt);
  const dauer = Math.round((new Date(termin.ende).getTime() - alt.getTime()) / 60000);
  const zeitGeaendert = datum !== berlinDatum(alt) || uhr !== berlinUhrzeit(alt);
  const z = zeitGeaendert ? zeitraum(datum, uhr, dauer, buchung.pufferMin) : { beginn: alt, ende: new Date(termin.ende), bis: new Date(termin.belegt_bis) };
  const person = ziel.mitarbeiter === undefined ? termin.zugewiesen_an : ziel.mitarbeiter;
  const personGeaendert = person !== termin.zugewiesen_an;
  if (!zeitGeaendert && !personGeaendert) return termin;

  await personPruefen(person, { ...z, leistungIds: leistungIdsVon(termin), id }, trotzdem);
  await umplanenRpc(id, z, person, buchung.kapazitaet, trotzdem);
  const neu = (await terminLaden(id))!;

  const schritte = [
    zeitGeaendert ? `Verschoben auf ${datumLangText(z.beginn)}, ${zeit(z.beginn)} Uhr` : "",
    personGeaendert ? (neu.mitarbeiter ? `Zugeteilt an ${neu.mitarbeiter.name}` : "Mitarbeiter entfernt") : "",
  ].filter(Boolean);
  await verlauf("termin", id, schritte.join(", ") + (trotzdem ? " (trotz Warnung)" : ""), vonBenutzer);
  after(async () => {
    const bestaetigt = neu.status === "bestaetigt";
    await Promise.all([
      zeitGeaendert && bestaetigt ? kundenMail(neu, "verschoben") : Promise.resolve(),
      bestaetigt && personGeaendert ? personBenachrichtigen(termin.zugewiesen_an, termin, "entfaellt") : Promise.resolve(),
      bestaetigt ? personBenachrichtigen(neu.zugewiesen_an, neu, personGeaendert ? "neu" : "geaendert") : Promise.resolve(),
      zeitGeaendert ? melden("termin.verschoben", ereignisDaten(neu)) : Promise.resolve(),
      personGeaendert ? melden("termin.zugewiesen", { ...ereignisDaten(neu), vorher: termin.zugewiesen_an }) : Promise.resolve(),
    ]);
  });
  return neu;
}

export async function verschieben(id: string, datum: string, uhrzeit: string, vonBenutzer: string, ueberbuchen = false): Promise<void> {
  await umplanen(id, { datum, uhrzeit }, vonBenutzer, ueberbuchen);
}

// ---------------------------------------------------------------------------
// Anfrage beantworten: Ja, Nein oder Gegenvorschlag
// ---------------------------------------------------------------------------

/**
 * Lage einer Anfrage für die Entscheidung: Ist die Wunschzeit (noch) frei, und welche freien Zeiten liegen nah
 * dran (für einen Gegenvorschlag mit einem Klick)?
 */
export async function anfrageLage(t: Termin): Promise<{ frei: boolean; text: string; vorschlaege: { datum: string; uhrzeit: string }[] }> {
  const e = await einstellungen();
  const leistungen = await terminLeistungen(leistungIdsVon(t));
  const dauer = Math.round((new Date(t.ende).getTime() - new Date(t.beginn).getTime()) / 60000);
  const bedarf = { dauer_min: leistungen.length ? gesamtDauer(leistungen) : dauer, ids: leistungen.map((l) => l.id) };
  const wunsch = new Date(t.beginn);
  const start = berlinDatum(wunsch) < berlinDatum() ? berlinDatum() : berlinDatum(wunsch);
  const slots = await slotsImBereich(bedarf, start, plusTage(start, 7), e, t.id);
  const alle = [...slots].flatMap(([datum, liste]) => liste.map((x) => ({ datum, uhrzeit: zeit(x.beginn), ms: x.beginn.getTime() })));
  const frei = alle.some((x) => x.ms === wunsch.getTime());
  // Die nächsten freien Zeiten um die Wunschzeit herum, chronologisch
  const vorschlaege = alle
    .filter((x) => x.ms !== wunsch.getTime())
    .sort((a, b) => Math.abs(a.ms - wunsch.getTime()) - Math.abs(b.ms - wunsch.getTime()))
    .slice(0, 6)
    .sort((a, b) => a.ms - b.ms)
    .map(({ datum, uhrzeit }) => ({ datum, uhrzeit }));
  const text = frei
    ? "Zur gewünschten Zeit ist frei."
    : (await planungAktiv())
      ? "Zur gewünschten Zeit ist kein passender Mitarbeiter oder kein Arbeitsplatz frei."
      : "Zur gewünschten Zeit ist die Werkstatt voll.";
  return { frei, text, vorschlaege };
}

/**
 * Gegenvorschlag an den Kunden: Die Anfrage rückt auf die neue Zeit und hält sie wie jede Anfrage (Haltezeit aus
 * den Einstellungen); die Wunschzeit bleibt gespeichert. Der Kunde nimmt über seinen Link an oder lehnt ab.
 * Ist die neue Zeit nicht frei, gibt es eine Warnung, die sich mit `trotzdem` übergehen lässt.
 */
export async function gegenvorschlag(id: string, datum: string, uhr: string, nachricht: string, vonBenutzer: string, trotzdem = false): Promise<void> {
  const termin = await terminLaden(id);
  if (!termin) throw new TerminFehler("Termin nicht gefunden.");
  if (termin.status !== "angefragt") throw new TerminFehler("Einen Gegenvorschlag gibt es nur für offene Anfragen.");
  const e = await einstellungen();
  const leistungen = await terminLeistungen(leistungIdsVon(termin));
  const dauer = Math.round((new Date(termin.ende).getTime() - new Date(termin.beginn).getTime()) / 60000);
  const bedarf = { dauer_min: leistungen.length ? gesamtDauer(leistungen) : dauer, ids: leistungen.map((l) => l.id) };
  // Freie Zeit: mit Pausen und passendem Mitarbeiter wie auf der Website. Sonst nur mit Bestätigung.
  const slot = (await slotsImBereich(bedarf, datum, plusTage(datum, 1), e, id)).get(datum)?.find((x) => zeit(x.beginn) === uhr);
  if (!slot && !trotzdem) throw new PlanungsWarnung([`Am ${datumLangText(berlin(datum))} um ${uhr} Uhr ist eigentlich nichts frei.`]);
  const k = slot?.kandidaten[0];
  const z = slot ? { beginn: slot.beginn, ende: k?.ende ?? slot.ende, bis: k?.bis ?? slot.bis } : zeitraum(datum, uhr, bedarf.dauer_min, e.buchung.pufferMin);
  await umplanenRpc(id, z, k?.profil ?? null, e.buchung.kapazitaet, trotzdem);
  await db()
    .from("termine")
    .update({
      wunsch_beginn: termin.wunsch_beginn ?? termin.beginn,
      vorschlag_am: new Date().toISOString(),
      vorschlag_nachricht: nachricht,
      halten_bis: new Date(Date.now() + e.buchung.haltenStd * 3600000).toISOString(),
    })
    .eq("id", id)
    .eq("status", "angefragt");
  const neu = (await terminLaden(id))!;
  await verlauf("termin", id, `Gegenvorschlag: ${datumLangText(z.beginn)}, ${zeit(z.beginn)} Uhr${trotzdem && !slot ? " (trotz Warnung)" : ""}`, vonBenutzer);
  after(async () => {
    await Promise.all([kundenMail(neu, "gegenvorschlag"), melden("termin.gegenvorschlag", { ...ereignisDaten(neu), wunsch_beginn: neu.wunsch_beginn })]);
  });
}

/** Antwort des Kunden auf einen Gegenvorschlag (über seinen Link). Ja = bestätigt, Nein = Anfrage zurückgezogen. */
export async function vorschlagAntworten(token: string, annehmen: boolean): Promise<Termin> {
  const termin = await terminPerToken(token);
  if (!termin || termin.status !== "angefragt" || !termin.vorschlag_am) throw new TerminFehler("Zu diesem Termin gibt es keinen offenen Vorschlag.");
  if (annehmen) {
    try {
      await bestaetigen(termin.id, null, false, "Gegenvorschlag vom Kunden angenommen");
    } catch (error) {
      if (error instanceof TerminFehler) throw new TerminFehler("Der vorgeschlagene Termin ist inzwischen leider vergeben. Bitte rufen Sie uns an oder wählen Sie einen neuen Termin.");
      throw error;
    }
  } else {
    const { data } = await db()
      .from("termine")
      .update({ status: "storniert", halten_bis: null, absage_grund: "Gegenvorschlag passt dem Kunden nicht" })
      .eq("id", termin.id)
      .eq("status", "angefragt")
      .select("id");
    if (!data?.length) throw new TerminFehler("Diese Anfrage wurde in der Zwischenzeit schon bearbeitet.");
    await verlauf("termin", termin.id, "Gegenvorschlag vom Kunden abgelehnt", null);
  }
  const neu = (await terminLaden(termin.id))!;
  after(async () => {
    await Promise.all([
      betriebBenachrichtigen(neu, annehmen ? "vorschlag_ja" : "vorschlag_nein"),
      annehmen ? Promise.resolve() : melden("termin.storniert", { ...ereignisDaten(neu), durch_kunde: true, grund: "gegenvorschlag" }),
    ]);
  });
  return neu;
}

/**
 * Eine Person fällt aus (Urlaub genehmigt, krank, halber Tag frei): Ihre offenen Termine im Zeitraum gehen an
 * passende freie Kollegen. Was sich nicht unterbringen lässt, verliert die Person und steht in der Verwaltung
 * unter „ohne Mitarbeiter“. Liefert, wie viele umverteilt und wie viele offen sind.
 */
export async function nachAbwesenheitUmverteilen(
  profil: string,
  a: { von: string; bis: string; von_zeit?: string | null; bis_zeit?: string | null },
  vonBenutzer: string | null,
): Promise<{ umverteilt: number; offen: number }> {
  // Ohne Planung wird von Hand zugeteilt; dann bleibt alles, wie es ist, statt Termine stillschweigend zu leeren.
  if (!(await planungAktiv())) return { umverteilt: 0, offen: 0 };
  const beginn = a.von_zeit ? berlin(a.von, a.von_zeit.slice(0, 5)) : berlin(a.von);
  const ende = a.bis_zeit ? berlin(a.bis, a.bis_zeit.slice(0, 5)) : berlin(plusTage(a.bis, 1));
  const { data } = await db()
    .from("termine")
    .select(TERMIN_FELDER)
    .eq("zugewiesen_an", profil)
    .in("status", ["angefragt", "bestaetigt"])
    .lt("beginn", ende.toISOString())
    .gt("ende", beginn.toISOString())
    .gte("beginn", new Date().toISOString())
    .order("beginn");
  const { buchung } = await einstellungen();
  let umverteilt = 0;
  let offen = 0;
  for (const t of (data ?? []) as Termin[]) {
    const z = { beginn: new Date(t.beginn), ende: new Date(t.ende), bis: new Date(t.belegt_bis), leistungIds: leistungIdsVon(t), id: t.id };
    const neuePerson = await automatischePerson(z, [profil]);
    try {
      await umplanenRpc(t.id, z, neuePerson, buchung.kapazitaet, false);
    } catch (e) {
      // Nur wenn die Person nicht passt, ohne Person weiter; ein Datenbankfehler soll auffallen.
      if (!(e instanceof TerminFehler)) throw e;
      await umplanenRpc(t.id, z, null, buchung.kapazitaet, true);
    }
    const neu = (await terminLaden(t.id))!;
    if (neu.zugewiesen_an) umverteilt++;
    else offen++;
    await verlauf("termin", t.id, neu.mitarbeiter ? `Wegen Abwesenheit an ${neu.mitarbeiter.name} gegeben` : "Wegen Abwesenheit ohne Mitarbeiter", vonBenutzer);
    after(async () => {
      if (neu.status === "bestaetigt") await personBenachrichtigen(neu.zugewiesen_an, neu, "neu");
      await melden("termin.zugewiesen", { ...ereignisDaten(neu), vorher: profil });
    });
  }
  if (offen) {
    after(() =>
      pushSenden(
        { rollen: ["inhaber", "buero"] },
        { titel: "Termine ohne Mitarbeiter", text: `${offen} ${offen === 1 ? "Termin braucht" : "Termine brauchen"} wegen einer Abwesenheit jemand Neues.`, url: "/admin/kalender" },
      ),
    );
  }
  return { umverteilt, offen };
}

export async function erledigen(id: string, vonBenutzer: string, status: "erledigt" | "nicht_erschienen" = "erledigt"): Promise<void> {
  const { data, error } = await db()
    .from("termine")
    .update({ status, auftrag_status: "fertig" })
    .eq("id", id)
    .in("status", ["bestaetigt", "angefragt"])
    .select("id");
  if (error) throw new DbFehler(error);
  // Sonst stünde „Erledigt“ bei einem Doppelklick zweimal im Verlauf und Webhooks bekämen termin.erledigt doppelt
  if (!data?.length) throw new TerminFehler("Der Termin wurde in der Zwischenzeit schon bearbeitet.");
  const termin = (await terminLaden(id))!;
  await verlauf("termin", id, status === "erledigt" ? "Erledigt" : "Kunde nicht erschienen", vonBenutzer);
  if (status === "erledigt") after(() => melden("termin.erledigt", ereignisDaten(termin)));
}

/**
 * Löscht einen Termin endgültig, mit Fotos und Verlauf. Die späteren Auftragsnummern
 * rücken nach (termin_loeschen). Rechnungen zum Termin bleiben, sie verlieren nur den Verweis. Der Kunde
 * bekommt keine Mail: Wer ihm Bescheid geben will, sagt den Termin vorher ab.
 */
export async function loeschen(id: string, vonBenutzer: string): Promise<void> {
  const termin = await terminLaden(id);
  if (!termin) throw new TerminFehler("Termin nicht gefunden.");
  const { data: fotos } = await db().from("termin_fotos").select("pfad").eq("termin_id", id);
  const { error } = await dbRoh().rpc("termin_loeschen", { p_id: id });
  if (error) dbFehler(error);
  await db().from("verlauf").delete().eq("bezug_typ", "termin").eq("bezug_id", id);
  after(async () => {
    if (termin.status === "bestaetigt" && new Date(termin.beginn).getTime() > Date.now()) await personBenachrichtigen(termin.zugewiesen_an, termin, "entfaellt");
    if (fotos?.length) await db().storage.from("auftragsfotos").remove(fotos.map((f) => f.pfad as string));
    await melden("termin.geloescht", { ...ereignisDaten(termin), geloescht_von: vonBenutzer });
  });
}

/** Erinnerung 24 Stunden vorher (aus dem Takt aufgerufen). */
export async function erinnerungSenden(t: Termin): Promise<void> {
  await kundenMail(t, "erinnerung");
  await db().from("termine").update({ erinnerung_am: new Date().toISOString() }).eq("id", t.id);
}
