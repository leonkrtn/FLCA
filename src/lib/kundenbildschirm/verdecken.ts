/**
 * Daten eines Bestandskunden am Kundenbildschirm nur teilweise zeigen. Gefunden wird er über Kennzeichen oder
 * Telefonnummer, und ein Kennzeichen steht sichtbar am Auto auf dem Hof: Wer fremde Daten so abfragt, soll nicht
 * Name, Telefon, E-Mail und Anschrift eines anderen lesen können (Art. 5 Abs. 1 lit. f, Art. 32 DSGVO). Der Kunde
 * erkennt sich trotzdem wieder; was er ändern will, tippt er neu ein, leere Felder bleiben wie gespeichert.
 * Ohne Abhängigkeiten, damit es getestet werden kann.
 */

export type Stamm = { name: string; firma: string; ust_id: string; telefon: string; email: string; strasse: string; plz: string; ort: string };
export const STAMMFELDER = ["name", "firma", "ust_id", "telefon", "email", "strasse", "plz", "ort"] as const satisfies readonly (keyof Stamm)[];

const P = "•";

/** „Max Mustermann“ → „Max M.“, „Müller“ → „M•••••“ */
export function nameVerdecken(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "";
  if (teile.length === 1) return teile[0][0] + P.repeat(Math.max(teile[0].length - 1, 2));
  return [teile[0], ...teile.slice(1).map((t) => `${t[0]}.`)].join(" ");
}

/** Nur die letzten drei Ziffern: „0170 1234567“ → „•••• 567“ */
export function telefonVerdecken(telefon: string): string {
  const ziffern = telefon.replace(/\D/g, "");
  if (!ziffern) return "";
  return ziffern.length < 6 ? P.repeat(4) : `${P.repeat(4)} ${ziffern.slice(-3)}`;
}

/** „max.muster@gmail.com“ → „m•••@g•••.com“ */
export function emailVerdecken(email: string): string {
  const [lokal, domain] = email.trim().split("@");
  if (!lokal || !domain) return email ? P.repeat(4) : "";
  const punkt = domain.lastIndexOf(".");
  const endung = punkt > 0 ? domain.slice(punkt) : "";
  return `${lokal[0]}${P.repeat(3)}@${domain[0]}${P.repeat(3)}${endung}`;
}

/** Anfang zeigen, Rest verdecken: für Firma, USt-IdNr. und PLZ */
function anfang(wert: string, n: number): string {
  const w = wert.trim();
  if (!w) return "";
  return w.slice(0, n) + P.repeat(Math.max(w.length - n, 3));
}

export function stammVerdecken(s: Stamm): Stamm {
  return {
    name: nameVerdecken(s.name),
    firma: anfang(s.firma, 3),
    ust_id: anfang(s.ust_id, 2),
    telefon: telefonVerdecken(s.telefon),
    email: emailVerdecken(s.email),
    strasse: s.strasse.trim() ? P.repeat(6) : "",
    plz: anfang(s.plz, 2),
    // Der Ort allein verrät niemanden und hilft dem Kunden, sich wiederzuerkennen.
    ort: s.ort,
  };
}

/** Beim Speichern: Leer gelassene Felder eines Bestandskunden behalten den gespeicherten Wert. */
export function stammZusammenfuehren(alt: Stamm, neu: Stamm): Stamm {
  return Object.fromEntries(STAMMFELDER.map((f) => [f, neu[f].trim() ? neu[f] : alt[f]])) as Stamm;
}
