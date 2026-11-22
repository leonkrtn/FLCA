import { kennzeichen as kennzeichenFormat, zahlAusText } from "../format";

/**
 * Datenübernahme aus den CSV-Dateien, die aus den alten Rechnungs-PDFs gezogen wurden (Einstellungen →
 * Datenübernahme). Hier steht nur das Lesen und Zuordnen, ohne Datenbank, damit es getestet ist. Das
 * Schreiben macht `src/lib/altbestand/uebernehmen.ts`.
 *
 * Drei Dateien, jede für sich erkannt an ihrer Kopfzeile:
 * - kunden.csv: ein Kunde je Zeile, mit allen Kennzeichen, KM-Ständen und seinen Rechnungsnummern
 * - rechnungen.csv: eine Rechnung je Zeile, mit Anschrift wie auf dem Beleg
 * - positionen.csv: die Positionen, zugeordnet über Rechnungsnummer, Datum und Kunde
 *
 * Rechnungsnummern sind im Altbestand nicht eindeutig (0005 und 0022 gibt es zweimal), deshalb hängt eine
 * Rechnung über Nummer und Name am Kunden und eine Position über Nummer, Datum und Name an der Rechnung.
 */

export type DateiArt = "kunden" | "rechnungen" | "positionen";

export type AltPosition = { pos: number | null; text: string; menge: string; einzel_cent: number; summe_cent: number };

export type AltRechnung = {
  nummer: string;
  korrektur: boolean;
  rechnungsdatum: string | null;
  leistungsdatum: string | null;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  kennzeichen: string;
  km_stand: number | null;
  /** „19“ oder „kleinunternehmer“ (§ 19 UStG, ohne Umsatzsteuer) */
  steuer: "19" | "kleinunternehmer";
  netto_cent: number | null;
  mwst_cent: number | null;
  brutto_cent: number | null;
  /** Was der Kunde tatsächlich zahlen sollte: Sonderpreis, mit durchlaufenden Posten oder brutto */
  endbetrag_cent: number | null;
  regulaer_cent: number | null;
  zahlart: string;
  datei: string;
  positionen: AltPosition[];
};

export type AltFahrzeug = { kennzeichen: string; km_stand: number | null; km_datum: string | null; marke_modell: string };

export type AltKunde = {
  /** Schlüssel innerhalb der Übernahme (kleingeschriebener Name) */
  schluessel: string;
  name: string;
  firma: string;
  anrede: string;
  strasse: string;
  plz: string;
  ort: string;
  notiz: string;
  fahrzeuge: AltFahrzeug[];
  rechnungen: AltRechnung[];
};

export type Plan = { kunden: AltKunde[]; hinweise: string[]; dateien: DateiArt[] };

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * CSV mit Semikolon (wie Excel es in Deutschland schreibt), Felder in Anführungszeichen dürfen Semikolon,
 * Zeilenumbrüche und verdoppelte Anführungszeichen enthalten. Byte-Order-Mark und leere Zeilen fallen weg.
 */
export function csvLesen(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const trenner = (t.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) >= (t.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = "";
  let inAnf = false;
  for (let i = 0; i < t.length; i++) {
    const z = t[i];
    if (inAnf) {
      if (z === '"' && t[i + 1] === '"') {
        feld += '"';
        i++;
      } else if (z === '"') inAnf = false;
      else feld += z;
    } else if (z === '"' && feld === "") inAnf = true;
    else if (z === trenner) {
      zeile.push(feld);
      feld = "";
    } else if (z === "\n" || z === "\r") {
      if (z === "\r" && t[i + 1] === "\n") i++;
      zeile.push(feld);
      if (zeile.some((f) => f.trim())) zeilen.push(zeile);
      zeile = [];
      feld = "";
    } else feld += z;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim())) zeilen.push(zeile);
  return zeilen;
}

/** Zeilen als Objekte über die Kopfzeile (Spaltennamen klein, ohne Leerzeichen am Rand). */
export function alsObjekte(zeilen: string[][]): Record<string, string>[] {
  const [kopf, ...rest] = zeilen;
  if (!kopf) return [];
  const namen = kopf.map((k) => k.trim().toLowerCase());
  return rest.map((z) => Object.fromEntries(namen.map((n, i) => [n, (z[i] ?? "").trim()])));
}

/** Welche der drei Dateien das ist, an den Spalten erkannt (der Dateiname kann umbenannt sein). */
export function dateiArt(kopf: string[]): DateiArt | null {
  const k = new Set(kopf.map((s) => s.trim().toLowerCase()));
  if (k.has("rechnung") && k.has("bezeichnung") && k.has("summe")) return "positionen";
  if (k.has("nummer") && k.has("datei") && k.has("endbetrag")) return "rechnungen";
  if (k.has("name") && k.has("rechnungen") && k.has("plz ort")) return "kunden";
  return null;
}

// ---------------------------------------------------------------------------
// Werte
// ---------------------------------------------------------------------------

/** „21.10.2025“ → „2025-10-21“; sonst null. */
export function isoDatum(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [t, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || t < 1 || t > 31) return null;
  return `${j}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}

/** „196,35“ → 19635 Cent; leer oder unlesbar → null. */
export function cent(s: string | undefined): number | null {
  const n = zahlAusText(s ?? "");
  return n === null ? null : Math.round(n * 100);
}

const LAENDER: Record<string, string> = { DE: "", RO: "Rumänien", UK: "Großbritannien", GB: "Großbritannien", AT: "Österreich", CH: "Schweiz", PL: "Polen", IT: "Italien", FR: "Frankreich", NL: "Niederlande" };

/** Ort mit Land, wenn es nicht Deutschland ist; die Kartei hat keine eigene Spalte dafür. */
function ortMitLand(ort: string, land: string): string {
  const l = land.trim().toUpperCase();
  if (!l || l === "DE") return ort;
  const name = LAENDER[l] ?? l;
  return ort ? `${ort}, ${name}` : name;
}

/** „63179 Obertshausen“ → PLZ und Ort; „Constanta (RO)“ → Ort mit Land; alles andere bleibt Ort. */
export function plzOrt(s: string): { plz: string; ort: string } {
  const t = s.trim();
  const land = t.match(/^(.*?)\s*\(([A-Z]{2})\)$/);
  const ohneLand = land ? land[1] : t;
  const m = ohneLand.match(/^(\d{5})\s+(.+)$/);
  const ergebnis = m ? { plz: m[1], ort: m[2].trim() } : { plz: "", ort: ohneLand };
  return land ? { ...ergebnis, ort: ortMitLand(ergebnis.ort, land[2]) } : ergebnis;
}

/** Kennzeichen nur, wenn es nach einem aussieht (mindestens eine Ziffer): „OF-SJ“ ist unvollständig. */
export function gueltigesKennzeichen(s: string): string {
  const kz = kennzeichenFormat(s);
  return /\d/.test(kz) && /[A-ZÄÖÜ]/.test(kz) && kz.length >= 4 ? kz : "";
}

const kzNorm = (s: string) => s.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");

/** Vergleich von Namen ohne Groß/klein, Bindestriche und doppelte Leerzeichen. */
export const nameNorm = (s: string) => s.toLowerCase().replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();

/** Wie viele Wörter zwei Namen teilen (für mehrdeutige Rechnungsnummern). */
function gemeinsameWoerter(a: string, b: string): number {
  const wa = new Set(nameNorm(a).split(" ").filter((w) => w.length > 2));
  return nameNorm(b).split(" ").filter((w) => wa.has(w)).length;
}

const istFirma = (anrede: string, name: string) => anrede.toLowerCase() === "firma" || /\b(gmbh|ug|ag|kg|ohg|gbr|e\.?\s?k\.?)\b/i.test(name);

// ---------------------------------------------------------------------------
// Zeilen → Datensätze
// ---------------------------------------------------------------------------

function rechnungAus(z: Record<string, string>): AltRechnung {
  const klein = /§\s?19|klein/i.test(z.steuer ?? "");
  const brutto = cent(z.brutto);
  const vereinbart = cent(z.vereinbarter_preis);
  const durchlaufend = cent(z.brutto_inkl_durchlaufend);
  return {
    nummer: z.nummer ?? "",
    korrektur: /korrektur|neufassung/i.test(z.fassung ?? ""),
    rechnungsdatum: isoDatum(z.datum ?? ""),
    leistungsdatum: isoDatum(z.leistungsdatum ?? ""),
    name: z.name ?? "",
    strasse: z.strasse ?? "",
    plz: z.plz ?? "",
    ort: ortMitLand(z.ort ?? "", z.land ?? ""),
    land: (z.land || "DE").toUpperCase(),
    kennzeichen: gueltigesKennzeichen(z.kennzeichen ?? ""),
    km_stand: /^\d+$/.test(z.km ?? "") ? Number(z.km) : null,
    steuer: klein ? "kleinunternehmer" : "19",
    netto_cent: cent(z.netto) ?? (klein ? brutto : null),
    mwst_cent: klein ? 0 : cent(z.mwst),
    brutto_cent: brutto,
    endbetrag_cent: cent(z.endbetrag) ?? durchlaufend ?? vereinbart ?? brutto,
    regulaer_cent: cent(z.regulaerpreis),
    zahlart: z.zahlart ?? "",
    datei: z.datei ?? "",
    positionen: [],
  };
}

function positionAus(z: Record<string, string>): AltPosition | null {
  const text = (z.bezeichnung ?? "").trim();
  const summe = cent(z.summe);
  if (!text && summe === null) return null;
  return { pos: /^\d+$/.test(z.pos ?? "") ? Number(z.pos) : null, text, menge: z.menge ?? "", einzel_cent: cent(z.einzel) ?? 0, summe_cent: summe ?? 0 };
}

/** „94609 (SE-YY 1943, 13.02.2026); 93865 (GG-AR 916, 23.10.2026)“ → KM je Kennzeichen. */
function kmStaende(s: string): { kennzeichen: string; km: number; datum: string | null }[] {
  return [...s.matchAll(/(\d+)\s*\(([^,)]*),\s*([\d.]+)\)/g)].map((m) => ({ kennzeichen: gueltigesKennzeichen(m[2]), km: Number(m[1]), datum: isoDatum(m[3]) }));
}

/** „fahrzeug: BMW 5 Touring; versicherungsnummer: 260-K-…“ → Schlüssel/Wert. */
function sonstiges(s: string): Record<string, string> {
  return Object.fromEntries(
    s
      .split(";")
      .map((t) => t.trim())
      .filter((t) => t.includes(":"))
      .map((t) => [t.slice(0, t.indexOf(":")).trim().toLowerCase(), t.slice(t.indexOf(":") + 1).trim()]),
  );
}

/** Mehrere Werte in einer Zelle („alt | neu“): der letzte ist der jüngste. */
const letzter = (s: string) => s.split("|").map((t) => t.trim()).filter(Boolean).at(-1) ?? "";

/**
 * Aus den gelesenen Dateien einen Plan machen: welcher Kunde mit welchen Fahrzeugen und Rechnungen.
 * Jede Datei ist freiwillig. Ohne kunden.csv entstehen die Kunden aus den Rechnungen, ohne rechnungen.csv
 * kommen nur Kunden und Fahrzeuge, Positionen ohne Rechnung werden gemeldet und übergangen.
 */
export function planen(dateien: Partial<Record<DateiArt, Record<string, string>[]>>): Plan {
  const hinweise: string[] = [];
  const kunden = new Map<string, AltKunde>();
  const nummerZuKunden = new Map<string, AltKunde[]>();

  const neuerKunde = (name: string, anrede = ""): AltKunde => {
    const schluessel = nameNorm(name);
    const k = kunden.get(schluessel) ?? { schluessel, name, firma: "", anrede, strasse: "", plz: "", ort: "", notiz: "", fahrzeuge: [], rechnungen: [] };
    kunden.set(schluessel, k);
    return k;
  };
  const fahrzeugMerken = (k: AltKunde, kz: string, km: number | null, datum: string | null, markeModell = "") => {
    if (!kz) return;
    const f = k.fahrzeuge.find((x) => kzNorm(x.kennzeichen) === kzNorm(kz));
    if (!f) return void k.fahrzeuge.push({ kennzeichen: kz, km_stand: km, km_datum: km ? datum : null, marke_modell: markeModell });
    // Der jüngste KM-Stand gilt; ohne Datum der höhere.
    if (km && (!f.km_stand || (datum && (!f.km_datum || datum >= f.km_datum)) || (!datum && km > f.km_stand))) Object.assign(f, { km_stand: km, km_datum: datum ?? f.km_datum });
    if (markeModell && !f.marke_modell) f.marke_modell = markeModell;
  };

  for (const z of dateien.kunden ?? []) {
    const name = z.name?.trim();
    if (!name) continue;
    const k = neuerKunde(name, z.anrede ?? "");
    const so = sonstiges(z.sonstiges ?? "");
    const ort = plzOrt(letzter(z["plz ort"] ?? ""));
    Object.assign(k, { name, anrede: z.anrede ?? "", strasse: letzter(z["straße"] ?? z.strasse ?? ""), plz: ort.plz, ort: ort.ort });
    // Firmen stehen mit ihrem Namen im Feld Name; Firma nur, wenn es einen Ansprechpartner gibt, sonst
    // stünde der Name auf jedem neuen Beleg zweimal untereinander.
    if (so.ansprechpartner) Object.assign(k, { firma: name, name: so.ansprechpartner });
    const kennzeichen = (z.kennzeichen ?? "").split(",").map(gueltigesKennzeichen).filter(Boolean);
    const km = kmStaende(z["km-stände"] ?? "");
    for (const kz of kennzeichen) {
      const letzterKm = km.filter((x) => kzNorm(x.kennzeichen) === kzNorm(kz)).sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? "")).at(-1);
      fahrzeugMerken(k, kz, letzterKm?.km ?? null, letzterKm?.datum ?? null, kennzeichen.length === 1 ? (so.fahrzeug ?? "") : "");
    }
    k.notiz = notizAus(k, so, kennzeichen.length === 1);
    for (const n of (z.rechnungen ?? "").split(",").map((s) => s.replace("*", "").trim()).filter(Boolean)) {
      nummerZuKunden.set(n, [...(nummerZuKunden.get(n) ?? []), k]);
    }
  }

  // Rechnungen: über die Nummernliste der Kundendatei, bei doppelten Nummern über den Namen.
  const rechnungen = new Map<string, AltRechnung>();
  for (const z of dateien.rechnungen ?? []) {
    const r = rechnungAus(z);
    if (!r.datei) {
      hinweise.push(`Rechnung ${r.nummer || "ohne Nummer"} (${r.name}) ohne Dateiname übergangen.`);
      continue;
    }
    const kandidaten = nummerZuKunden.get(r.nummer) ?? [];
    let k =
      kandidaten.length === 1
        ? kandidaten[0]
        : kandidaten.find((x) => nameNorm(x.name) === nameNorm(r.name) || nameNorm(x.firma) === nameNorm(r.name)) ??
          [...kandidaten].sort((a, b) => gemeinsameWoerter(r.name, b.firma || b.name) - gemeinsameWoerter(r.name, a.firma || a.name))[0];
    if (!k && !r.name.trim()) {
      hinweise.push(`Rechnung ${r.nummer} (${r.datei}) ohne Kunde übergangen.`);
      continue;
    }
    if (!k) {
      if (dateien.kunden) hinweise.push(`Rechnung ${r.nummer} (${r.name}) steht in keiner Zeile der Kundendatei, der Kunde wird aus der Rechnung angelegt.`);
      k = neuerKunde(r.name, z.anrede ?? "");
    }
    k.rechnungen.push(r);
    rechnungen.set(posSchluessel(r.nummer, z.datum ?? "", r.name), r);
    fahrzeugMerken(k, r.kennzeichen, r.km_stand, r.rechnungsdatum);
  }

  // Anschrift: die der jüngsten Rechnung ist sauberer (PLZ, Ort, Land getrennt) als die Sammelzeile. Am
  // selben Tag gewinnt die Korrektur, denn meist wurde gerade die Anschrift korrigiert.
  for (const k of kunden.values()) {
    const quelle = k.rechnungen
      .filter((r) => r.strasse || r.plz)
      .sort((a, b) => (a.rechnungsdatum ?? "").localeCompare(b.rechnungsdatum ?? "") || Number(a.korrektur) - Number(b.korrektur))
      .at(-1);
    if (quelle) Object.assign(k, { strasse: quelle.strasse || k.strasse, plz: quelle.plz || (quelle.strasse ? "" : k.plz), ort: quelle.ort || k.ort });
    if (!dateien.kunden) k.notiz = notizAus(k, {}, false);
  }

  let ohne = 0;
  for (const z of dateien.positionen ?? []) {
    const r = rechnungen.get(posSchluessel(z.rechnung ?? "", z.datum ?? "", z.kunde ?? ""));
    const p = positionAus(z);
    if (!p) continue;
    if (r) r.positionen.push(p);
    else ohne++;
  }
  if (ohne) hinweise.push(dateien.rechnungen ? `${ohne} Positionen passen zu keiner Rechnung und wurden übergangen.` : "Positionen gehen nur zusammen mit rechnungen.csv, sie wurden übergangen.");

  // Gleiches Kennzeichen bei zwei Kunden: das Auto gehört dem mit der jüngsten Rechnung dazu.
  const halter = new Map<string, { k: AltKunde; datum: string }>();
  for (const k of kunden.values()) {
    for (const f of k.fahrzeuge) {
      const datum = k.rechnungen.filter((r) => kzNorm(r.kennzeichen) === kzNorm(f.kennzeichen)).map((r) => r.rechnungsdatum ?? "").sort().at(-1) ?? "";
      const vorher = halter.get(kzNorm(f.kennzeichen));
      if (!vorher || datum > vorher.datum) {
        if (vorher) hinweise.push(`Kennzeichen ${f.kennzeichen} steht bei ${vorher.k.name} und ${k.name}, es kommt zu ${k.name}.`);
        halter.set(kzNorm(f.kennzeichen), { k, datum });
      } else hinweise.push(`Kennzeichen ${f.kennzeichen} steht bei ${vorher.k.name} und ${k.name}, es kommt zu ${vorher.k.name}.`);
    }
  }
  for (const k of kunden.values()) k.fahrzeuge = k.fahrzeuge.filter((f) => halter.get(kzNorm(f.kennzeichen))?.k === k);

  return { kunden: [...kunden.values()], hinweise, dateien: (Object.keys(dateien) as DateiArt[]).filter((d) => dateien[d]) };
}

const posSchluessel = (nummer: string, datum: string, name: string) => `${nummer.trim()}|${datum.trim()}|${nameNorm(name)}`;

/** Was keine eigene Spalte hat, kommt in die Notiz des Kunden. */
function notizAus(k: AltKunde, so: Record<string, string>, einFahrzeug: boolean): string {
  const teile = [
    so.fahrzeug && !einFahrzeug ? `Fahrzeug: ${so.fahrzeug}` : "",
    so.versicherungsnummer ? `Versicherungsnummer: ${so.versicherungsnummer}` : "",
    istFirma(k.anrede, k.firma || k.name) ? "Geschäftskunde" : "",
  ].filter(Boolean);
  return teile.length ? `Aus alten Rechnungen: ${teile.join(", ")}` : "";
}

/** Kurzfassung des Plans für die Rückmeldung. */
export function zaehlen(p: Plan) {
  return {
    kunden: p.kunden.length,
    fahrzeuge: p.kunden.reduce((s, k) => s + k.fahrzeuge.length, 0),
    rechnungen: p.kunden.reduce((s, k) => s + k.rechnungen.length, 0),
    positionen: p.kunden.reduce((s, k) => s + k.rechnungen.reduce((t, r) => t + r.positionen.length, 0), 0),
  };
}
