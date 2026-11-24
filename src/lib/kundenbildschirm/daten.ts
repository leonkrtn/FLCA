import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { auftragAnlegen, auftragErteilen, auftragLaden } from "../auftrag";
import { melden, verlauf } from "../ereignisse";
import { euroGenau, kennzeichen as kennzeichenFormat, kennzeichenNorm, telefonVergleich } from "../format";
import { berechne, einzelpreisAnzeige, rabattText, zeilenbetrag } from "../rechnung/berechnung";
import { pushSenden } from "../services/push";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { TerminFehler } from "../termine";
import { berlin, berlinDatum, plusTage, ZONE } from "../zeit";
import type { Sprache, TextSchluessel } from "./texte";

/**
 * Kundenbildschirm: Kunden tragen ihre Daten selbst ein und unterschreiben den Werkstattauftrag. Das Gerät
 * meldet sich nicht an, sondern trägt einen geheimen Schlüssel im Link (`/kundenbildschirm/<schluessel>`).
 * Alles hier prüft zuerst den Schlüssel; gesperrt wird ein Gerät, indem seine Zeile gelöscht wird.
 * Eingaben gehen direkt in die Kartei, das Büro bekommt einen Push und einen Hinweis in der Verwaltung.
 */

/** Fehler, den der Kunde lesen soll: trägt nur den Schlüssel des Textes, übersetzt wird am Aufrufer. */
export class BildschirmFehler extends Error {
  constructor(public schluessel: TextSchluessel) {
    super(schluessel);
  }
}

export type Geraet = { id: string; name: string; schluessel: string; termin_id: string | null; geschickt_am: string | null; zuletzt_gesehen: string | null; erstellt_am: string };

const SCHLUESSEL = /^[a-f0-9]{48}$/;

export async function geraetPerSchluessel(schluessel: string): Promise<Geraet | null> {
  if (!SCHLUESSEL.test(schluessel)) return null;
  const { data } = await db().from("kundenbildschirme").select("*").eq("schluessel", schluessel).maybeSingle();
  return (data as Geraet | null) ?? null;
}

/** Für Aktionen des Bildschirms: ohne gültigen Schlüssel geht nichts. */
export async function geraetPruefen(schluessel: string): Promise<Geraet> {
  const g = await geraetPerSchluessel(schluessel);
  if (!g) throw new BildschirmFehler("fehlerGeraet");
  return g;
}

/** „Läuft gerade“ für die Verwaltung; höchstens einmal pro Minute geschrieben, obwohl der Bildschirm öfter fragt. */
export async function geraetGesehen(g: Geraet): Promise<void> {
  if (g.zuletzt_gesehen && Date.now() - new Date(g.zuletzt_gesehen).getTime() < 60_000) return;
  await db().from("kundenbildschirme").update({ zuletzt_gesehen: new Date().toISOString() }).eq("id", g.id);
}

// ---------------------------------------------------------------------------
// Verwaltung: Geräte, Auftrag schicken, Eingaben
// ---------------------------------------------------------------------------

export async function geraeteLaden(): Promise<Geraet[]> {
  const { data } = await db().from("kundenbildschirme").select("*").order("erstellt_am");
  return (data ?? []) as Geraet[];
}

export async function geraetAnlegen(name: string): Promise<void> {
  await db().from("kundenbildschirme").insert({ name: name || "Kundenbildschirm", schluessel: randomBytes(24).toString("hex") });
}

export async function geraetSperren(id: string): Promise<void> {
  await db().from("kundenbildschirme").delete().eq("id", id);
}

/** Das Büro schickt einen Auftrag auf alle Kundenbildschirme; der Kunde unterschreibt dort. */
export async function auftragSchicken(terminId: string, vonBenutzer: string): Promise<number> {
  const t = await auftragLaden(terminId);
  if (!t?.auftrag_nummer) throw new TerminFehler("Zu diesem Termin gibt es noch keinen Werkstattauftrag.");
  if (t.auftrag_erteilt_am) throw new TerminFehler("Der Auftrag ist schon erteilt.");
  const { data } = await db()
    .from("kundenbildschirme")
    .update({ termin_id: terminId, geschickt_am: new Date().toISOString() })
    .not("id", "is", null)
    .select("id");
  if (!data?.length) throw new TerminFehler("Es ist noch kein Kundenbildschirm eingerichtet (Verwaltung → Kundenbildschirm).");
  await verlauf("termin", terminId, `Werkstattauftrag ${t.auftrag_nummer} zum Unterschreiben an den Kundenbildschirm geschickt`, vonBenutzer);
  return data.length;
}

export async function geschicktZuruecknehmen(geraetId?: string): Promise<void> {
  let abfrage = db().from("kundenbildschirme").update({ termin_id: null, geschickt_am: null });
  abfrage = geraetId ? abfrage.eq("id", geraetId) : abfrage.not("termin_id", "is", null);
  await abfrage;
}

export type Eingabe = { id: string; kunde_id: string | null; art: "neu" | "geaendert" | "unterschrift"; text: string; gesehen_am: string | null; erstellt_am: string; kunde: { name: string } | null };

export async function eingabenLaden(limit = 50): Promise<Eingabe[]> {
  const { data } = await db().from("kundenbildschirm_eingaben").select("*, kunde:kunden(name)").order("erstellt_am", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Eingabe[];
}

export async function eingabenGesehen(): Promise<void> {
  await db().from("kundenbildschirm_eingaben").update({ gesehen_am: new Date().toISOString() }).is("gesehen_am", null);
}

const ART_TITEL = { neu: "Neuer Kunde am Kundenbildschirm", geaendert: "Daten am Kundenbildschirm geändert", unterschrift: "Auftrag am Kundenbildschirm unterschrieben" } as const;

/** Hinweis in der Verwaltung und Push an Inhaber und Büro. */
async function eingabeMelden(kundeId: string, art: Eingabe["art"], text: string, url: string): Promise<void> {
  await db().from("kundenbildschirm_eingaben").insert({ kunde_id: kundeId, art, text });
  after(() => pushSenden({ rollen: ["inhaber", "buero"] }, { titel: ART_TITEL[art], text, url, tag: `kundenbildschirm-${kundeId}` }));
}

// ---------------------------------------------------------------------------
// Kunde finden und speichern
// ---------------------------------------------------------------------------

export type BildschirmFahrzeug = { id: string; kennzeichen: string; marke: string; modell: string; km_stand: number | null };

export type BildschirmKunde = {
  id: string;
  name: string;
  firma: string;
  ust_id: string;
  telefon: string;
  email: string;
  strasse: string;
  plz: string;
  ort: string;
  datenschutz: boolean;
  whatsapp: boolean;
  erinnerung: boolean;
  fahrzeuge: BildschirmFahrzeug[];
};

const SPALTEN =
  "id, name, firma, ust_id, telefon, email, strasse, plz, ort, datenschutz_am, whatsapp_ok_am, erinnerung_mail_ok_am, fahrzeuge(id, kennzeichen, marke, modell, marke_modell, km_stand)";

type KundeZeile = Omit<BildschirmKunde, "datenschutz" | "whatsapp" | "erinnerung" | "fahrzeuge"> & {
  datenschutz_am: string | null;
  whatsapp_ok_am: string | null;
  erinnerung_mail_ok_am: string | null;
  fahrzeuge: (BildschirmFahrzeug & { marke_modell: string })[];
};

function alsAnzeige(k: KundeZeile): BildschirmKunde {
  return {
    id: k.id,
    name: k.name,
    firma: k.firma,
    ust_id: k.ust_id,
    telefon: k.telefon,
    email: k.email,
    strasse: k.strasse,
    plz: k.plz,
    ort: k.ort,
    datenschutz: Boolean(k.datenschutz_am),
    whatsapp: Boolean(k.whatsapp_ok_am),
    erinnerung: Boolean(k.erinnerung_mail_ok_am),
    fahrzeuge: [...(k.fahrzeuge ?? [])]
      .sort((a, b) => a.kennzeichen.localeCompare(b.kennzeichen))
      // Ältere Fahrzeuge haben nur den gemeinsamen Text; dann steht er im Feld Marke, damit nichts verloren geht.
      .map((f) => ({ id: f.id, kennzeichen: f.kennzeichen, marke: f.marke || (!f.modell ? f.marke_modell : ""), modell: f.modell ?? "", km_stand: f.km_stand })),
  };
}

/** Kunden mit gleicher Telefonnummer, in jeder Schreibweise (verglichen über telefonVergleich). */
async function kundenMitTelefon(telefon: string, ohne?: string): Promise<KundeZeile[]> {
  const soll = telefonVergleich(telefon);
  if (soll.replace(/^49/, "").length < 6) return [];
  const { data, error } = await db().from("kunden").select(SPALTEN).ilike("telefon", `%${soll.slice(-4)}%`).limit(200);
  if (error) throw new DbFehler(error);
  return ((data ?? []) as unknown as KundeZeile[]).filter((k) => k.id !== ohne && k.telefon && telefonVergleich(k.telefon) === soll);
}

/**
 * Bestandskunde über Kennzeichen oder Telefonnummer. Nur genaue Treffer, keine Teilsuche: Wer am Bildschirm
 * sucht, soll den eigenen Eintrag finden und nicht in der Kartei blättern können.
 */
export async function kundenFinden(eingabe: string): Promise<BildschirmKunde[]> {
  const kz = kennzeichenNorm(eingabe);
  const treffer = new Map<string, KundeZeile>();
  if (kz.length >= 3 && /[A-ZÄÖÜ]/.test(kz)) {
    const { data: fz } = await db().from("fahrzeuge").select("kunde_id").eq("kennzeichen_norm", kz).maybeSingle();
    if (fz?.kunde_id) {
      const { data } = await db().from("kunden").select(SPALTEN).eq("id", fz.kunde_id).maybeSingle();
      if (data) treffer.set(fz.kunde_id, data as unknown as KundeZeile);
    }
  }
  if (/\d{5}/.test(eingabe.replace(/\D/g, "")) && !/[A-Za-zÄÖÜäöü]/.test(eingabe)) {
    for (const k of await kundenMitTelefon(eingabe)) treffer.set(k.id, k);
  }
  return [...treffer.values()].slice(0, 6).map(alsAnzeige);
}

export async function bildschirmKunde(id: string): Promise<BildschirmKunde | null> {
  const { data } = await db().from("kunden").select(SPALTEN).eq("id", id).maybeSingle();
  return data ? alsAnzeige(data as unknown as KundeZeile) : null;
}

export type FahrzeugEingabe = { id?: string; kennzeichen: string; marke: string; modell: string; km: number | null };

export type KundenEingabe = {
  name: string;
  firma: string;
  ust_id: string;
  telefon: string;
  email: string;
  strasse: string;
  plz: string;
  ort: string;
  whatsapp: boolean;
  erinnerung: boolean;
  fahrzeuge: FahrzeugEingabe[];
};

const FELDNAMEN: Record<string, string> = {
  name: "Name",
  firma: "Firma",
  ust_id: "USt-IdNr.",
  telefon: "Telefon",
  email: "E-Mail",
  strasse: "Straße",
  plz: "PLZ",
  ort: "Ort",
};

const markeModell = (f: FahrzeugEingabe) => ({ marke: f.marke, modell: f.modell, marke_modell: [f.marke, f.modell].filter(Boolean).join(" ") });

/**
 * Speichert, was der Kunde eingetragen hat, direkt in die Kartei. Neue Kunden werden vorher gegen Telefon,
 * E-Mail und Kennzeichen geprüft, damit niemand doppelt entsteht; ein bekanntes Auto wird nie umgehängt.
 * Einwilligungen tragen den Zeitpunkt, zu dem sie erteilt wurden; ein abgewähltes Häkchen nimmt sie zurück.
 */
export async function kundeSpeichern(id: string | null, e: KundenEingabe): Promise<string> {
  const jetzt = new Date().toISOString();
  const alt = id ? await bildschirmKunde(id) : null;
  if (id && !alt) throw new BildschirmFehler("fehlerAllgemein");

  const neueFahrzeuge = e.fahrzeuge.filter((f) => !f.id && f.kennzeichen);
  for (const f of neueFahrzeuge) {
    const { data } = await db().from("fahrzeuge").select("kunde_id").eq("kennzeichen_norm", kennzeichenNorm(f.kennzeichen)).maybeSingle();
    if (data && data.kunde_id !== id) throw new BildschirmFehler("fehlerKennzeichenFremd");
  }

  const stamm = { name: e.name, firma: e.firma, ust_id: e.ust_id, telefon: e.telefon, email: e.email.toLowerCase(), strasse: e.strasse, plz: e.plz, ort: e.ort };
  const einwilligung = {
    datenschutz_am: alt?.datenschutz ? undefined : jetzt,
    whatsapp_ok_am: e.whatsapp ? (alt?.whatsapp ? undefined : jetzt) : null,
    erinnerung_mail_ok_am: e.erinnerung ? (alt?.erinnerung ? undefined : jetzt) : null,
  };
  const ohneUnveraendert = Object.fromEntries(Object.entries(einwilligung).filter(([, v]) => v !== undefined));

  let kundeId = id;
  const geaendert: string[] = [];
  if (!alt) {
    const doppelt =
      (stamm.telefon && (await kundenMitTelefon(stamm.telefon)).length > 0) ||
      (stamm.email && (await db().from("kunden").select("id").ilike("email", stamm.email.replace(/[\\%_]/g, (z) => `\\${z}`)).limit(1)).data?.length);
    if (doppelt) throw new BildschirmFehler("fehlerSchonBekannt");
    const { data, error } = await db()
      .from("kunden")
      .insert({ ...stamm, ...ohneUnveraendert, notiz: "Selbst eingetragen am Kundenbildschirm." })
      .select("id, nummer")
      .single();
    if (error) throw new DbFehler(error);
    kundeId = data.id;
    await melden("kunde.angelegt", { kunde_id: data.id, nummer: data.nummer, name: stamm.name, quelle: "kundenbildschirm" });
  } else {
    for (const [feld, wert] of Object.entries(stamm)) if ((alt as Record<string, unknown>)[feld] !== wert) geaendert.push(FELDNAMEN[feld]);
    const { error } = await db().from("kunden").update({ ...stamm, ...ohneUnveraendert }).eq("id", alt.id);
    if (error) throw new DbFehler(error);
    if (e.whatsapp !== alt.whatsapp) geaendert.push(e.whatsapp ? "WhatsApp erlaubt" : "WhatsApp nicht mehr erlaubt");
    if (e.erinnerung !== alt.erinnerung) geaendert.push(e.erinnerung ? "Erinnerungen per Mail erlaubt" : "Erinnerungen per Mail nicht mehr erlaubt");
  }

  // Bekannte Fahrzeuge: nur Marke, Modell und km; das Kennzeichen bleibt, wie es in der Kartei steht.
  for (const f of e.fahrzeuge.filter((x) => x.id)) {
    const vorher = alt?.fahrzeuge.find((x) => x.id === f.id);
    if (!vorher) continue;
    const km = f.km ?? vorher.km_stand;
    if (vorher.marke === f.marke && vorher.modell === f.modell && vorher.km_stand === km) continue;
    await db().from("fahrzeuge").update({ ...markeModell(f), km_stand: km }).eq("id", f.id!).eq("kunde_id", kundeId!);
    geaendert.push(`Fahrzeug ${vorher.kennzeichen}`);
  }
  for (const f of neueFahrzeuge) {
    const kz = kennzeichenFormat(f.kennzeichen);
    const { error } = await dbRoh().from("fahrzeuge").insert({ kunde_id: kundeId, kennzeichen: kz, ...markeModell(f), km_stand: f.km });
    // Gleiches Kennzeichen beim selben Kunden (doppelt eingetippt): nichts zu tun
    if (error && error.code !== "23505") throw new DbFehler(error, { tabelle: "fahrzeuge" });
    if (!error) geaendert.push(`Fahrzeug ${kz} neu`);
  }

  const fahrzeugText = e.fahrzeuge.map((f) => f.kennzeichen).filter(Boolean).join(", ");
  if (!alt) {
    await eingabeMelden(kundeId!, "neu", `${stamm.name}${fahrzeugText ? ` · ${fahrzeugText}` : ""}`, `/app/kunden/${kundeId}`);
  } else if (geaendert.length) {
    await melden("kunde.geaendert", { kunde_id: kundeId, felder: geaendert, quelle: "kundenbildschirm" });
    await eingabeMelden(kundeId!, "geaendert", `${stamm.name}: ${geaendert.join(", ")}`, `/app/kunden/${kundeId}`);
  }
  return kundeId!;
}

// ---------------------------------------------------------------------------
// Werkstattauftrag am Bildschirm
// ---------------------------------------------------------------------------

export type BildschirmAuftrag = {
  terminId: string;
  nummer: string;
  kundeId: string | null;
  kundeName: string;
  termin: Record<Sprache, string>;
  fahrzeug: string;
  beschreibung: string;
  zeilen: { text: string; detail: string; betrag: number }[];
  netto: number;
  steuer: number;
  brutto: number;
  kostengrenze: number | null;
};

const terminText = (beginn: string): Record<Sprache, string> => {
  const format = (locale: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: ZONE, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(beginn));
  return { de: `${format("de-DE")} Uhr`, en: format("en-GB") };
};

/** Was der Bildschirm vom Auftrag zeigt; null, wenn er nicht (mehr) unterschrieben werden kann. */
export async function bildschirmAuftrag(terminId: string): Promise<BildschirmAuftrag | null> {
  const t = await auftragLaden(terminId);
  if (!t?.auftrag_nummer || t.auftrag_erteilt_am || !["angefragt", "bestaetigt", "erledigt"].includes(t.status)) return null;
  const positionen = t.auftrag_positionen ?? [];
  const s = berechne(positionen);
  return {
    terminId: t.id,
    nummer: t.auftrag_nummer,
    kundeId: t.kunde?.id ?? null,
    kundeName: t.kundeVoll?.name ?? t.kunde?.name ?? "",
    termin: terminText(t.beginn),
    fahrzeug: [t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · "),
    beschreibung: t.auftrag_beschreibung || t.notiz_kunde || "",
    zeilen: positionen.map((p, i) => ({
      text: p.rabatt ? rabattText(p) : p.text,
      detail: p.rabatt ? "" : `${String(p.menge).replace(".", ",")} ${p.einheit} × ${euroGenau(einzelpreisAnzeige(p, s, i))}${s.preisart === "netto" ? " netto" : ""}`,
      betrag: zeilenbetrag(s, i),
    })),
    netto: s.netto,
    steuer: s.steuer,
    brutto: s.brutto,
    kostengrenze: t.auftrag_kostengrenze_cent ?? null,
  };
}

/**
 * Aufträge des Kunden für heute, die noch nicht erteilt sind. Hat ein heutiger Termin noch keinen Auftrag,
 * wird er jetzt angelegt (aus den Leistungen des Termins): Der Kunde steht vor dem Bildschirm und soll ihn
 * gleich unterschreiben können.
 */
export async function heutigeAuftraege(kundeId: string): Promise<BildschirmAuftrag[]> {
  const heute = berlinDatum();
  const { data, error } = await db()
    .from("termine")
    .select("id, auftrag_nummer, auftrag_erteilt_am")
    .eq("kunde_id", kundeId)
    .in("status", ["angefragt", "bestaetigt"])
    .gte("beginn", berlin(heute).toISOString())
    .lt("beginn", berlin(plusTage(heute, 1)).toISOString())
    .order("beginn");
  if (error) throw new DbFehler(error);
  const auftraege: BildschirmAuftrag[] = [];
  for (const t of data ?? []) {
    if (t.auftrag_erteilt_am) continue;
    if (!t.auftrag_nummer) await auftragAnlegen(t.id, null);
    const a = await bildschirmAuftrag(t.id);
    if (a) auftraege.push(a);
  }
  return auftraege;
}

/**
 * Der Kunde unterschreibt am Bildschirm. Erlaubt nur für einen Auftrag, den das Büro geschickt hat, oder für
 * einen Termin des Kunden von heute: Der Schlüssel allein soll nicht jeden beliebigen Auftrag öffnen.
 */
export async function amBildschirmUnterschreiben(g: Geraet, terminId: string, kundeId: string | null, name: string, bild: string): Promise<void> {
  const a = await bildschirmAuftrag(terminId);
  if (!a) throw new BildschirmFehler("fehlerAuftrag");
  const geschickt = g.termin_id === terminId;
  const heute = kundeId && a.kundeId === kundeId && (await heutigeAuftraege(kundeId)).some((x) => x.terminId === terminId);
  if (!geschickt && !heute) throw new BildschirmFehler("fehlerAuftrag");
  try {
    await auftragErteilen(terminId, "unterschrift", { name, bild });
  } catch (error) {
    if (error instanceof TerminFehler) throw new BildschirmFehler("fehlerAuftrag");
    throw error;
  }
  await verlauf("termin", terminId, `Am Kundenbildschirm unterschrieben, AGB akzeptiert (${name})`);
  if (geschickt) await geschicktZuruecknehmen(g.id);
  if (a.kundeId) await eingabeMelden(a.kundeId, "unterschrift", `${name} · ${a.nummer}${a.fahrzeug ? ` · ${a.fahrzeug}` : ""}`, `/app/termine/${terminId}`);
}
