/**
 * Nummernkreis der Rechnungen: Format und Prüfung einer Änderung, ohne Datenbank (getestet). Läuft im
 * Browser (Warnungen im Bestätigungsdialog, während man tippt) und auf dem Server (dieselben Warnungen,
 * bevor gespeichert wird). Dass keine schon vergebene Nummer wieder drankommt, prüft zusätzlich die
 * Datenbank in `nummernkreis_einstellen`.
 */

export type Nummernkreis = { praefix: string; mit_jahr: boolean; stellen: number; naechste: number };

/** Die Nummer, die `rechnung_stellen` für diese Einstellung vergibt (wie dort: Präfix, Jahr-, Ziffern). */
export function nummerText(k: Nummernkreis, jahr: number): string {
  return `${k.praefix}${k.mit_jahr ? `${jahr}-` : ""}${String(k.naechste).padStart(k.stellen, "0")}`;
}

export const gleich = (a: Nummernkreis, b: Nummernkreis) => a.praefix === b.praefix && a.mit_jahr === b.mit_jahr && a.stellen === b.stellen && a.naechste === b.naechste;

/** Eingabefehler, die das Speichern verhindern. */
export function eingabeFehler(k: Nummernkreis): string | null {
  if (!Number.isInteger(k.naechste) || k.naechste < 1) return "Die nächste Nummer muss eine ganze Zahl ab 1 sein.";
  if (!Number.isInteger(k.stellen) || k.stellen < 1 || k.stellen > 8) return "Stellen: 1 bis 8.";
  // Sonst schneidet die Datenbank die Nummer ab (lpad kürzt), und 12345 würde bei 4 Stellen zu 1234.
  if (String(k.naechste).length > k.stellen) return `Die Nummer ${k.naechste} hat mehr als ${k.stellen} Stellen. Bitte mehr Stellen einstellen.`;
  if (k.praefix.length > 10) return "Das Präfix darf höchstens 10 Zeichen haben.";
  return null;
}

/**
 * Was eine Änderung bedeutet, als Sätze für den Bestätigungsdialog. Ohne gestellte Rechnungen ist es die
 * Einrichtung (etwa „letzte Nummer der alten Software + 1“), dann nur der Hinweis, wie es weitergeht.
 * Danach sind Lücken und Sprünge im Nummernkreis bei einer Betriebsprüfung zu erklären (GoBD).
 */
export function warnungen(alt: Nummernkreis, neu: Nummernkreis, gestellt: number, jahr: number): string[] {
  const w: string[] = [];
  if (!gestellt) return [`Die erste Rechnung im System bekommt die Nummer ${nummerText(neu, jahr)}.`];
  const format = alt.praefix !== neu.praefix || alt.mit_jahr !== neu.mit_jahr || alt.stellen !== neu.stellen;
  if (format) w.push(`Das Format ändert sich von ${nummerText(alt, jahr)} auf ${nummerText(neu, jahr)}. Rechnungen im alten Format bleiben, wie sie sind.`);
  if (!format && neu.naechste > alt.naechste) {
    const bis = neu.naechste - 1;
    w.push(`${alt.naechste === bis ? `Die Nummer ${bis} wird` : `Die Nummern ${alt.naechste} bis ${bis} werden`} übersprungen und nie vergeben. Diese Lücke muss bei einer Betriebsprüfung erklärt werden können.`);
  }
  if (!format && neu.naechste < alt.naechste) {
    w.push(`Die Nummer geht zurück von ${alt.naechste} auf ${neu.naechste}. Ist eine der folgenden Nummern schon vergeben, lehnt das System die Änderung ab, doppelte Rechnungsnummern sind nicht zulässig.`);
  }
  w.push(`Die nächste Rechnung bekommt die Nummer ${nummerText(neu, jahr)}. Die Änderung wird mit Zeit und Person im Ereignisprotokoll festgehalten.`);
  return w;
}
