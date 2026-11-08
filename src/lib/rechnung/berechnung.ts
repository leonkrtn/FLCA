/**
 * Rechnungsbeträge in Cent. Privatkunden sehen Bruttopreise (40 € Radwechsel), die E-Rechnung verlangt
 * aber Nettobeträge mit Steuer = Netto × Satz, auf den Cent gerundet (Regel BR-CO-17). Aus 40,00 € brutto
 * wird deshalb Netto 33,61 € + 6,39 € Steuer = 40,00 €. Wo es kein solches Paar gibt, wird der Bruttobetrag
 * um höchstens einen Cent angepasst und die Abweichung ausgewiesen.
 */

export type Position = {
  text: string;
  menge: number;
  einheit: string;
  einzel_brutto_cent: number;
  mwst_satz: number;
  /** Herkunft aus dem Angebot (leistungen.id). Heißt aus historischen Gründen noch artikel_id. */
  artikel_id?: string | null;
};

export type Steuergruppe = { satz: number; netto: number; steuer: number; brutto: number };

export type Summen = {
  netto: number;
  steuer: number;
  brutto: number;
  gruppen: Steuergruppe[];
  /** Nettobetrag je Position (für die E-Rechnung), Summe = Netto der Gruppe */
  zeilenNetto: number[];
  zeilenBrutto: number[];
};

/** Kaufmännisch runden, symmetrisch für negative Beträge (Storno). */
export function runden(wert: number): number {
  return Math.sign(wert) * Math.round(Math.abs(wert) + 1e-9);
}

export function zeilenBrutto(p: Position): number {
  return runden(p.menge * p.einzel_brutto_cent);
}

/** Netto-Basis zu einem Bruttobetrag, sodass Basis + runden(Basis × Satz) möglichst genau den Bruttobetrag ergibt. */
export function nettoAusBrutto(brutto: number, satz: number): { netto: number; steuer: number } {
  const faktor = 1 + satz / 100;
  const schaetzung = runden(brutto / faktor);
  let bestes = { netto: schaetzung, steuer: runden((schaetzung * satz) / 100) };
  for (const d of [0, -1, 1, -2, 2]) {
    const netto = schaetzung + d;
    const steuer = runden((netto * satz) / 100);
    if (netto + steuer === brutto) return { netto, steuer };
    if (Math.abs(netto + steuer - brutto) < Math.abs(bestes.netto + bestes.steuer - brutto)) bestes = { netto, steuer };
  }
  return bestes;
}

export function berechne(positionen: Position[]): Summen {
  const brutto = positionen.map(zeilenBrutto);
  const saetze = [...new Set(positionen.map((p) => p.mwst_satz))].sort((a, b) => b - a);
  const zeilenNetto = new Array<number>(positionen.length).fill(0);
  const gruppen: Steuergruppe[] = [];

  for (const satz of saetze) {
    const indizes = positionen.map((p, i) => (p.mwst_satz === satz ? i : -1)).filter((i) => i >= 0);
    const gruppeBrutto = indizes.reduce((s, i) => s + brutto[i], 0);
    const { netto, steuer } = nettoAusBrutto(gruppeBrutto, satz);
    // Zeilen-Netto proportional verteilen, Rundungsrest auf die betragsmäßig größte Zeile
    let verteilt = 0;
    for (const i of indizes) {
      zeilenNetto[i] = gruppeBrutto === 0 ? 0 : runden((brutto[i] * netto) / gruppeBrutto);
      verteilt += zeilenNetto[i];
    }
    if (indizes.length) {
      const groesste = indizes.reduce((a, b) => (Math.abs(brutto[b]) > Math.abs(brutto[a]) ? b : a));
      zeilenNetto[groesste] += netto - verteilt;
    }
    gruppen.push({ satz, netto, steuer, brutto: netto + steuer });
  }

  const netto = gruppen.reduce((s, g) => s + g.netto, 0);
  const steuer = gruppen.reduce((s, g) => s + g.steuer, 0);
  return { netto, steuer, brutto: netto + steuer, gruppen, zeilenNetto, zeilenBrutto: brutto };
}
