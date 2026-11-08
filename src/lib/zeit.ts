/**
 * Zeitrechnung in Europe/Berlin über Intl statt einer festen Verschiebung. Mit +01:00 fest im Code
 * verrutschen alle Termine zwischen Ende März und Ende Oktober um eine Stunde.
 */

export const ZONE = "Europe/Berlin";

const teileFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function teile(datum: Date) {
  const t = Object.fromEntries(teileFormat.formatToParts(datum).map((p) => [p.type, p.value]));
  return { jahr: +t.year, monat: +t.month, tag: +t.day, stunde: +t.hour, minute: +t.minute, sekunde: +t.second };
}

/** Verschiebung von Berlin gegenüber UTC zu diesem Zeitpunkt, in Minuten (60 oder 120). */
export function verschiebungMin(datum: Date): number {
  const t = teile(datum);
  const alsUtc = Date.UTC(t.jahr, t.monat - 1, t.tag, t.stunde, t.minute, t.sekunde);
  return Math.round((alsUtc - Math.floor(datum.getTime() / 1000) * 1000) / 60000);
}

/** Berliner Ortszeit (Datum „YYYY-MM-DD“, Uhrzeit „HH:MM“) als Zeitpunkt. */
export function berlin(datum: string, uhrzeit = "00:00"): Date {
  const [j, m, d] = datum.split("-").map(Number);
  const [h, min] = uhrzeit.split(":").map(Number);
  const naiv = Date.UTC(j, m - 1, d, h, min);
  // Zweimal rechnen: am Tag der Zeitumstellung liegt die Verschiebung vor und nach der Uhrzeit anders.
  let zeitpunkt = naiv - verschiebungMin(new Date(naiv)) * 60000;
  zeitpunkt = naiv - verschiebungMin(new Date(zeitpunkt)) * 60000;
  return new Date(zeitpunkt);
}

/** Datum in Berlin als „YYYY-MM-DD“. */
export function berlinDatum(datum: Date = new Date()): string {
  const t = teile(datum);
  return `${t.jahr}-${String(t.monat).padStart(2, "0")}-${String(t.tag).padStart(2, "0")}`;
}

/** Uhrzeit in Berlin als „HH:MM“. */
export function berlinUhrzeit(datum: Date): string {
  const t = teile(datum);
  return `${String(t.stunde).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** Wochentag eines Datums „YYYY-MM-DD“: 1 = Montag … 7 = Sonntag. */
export function wochentag(datum: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const tag = new Date(`${datum}T12:00:00Z`).getUTCDay();
  return (tag === 0 ? 7 : tag) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Datum „YYYY-MM-DD“ plus n Tage. */
export function plusTage(datum: string, n: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Montag der Woche eines Datums. */
export function wochenbeginn(datum: string): string {
  return plusTage(datum, 1 - wochentag(datum));
}

/** „HH:MM“ → Minuten seit Mitternacht. */
export function minuten(uhrzeit: string): number {
  const [h, m] = uhrzeit.split(":").map(Number);
  return h * 60 + m;
}

/** Minuten seit Mitternacht → „HH:MM“. */
export function uhrzeit(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function istDatum(wert: unknown): wert is string {
  if (typeof wert !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const d = new Date(`${wert}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(wert);
}

/** Aktueller Zeitpunkt in Millisekunden (für Server-Komponenten, die einmal pro Anfrage rendern). */
export function jetztMs(): number {
  return Date.now();
}
