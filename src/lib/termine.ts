import "server-only";
import { after } from "next/server";
import { einstellungen, type Einstellungen } from "./einstellungen";
import { ENV } from "./env";
import { melden, verlauf } from "./ereignisse";
import { datumLangText, kennzeichen as kennzeichenFormat, telHref, zeit } from "./format";
import { ics } from "./ics";
import { mail } from "./email/vorlagen";
import { mailer } from "./services/email";
import { abgleichWennAlt, kalender } from "./services/kalender";
import { pushSenden } from "./services/push";
import { type Belegung, freieSlots, type Slot } from "./slots";
import { db, pruefe } from "./supabase/admin";
import { berlin, berlinDatum, plusTage, wochentag } from "./zeit";

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
};

export type Termin = {
  id: string;
  nummer: number;
  status: "angefragt" | "bestaetigt" | "abgelehnt" | "storniert" | "erledigt" | "nicht_erschienen";
  beginn: string;
  ende: string;
  belegt_bis: string;
  leistung_id: string | null;
  leistung_name: string;
  notiz_kunde: string;
  notiz_intern: string;
  quelle: string;
  token: string;
  halten_bis: string | null;
  google_event_id: string | null;
  zugewiesen_an: string | null;
  auftrag_status: "offen" | "in_arbeit" | "fertig";
  km_stand: number | null;
  absage_grund: string;
  erstellt_am: string;
  kunde: { id: string; name: string; email: string; telefon: string; firma: string } | null;
  fahrzeug: { id: string; kennzeichen: string; marke_modell: string } | null;
  mitarbeiter: { id: string; name: string } | null;
};

export const TERMIN_FELDER =
  "*, kunde:kunden(id, name, email, telefon, firma), fahrzeug:fahrzeuge(id, kennzeichen, marke_modell), mitarbeiter:profile(id, name)";

export const STATUS_TEXT: Record<Termin["status"], string> = {
  angefragt: "Angefragt",
  bestaetigt: "Bestätigt",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
  erledigt: "Erledigt",
  nicht_erschienen: "Nicht erschienen",
};

export class TerminFehler extends Error {}

/** Fehlermeldungen der Datenbankfunktionen in Sätze für Menschen übersetzen. */
function dbFehler(error: unknown): never {
  const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  if (text.includes("SLOT_BELEGT")) throw new TerminFehler("Dieser Termin ist inzwischen vergeben. Bitte wählen Sie eine andere Uhrzeit.");
  if (text.includes("FALSCHER_STATUS")) throw new TerminFehler("Der Termin wurde in der Zwischenzeit schon bearbeitet.");
  if (text.includes("NICHT_GEFUNDEN")) throw new TerminFehler("Termin nicht gefunden.");
  throw error instanceof Error ? error : new Error(text);
}

export async function leistungen(nurSichtbar = true): Promise<Leistung[]> {
  let q = db().from("leistungen").select("*").order("sortierung");
  if (nurSichtbar) q = q.eq("sichtbar", true);
  return pruefe<Leistung[]>(await q);
}

export async function terminLaden(id: string): Promise<Termin | null> {
  const { data } = await db().from("termine").select(TERMIN_FELDER).eq("id", id).maybeSingle();
  return data as Termin | null;
}

export async function terminPerToken(token: string): Promise<Termin | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await db().from("termine").select(TERMIN_FELDER).eq("token", token).maybeSingle();
  return data as Termin | null;
}

// ---------------------------------------------------------------------------
// Freie Termine
// ---------------------------------------------------------------------------

async function belegungen(von: Date, bis: Date, kapazitaet: number): Promise<Belegung[]> {
  const [termine, extern] = await Promise.all([
    db()
      .from("termine")
      .select("beginn, belegt_bis, status, halten_bis")
      .in("status", ["angefragt", "bestaetigt"])
      .lt("beginn", bis.toISOString())
      .gt("belegt_bis", von.toISOString()),
    db().from("kalender_belegungen").select("beginn, ende, ganztaegig").lt("beginn", bis.toISOString()).gt("ende", von.toISOString()),
  ]);
  const jetzt = Date.now();
  return [
    ...pruefe<{ beginn: string; belegt_bis: string; status: string; halten_bis: string | null }[]>(termine)
      .filter((t) => t.status === "bestaetigt" || !t.halten_bis || new Date(t.halten_bis).getTime() > jetzt)
      .map((t) => ({ beginn: new Date(t.beginn).getTime(), bis: new Date(t.belegt_bis).getTime(), gewicht: 1 })),
    ...pruefe<{ beginn: string; ende: string; ganztaegig: boolean }[]>(extern).map((k) => ({
      beginn: new Date(k.beginn).getTime(),
      bis: new Date(k.ende).getTime(),
      gewicht: k.ganztaegig ? kapazitaet : 1,
    })),
  ];
}

export type Tagesangebot = { datum: string; slots: string[] };

/** Freie Startzeiten für eine Leistung in einem Datumsbereich. */
export async function freieTermine(
  leistung: Pick<Leistung, "dauer_min">,
  vonDatum: string,
  tage: number,
  e?: Einstellungen,
): Promise<Tagesangebot[]> {
  const { buchung, oeffnungszeiten } = e ?? (await einstellungen());
  await abgleichWennAlt(5);
  const heute = berlinDatum();
  const letzter = plusTage(heute, buchung.maxTage);
  const start = vonDatum < heute ? heute : vonDatum;
  const ende = plusTage(start, tage);
  const bisDatum = ende > letzter ? plusTage(letzter, 1) : ende;
  if (start > letzter) return [];

  const alle = await belegungen(berlin(start), berlin(bisDatum), buchung.kapazitaet);
  const fruehestens = new Date(Date.now() + buchung.vorlaufStd * 3600000);
  const ergebnis: Tagesangebot[] = [];
  for (let d = start; d < bisDatum; d = plusTage(d, 1)) {
    const fenster = oeffnungszeiten[String(wochentag(d)) as keyof typeof oeffnungszeiten] ?? [];
    const slots = fenster.length
      ? freieSlots({
          datum: d,
          fenster,
          dauerMin: leistung.dauer_min,
          pufferMin: buchung.pufferMin,
          rasterMin: buchung.rasterMin,
          kapazitaet: buchung.kapazitaet,
          fruehestens,
          belegungen: alle,
        })
      : [];
    ergebnis.push({ datum: d, slots: slots.map((s) => zeit(s.beginn)) });
  }
  return ergebnis;
}

/** Prüft eine gewünschte Startzeit gegen Öffnungszeiten, Vorlauf und Belegung und liefert den Zeitraum. */
async function slotPruefen(leistung: Pick<Leistung, "dauer_min">, datum: string, uhrzeit: string, e: Einstellungen): Promise<Slot> {
  const fenster = e.oeffnungszeiten[String(wochentag(datum)) as keyof Einstellungen["oeffnungszeiten"]] ?? [];
  const alle = await belegungen(berlin(datum), berlin(plusTage(datum, 1)), e.buchung.kapazitaet);
  const slot = freieSlots({
    datum,
    fenster,
    dauerMin: leistung.dauer_min,
    pufferMin: e.buchung.pufferMin,
    rasterMin: e.buchung.rasterMin,
    kapazitaet: e.buchung.kapazitaet,
    fruehestens: new Date(Date.now() + e.buchung.vorlaufStd * 3600000),
    belegungen: alle,
  }).find((s) => zeit(s.beginn) === uhrzeit);
  if (!slot) throw new TerminFehler("Dieser Termin ist nicht mehr frei. Bitte wählen Sie eine andere Uhrzeit.");
  return slot;
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

export async function fahrzeugFindenOderAnlegen(kennzeichen: string, kundeId: string, markeModell = ""): Promise<string | null> {
  const kz = kennzeichenFormat(kennzeichen);
  if (!kz) return null;
  const norm = kz.replace(/[^A-ZÄÖÜ0-9]/g, "");
  const { data } = await db().from("fahrzeuge").select("id, marke_modell").eq("kennzeichen_norm", norm).maybeSingle();
  if (data) {
    await db()
      .from("fahrzeuge")
      .update({ kunde_id: kundeId, kennzeichen: kz, ...(markeModell && !data.marke_modell && { marke_modell: markeModell }) })
      .eq("id", data.id);
    return data.id;
  }
  return pruefe(await db().from("fahrzeuge").insert({ kennzeichen: kz, kunde_id: kundeId, marke_modell: markeModell }).select("id").single()).id;
}

// ---------------------------------------------------------------------------
// Mails rund um den Termin
// ---------------------------------------------------------------------------

function terminLink(t: Pick<Termin, "token">) {
  return `${ENV.siteUrl}/t/${t.token}`;
}

function terminFakten(t: Termin, firma: Einstellungen["firma"]): [string, string][] {
  return [
    ["Leistung", t.leistung_name],
    ["Wann", `${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr`],
    ...(t.fahrzeug ? ([["Fahrzeug", [t.fahrzeug.kennzeichen, t.fahrzeug.marke_modell].filter(Boolean).join(", ")]] as [string, string][]) : []),
    ["Wo", `${firma.strasse}, ${firma.plz} ${firma.ort}`],
  ];
}

async function kundenMail(t: Termin, art: "eingang" | "bestaetigt" | "abgelehnt" | "storniert" | "verschoben" | "erinnerung") {
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

async function betriebBenachrichtigen(t: Termin, art: "neu" | "storniert") {
  const { firma, benachrichtigung } = await einstellungen();
  const titel = art === "neu" ? `Neue Anfrage: ${t.leistung_name}` : `Kunde hat abgesagt: ${t.leistung_name}`;
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

function kalenderEintrag(t: Termin) {
  return {
    id: t.id,
    titel: [t.leistung_name, t.fahrzeug?.kennzeichen, t.kunde?.name].filter(Boolean).join(" · "),
    beschreibung: [
      t.kunde?.telefon && `Telefon: ${t.kunde.telefon}`,
      t.fahrzeug?.marke_modell && `Fahrzeug: ${t.fahrzeug.marke_modell}`,
      t.notiz_kunde && `Notiz: ${t.notiz_kunde}`,
      `Im System: ${ENV.siteUrl}/admin/termine/${t.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    beginn: new Date(t.beginn),
    ende: new Date(t.ende),
  };
}

async function inKalenderEintragen(t: Termin) {
  try {
    if (t.google_event_id) {
      await kalender().aendern(t.google_event_id, kalenderEintrag(t));
    } else {
      const eventId = await kalender().eintragen(kalenderEintrag(t));
      if (eventId) await db().from("termine").update({ google_event_id: eventId }).eq("id", t.id);
    }
  } catch (error) {
    console.error(`Termin ${t.nummer} konnte nicht in den Kalender eingetragen werden`, error);
    await verlauf("termin", t.id, "Eintrag im Google-Kalender fehlgeschlagen, wird beim nächsten Abgleich nicht wiederholt. Bitte prüfen.");
  }
}

async function ausKalenderEntfernen(t: Termin) {
  if (!t.google_event_id) return;
  try {
    await kalender().entfernen(t.google_event_id);
    await db().from("termine").update({ google_event_id: null }).eq("id", t.id);
  } catch (error) {
    console.error(`Termin ${t.nummer} konnte nicht aus dem Kalender entfernt werden`, error);
  }
}

const ereignisDaten = (t: Termin) => ({
  termin_id: t.id,
  nummer: t.nummer,
  status: t.status,
  beginn: t.beginn,
  ende: t.ende,
  leistung: t.leistung_name,
  kunde: t.kunde ? { id: t.kunde.id, name: t.kunde.name, email: t.kunde.email, telefon: t.kunde.telefon } : null,
  kennzeichen: t.fahrzeug?.kennzeichen ?? null,
});

// ---------------------------------------------------------------------------
// Abläufe
// ---------------------------------------------------------------------------

export type AnfrageEingabe = {
  leistungId: string;
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
  const { data: leistung } = await db().from("leistungen").select("*").eq("id", e.leistungId).eq("sichtbar", true).maybeSingle();
  if (!leistung || !leistung.online_anfragbar) throw new TerminFehler("Diese Leistung kann nicht online angefragt werden.");

  const slot = await slotPruefen(leistung, e.datum, e.uhrzeit, einst);
  const kundeId = await kundeFindenOderAnlegen({ name: e.name, email: e.email, telefon: e.telefon });
  const fahrzeugId = await fahrzeugFindenOderAnlegen(e.kennzeichen, kundeId, e.fahrzeug);

  const { data: id, error } = await db().rpc("termin_anlegen", {
    p: {
      beginn: slot.beginn.toISOString(),
      ende: slot.ende.toISOString(),
      belegt_bis: slot.bis.toISOString(),
      leistung_id: leistung.id,
      leistung_name: leistung.name,
      kunde_id: kundeId,
      fahrzeug_id: fahrzeugId,
      notiz_kunde: e.notiz ?? "",
      quelle: "website",
      halten_bis: new Date(Date.now() + einst.buchung.haltenStd * 3600000).toISOString(),
    },
    p_kapazitaet: einst.buchung.kapazitaet,
  });
  if (error) dbFehler(error);

  const termin = (await terminLaden(id as string))!;
  after(async () => {
    await Promise.all([kundenMail(termin, "eingang"), betriebBenachrichtigen(termin, "neu"), melden("termin.angefragt", ereignisDaten(termin))]);
  });
  return termin;
}

/** Termin direkt eintragen (Telefonkunde). Ist sofort bestätigt und steht im Kalender. */
export async function terminEintragen(
  e: Omit<AnfrageEingabe, "leistungId"> & { leistungId: string | null; leistungName?: string; dauerMin?: number; ueberbuchen?: boolean; mitarbeiter?: string | null },
  vonBenutzer: string,
): Promise<Termin> {
  const einst = await einstellungen();
  const { data: leistung } = e.leistungId ? await db().from("leistungen").select("*").eq("id", e.leistungId).maybeSingle() : { data: null };
  const dauer = e.dauerMin ?? leistung?.dauer_min ?? 60;
  const slot = zeitraum(e.datum, e.uhrzeit, dauer, einst.buchung.pufferMin);
  const kundeId = await kundeFindenOderAnlegen({ name: e.name, email: e.email, telefon: e.telefon });
  const fahrzeugId = await fahrzeugFindenOderAnlegen(e.kennzeichen, kundeId, e.fahrzeug);

  const { data: id, error } = await db().rpc("termin_anlegen", {
    p: {
      status: "bestaetigt",
      beginn: slot.beginn.toISOString(),
      ende: slot.ende.toISOString(),
      belegt_bis: slot.bis.toISOString(),
      leistung_id: leistung?.id ?? null,
      leistung_name: leistung?.name ?? e.leistungName ?? "Termin",
      kunde_id: kundeId,
      fahrzeug_id: fahrzeugId,
      notiz_intern: e.notiz ?? "",
      quelle: "admin",
      zugewiesen_an: e.mitarbeiter ?? null,
    },
    p_kapazitaet: einst.buchung.kapazitaet,
    p_ueberbuchen: Boolean(e.ueberbuchen),
  });
  if (error) dbFehler(error);
  const termin = (await terminLaden(id as string))!;
  await verlauf("termin", termin.id, "Termin eingetragen", vonBenutzer);
  after(async () => {
    await inKalenderEintragen(termin);
    await Promise.all([kundenMail(termin, "bestaetigt"), melden("termin.bestaetigt", ereignisDaten(termin))]);
  });
  return termin;
}

export async function bestaetigen(id: string, vonBenutzer: string, ueberbuchen = false): Promise<void> {
  const { buchung } = await einstellungen();
  const { error } = await db().rpc("termin_bestaetigen", { p_id: id, p_kapazitaet: buchung.kapazitaet, p_ueberbuchen: ueberbuchen });
  if (error) dbFehler(error);
  const termin = (await terminLaden(id))!;
  await verlauf("termin", id, ueberbuchen ? "Bestätigt (trotz voller Werkstatt)" : "Bestätigt", vonBenutzer);
  after(async () => {
    await inKalenderEintragen(termin);
    await Promise.all([kundenMail(termin, "bestaetigt"), melden("termin.bestaetigt", ereignisDaten(termin))]);
  });
}

export async function ablehnen(id: string, grund: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("termine")
    .update({ status: "abgelehnt", absage_grund: grund, halten_bis: null })
    .eq("id", id)
    .eq("status", "angefragt")
    .select("id");
  if (error) throw error;
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
  await db().from("termine").update({ status: "storniert", halten_bis: null, absage_grund: grund }).eq("id", id);
  const neu = (await terminLaden(id))!;
  await verlauf("termin", id, "kunde" in durch ? "Vom Kunden abgesagt" : `Abgesagt${grund ? `: ${grund}` : ""}`, "kunde" in durch ? null : durch.benutzer);
  after(async () => {
    await ausKalenderEntfernen(termin);
    await Promise.all([
      kundenMail(neu, "storniert"),
      "kunde" in durch ? betriebBenachrichtigen(neu, "storniert") : Promise.resolve(),
      melden("termin.storniert", { ...ereignisDaten(neu), durch_kunde: "kunde" in durch }),
    ]);
  });
}

export async function verschieben(id: string, datum: string, uhrzeit: string, vonBenutzer: string, ueberbuchen = false): Promise<void> {
  const termin = await terminLaden(id);
  if (!termin) throw new TerminFehler("Termin nicht gefunden.");
  const { buchung } = await einstellungen();
  const dauer = Math.round((new Date(termin.ende).getTime() - new Date(termin.beginn).getTime()) / 60000);
  const slot = zeitraum(datum, uhrzeit, dauer, buchung.pufferMin);
  const { error } = await db().rpc("termin_verschieben", {
    p_id: id,
    p_beginn: slot.beginn.toISOString(),
    p_ende: slot.ende.toISOString(),
    p_bis: slot.bis.toISOString(),
    p_kapazitaet: buchung.kapazitaet,
    p_ueberbuchen: ueberbuchen,
  });
  if (error) dbFehler(error);
  const neu = (await terminLaden(id))!;
  await verlauf("termin", id, `Verschoben auf ${datumLangText(slot.beginn)}, ${zeit(slot.beginn)} Uhr`, vonBenutzer);
  after(async () => {
    if (neu.status === "bestaetigt") await inKalenderEintragen(neu);
    await Promise.all([
      neu.status === "bestaetigt" ? kundenMail(neu, "verschoben") : Promise.resolve(),
      melden("termin.verschoben", ereignisDaten(neu)),
    ]);
  });
}

export async function erledigen(id: string, vonBenutzer: string, status: "erledigt" | "nicht_erschienen" = "erledigt"): Promise<void> {
  await db().from("termine").update({ status, auftrag_status: "fertig" }).eq("id", id).in("status", ["bestaetigt", "angefragt"]);
  const termin = (await terminLaden(id))!;
  await verlauf("termin", id, status === "erledigt" ? "Erledigt" : "Kunde nicht erschienen", vonBenutzer);
  if (status === "erledigt") after(() => melden("termin.erledigt", ereignisDaten(termin)));
}

/** Erinnerung 24 Stunden vorher (aus dem Takt aufgerufen). */
export async function erinnerungSenden(t: Termin): Promise<void> {
  await kundenMail(t, "erinnerung");
  await db().from("termine").update({ erinnerung_am: new Date().toISOString() }).eq("id", t.id);
}
