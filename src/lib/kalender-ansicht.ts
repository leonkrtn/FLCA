import { istDatum, plusTage, wochenbeginn } from "./zeit";

/**
 * Welche Stelle des Kalenders gerade offen ist (Tag, Woche oder Monat, dazu der Personen-Filter). Termine, die
 * man aus dem Kalender öffnet oder dort einträgt, tragen sie als `?kal=…` mit. So führen „Zurück“, Löschen und
 * Eintragen genau dorthin zurück, und das Menü markiert weiter „Kalender“. Ohne Datenbank, läuft auch im Browser.
 */
export type KalenderArt = "tag" | "woche" | "monat";
export type KalenderAnsicht = { art: KalenderArt; datum: string; person?: string };

/** Personen-Filter: eine Profil-ID oder „ohne“ (Termine ohne Mitarbeiter) */
const PERSON = /^([0-9a-f-]{36}|ohne)$/;
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Erster Tag des Monats zu einem Datum */
export function monatsbeginn(datum: string): string {
  return `${datum.slice(0, 7)}-01`;
}

/** Letzter Tag des Monats zu einem Datum */
export function monatsende(datum: string): string {
  const [j, m] = datum.split("-").map(Number);
  return new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
}

/** Tage, die die Monatsansicht zeigt: von Montag der ersten bis Sonntag der letzten Woche des Monats. */
export function monatsRaster(datum: string): string[] {
  const von = wochenbeginn(monatsbeginn(datum));
  const bis = plusTage(wochenbeginn(monatsende(datum)), 6);
  const tage: string[] = [];
  for (let d = von; d <= bis; d = plusTage(d, 1)) tage.push(d);
  return tage;
}

/** Ansicht aus den Suchparametern der Kalenderseite; ohne Angabe die Woche von `heute`. */
export function ansichtAusSuche(sp: { tag?: string; woche?: string; monat?: string; person?: string }, heute: string): KalenderAnsicht {
  const person = typeof sp.person === "string" && PERSON.test(sp.person) ? sp.person : undefined;
  if (istDatum(sp.tag)) return { art: "tag", datum: sp.tag };
  if (typeof sp.monat === "string" && MONAT.test(sp.monat)) return { art: "monat", datum: `${sp.monat}-01`, person };
  return { art: "woche", datum: wochenbeginn(istDatum(sp.woche) ? sp.woche : heute), person };
}

/** Adresse der Kalenderseite für eine Ansicht */
export function kalenderHref(a: KalenderAnsicht): string {
  const wert = a.art === "monat" ? a.datum.slice(0, 7) : a.datum;
  // Die Tagesansicht hat eine Spalte je Person und keinen Filter
  return `/admin/kalender?${a.art}=${wert}${a.person && a.art !== "tag" ? `&person=${a.person}` : ""}`;
}

/** Kurzform für `?kal=…`, z. B. „woche:2026-11-23“ oder „monat:2026-11-01:ohne“ */
export function kalWert(a: KalenderAnsicht): string {
  return [a.art, a.datum, a.art !== "tag" ? a.person : undefined].filter(Boolean).join(":");
}

/** `?kal=…` lesen; alles, was nicht passt, gilt als „nicht aus dem Kalender“. */
export function kalLesen(wert: unknown): KalenderAnsicht | null {
  if (typeof wert !== "string") return null;
  const [art, datum, person] = wert.split(":");
  if ((art !== "tag" && art !== "woche" && art !== "monat") || !istDatum(datum)) return null;
  if (person !== undefined && !PERSON.test(person)) return null;
  return { art, datum, ...(person && art !== "tag" && { person }) };
}

/** Hängt `kal=…` an eine Adresse, wenn eine Ansicht da ist. */
export function mitKal(href: string, a: KalenderAnsicht | null): string {
  if (!a) return href;
  return `${href}${href.includes("?") ? "&" : "?"}kal=${encodeURIComponent(kalWert(a))}`;
}
