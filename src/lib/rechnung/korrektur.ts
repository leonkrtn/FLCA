// Regeln der Rechnungskorrektur ohne Datenbank (getestet in korrektur.test.ts). Läuft auf dem Server und im
// Browser, deshalb ohne Abhängigkeiten.

type MitZahlung = { summe_brutto_cent: number; bereits_bezahlt_cent?: number | null; bezahlt_am?: string | null };

/**
 * Was der Kunde auf eine Rechnung schon gezahlt hat und die Korrektur deshalb verrechnet. Eine bezahlte
 * Rechnung gilt als voll bezahlt (Teilzahlungen kennt das System nicht), eine offene trägt nur weiter, was
 * sie selbst schon von ihrer Vorgängerin übernommen hat. Maßgeblich ist `bezahlt_am`, nicht der Status: Nach
 * dem Storno steht das Original auf „storniert“, die Zahlung bleibt aber vermerkt.
 */
export function bereitsBezahlt(original: MitZahlung): number {
  const uebernommen = Number(original.bereits_bezahlt_cent ?? 0);
  return original.bezahlt_am ? Math.max(Number(original.summe_brutto_cent), uebernommen) : uebernommen;
}

/** Noch zu zahlen (positiv) oder zu erstatten (negativ), nach Abzug des schon Gezahlten. */
export function offenerBetrag(r: MitZahlung): number {
  return Number(r.summe_brutto_cent) - Number(r.bereits_bezahlt_cent ?? 0);
}

/** Die Korrektur ist mit dem schon Gezahlten erledigt, wenn nichts mehr offen ist (dann gleich „bezahlt“). */
export function durchZahlungErledigt(r: MitZahlung): boolean {
  return Number(r.bereits_bezahlt_cent ?? 0) > 0 && offenerBetrag(r) <= 0;
}

/**
 * Betrag, den der DATEV-Export als Zahlungseingang bucht. Was schon auf das Original gezahlt wurde, steht
 * dort bereits als Zahlung und darf nicht ein zweites Mal gebucht werden.
 */
export function zahlungseingang(r: MitZahlung): number {
  return Math.max(0, offenerBetrag(r));
}

/**
 * Nummer der neuen Fassung, wie `rechnung_korrektur_stellen` sie vergibt (dort gilt sie, hier nur für die
 * Anzeige im Entwurf): Nummer des Originals ohne Fassung, dann die nächste freie Fassung. Abgeschnitten wird
 * nur, wenn das Original selbst eine Korrektur ist, sonst würde aus „RE.0001“ (Präfix „RE.“) „RE“.
 */
export function fassungsNummer(original: string, originalIstKorrektur: boolean, vergeben: string[]): string {
  const wurzel = originalIstKorrektur ? original.replace(/\.[0-9]+$/, "") : original;
  const hoechste = vergeben
    .filter((n) => n.startsWith(`${wurzel}.`) && /^[0-9]{1,6}$/.test(n.slice(wurzel.length + 1)))
    .reduce((m, n) => Math.max(m, Number(n.slice(wurzel.length + 1))), 0);
  return `${wurzel}.${hoechste + 1}`;
}

/** Pflichtgrund prüfen: leer oder nur Leerzeichen gilt nicht. */
export function grundPruefen(grund: string): string {
  const g = grund.trim().replace(/\s+/g, " ");
  if (g.length < 3) throw new Error("Bitte den Grund der Korrektur angeben (z. B. „falsche Anschrift“, „Position vergessen“).");
  return g.slice(0, 300);
}

/**
 * Stand einer Stornorechnung in Worten. Offen („gestellt“) ist sie nur, wenn auf das Original gezahlt wurde;
 * „bezahlt“ ohne Zahlungsart heißt erledigt ohne Geldfluss (siehe stornieren() in rechnungen.ts).
 */
export function stornoStand(r: { status: string; zahlungsart?: string | null }): string {
  if (r.status === "gestellt") return "Zu erstatten";
  if (r.status === "bezahlt") return r.zahlungsart ? "Erstattet" : "Erledigt";
  return "Storno";
}
