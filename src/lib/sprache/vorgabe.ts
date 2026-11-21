import { istDatum, type Wiederholung } from "../zeit";

/**
 * Vom Sprechen ins Formular: Was erkannt wurde, steht in der Adresse des Formulars (?name=…&datum=…).
 * So bleibt das gewohnte Formular die Stelle, an der geprüft und gespeichert wird, und „Zurück“ geht.
 */

type Such = Record<string, string | string[] | undefined>;

const eins = (s: Such, k: string, max: number) => {
  const w = s[k];
  return (Array.isArray(w) ? w[0] : w)?.slice(0, max).trim() ?? "";
};
const uhr = (s: string) => (/^\d{2}:\d{2}$/.test(s) ? s : "");
const id = (s: string) => (/^[\w-]{1,64}$/.test(s) ? s : "");

const adresse = (pfad: string, werte: Record<string, string | string[] | number | null | undefined>) => {
  const p = new URLSearchParams({ sprache: "1" });
  for (const [k, v] of Object.entries(werte)) {
    if (Array.isArray(v)) v.forEach((x) => x && p.append(k, x));
    else if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  }
  return `${pfad}?${p}`;
};

export type TerminVorgabe = {
  leistungIds: string[];
  leistungFrei: string;
  dauer: string;
  datum: string;
  uhrzeit: string;
  name: string;
  telefon: string;
  email: string;
  kennzeichen: string;
  fahrzeug: string;
  notiz: string;
  mitarbeiter: string;
  /** In der Kartei gefunden: Kunde und Fahrzeug, an die der Termin direkt gehängt wird */
  kundeId?: string;
  fahrzeugId?: string;
};

export const terminAdresse = (v: Partial<TerminVorgabe>) =>
  adresse("/app/neu", {
    leistung: v.leistungIds,
    frei: v.leistungFrei,
    dauer: v.dauer,
    datum: v.datum,
    uhrzeit: v.uhrzeit,
    name: v.name,
    telefon: v.telefon,
    email: v.email,
    kennzeichen: v.kennzeichen,
    fahrzeug: v.fahrzeug,
    notiz: v.notiz,
    an: v.mitarbeiter,
    kunde: v.kundeId,
    fz: v.fahrzeugId,
  });

/** Nur wenn die Seite vom Sprechen kommt (?sprache=1); sonst bleibt das Formular leer wie bisher. */
export function terminVorgabeAus(s: Such): TerminVorgabe | null {
  if (eins(s, "sprache", 1) !== "1") return null;
  const leistung = s.leistung;
  const datum = eins(s, "datum", 10);
  return {
    leistungIds: (Array.isArray(leistung) ? leistung : leistung ? [leistung] : []).map(id).filter(Boolean).slice(0, 8),
    leistungFrei: eins(s, "frei", 120),
    dauer: /^\d{1,4}$/.test(eins(s, "dauer", 4)) ? eins(s, "dauer", 4) : "",
    datum: istDatum(datum) ? datum : "",
    uhrzeit: uhr(eins(s, "uhrzeit", 5)),
    name: eins(s, "name", 120),
    telefon: eins(s, "telefon", 40),
    email: eins(s, "email", 160),
    kennzeichen: eins(s, "kennzeichen", 16),
    fahrzeug: eins(s, "fahrzeug", 120),
    notiz: eins(s, "notiz", 1500),
    mitarbeiter: id(eins(s, "an", 64)),
  };
}

export type NotizVorgabe = {
  titel: string;
  text: string;
  datum: string;
  uhrzeit: string;
  wiederholung: Wiederholung;
  sichtbar: "privat" | "buero" | "";
  erinnernAn: string;
};

export const notizAdresse = (v: Partial<NotizVorgabe>) =>
  adresse("/app/notizen/neu", {
    titel: v.titel,
    text: v.text,
    datum: v.datum,
    uhrzeit: v.uhrzeit,
    wiederholung: v.wiederholung === "keine" ? "" : v.wiederholung,
    sichtbar: v.sichtbar,
    an: v.erinnernAn,
  });

const WIEDERHOLUNGEN: Wiederholung[] = ["keine", "taeglich", "woechentlich", "monatlich"];

export function notizVorgabeAus(s: Such): NotizVorgabe | null {
  if (eins(s, "sprache", 1) !== "1") return null;
  const datum = eins(s, "datum", 10);
  const w = eins(s, "wiederholung", 20) as Wiederholung;
  const sichtbar = eins(s, "sichtbar", 10);
  return {
    titel: eins(s, "titel", 200),
    text: eins(s, "text", 5000),
    datum: istDatum(datum) ? datum : "",
    uhrzeit: uhr(eins(s, "uhrzeit", 5)),
    wiederholung: WIEDERHOLUNGEN.includes(w) ? w : "keine",
    sichtbar: sichtbar === "buero" || sichtbar === "privat" ? sichtbar : "",
    erinnernAn: id(eins(s, "an", 64)),
  };
}
