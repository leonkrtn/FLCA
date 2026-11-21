/**
 * Rechnungsbeträge in Cent. Die E-Rechnung verlangt Nettobeträge mit Steuer = Netto × Satz, auf den Cent
 * gerundet (Regel BR-CO-17).
 *
 * Seit der Umstellung auf Netto werden Belege netto erfasst (`einzel_netto_cent`). Runde Bruttopreise der
 * Preisliste (40 € Radwechsel) kommen als Netto mit Bruchteil eines Cents in den Beleg (3361,34), damit
 * daraus brutto wieder genau 40,00 € werden, auch bei Menge 2 oder 3.
 *
 * Belege von vor der Umstellung speichern `einzel_brutto_cent`. Gestellte Rechnungen sind unveränderlich und
 * ihr PDF wird aus den gespeicherten Daten neu erzeugt, deshalb rechnet `berechne` sie weiter genau wie
 * damals: aus 40,00 € brutto wird Netto 33,61 € + 6,39 € Steuer.
 */

export type Rabatt = { prozent?: number | null; betrag_cent?: number | null };

export type Position = {
  text: string;
  menge: number;
  einheit: string;
  /** Netto-Einzelpreis in Cent, auf Hundertstel Cent genau (aus runden Bruttopreisen). */
  einzel_netto_cent?: number;
  /** Nur alte Belege: Brutto-Einzelpreis in Cent. */
  einzel_brutto_cent?: number;
  mwst_satz: number;
  /** Herkunft aus der Preisliste (leistungen.id). Heißt aus historischen Gründen noch artikel_id. */
  artikel_id?: string | null;
  /** Lohn (Einheit „Std“): Name des Stundensatzes aus den Einstellungen, z. B. „Mechanik“. */
  lohnart?: string | null;
  /** Teil: Einkaufspreis netto je Einheit. Nur intern, erscheint nie im PDF oder in der E-Rechnung. */
  ek_cent?: number | null;
  /** Teil: Aufschlag auf den Einkaufspreis in Prozent. */
  aufschlag?: number | null;
  /** Rabattzeile: gilt für alle anderen Positionen des Belegs, Prozent oder fester Nettobetrag. */
  rabatt?: Rabatt | null;
};

export type Steuergruppe = {
  satz: number;
  /** Netto nach Rabatt = Bemessungsgrundlage */
  netto: number;
  steuer: number;
  brutto: number;
  /** Summe der Positionen vor Rabatt */
  basis: number;
  /** Rabatt auf diese Gruppe (positiv = Abzug) */
  rabatt: number;
};

export type Summen = {
  /** „netto“ für neue Belege, „brutto“ für alte (Preise brutto gespeichert) */
  preisart: "netto" | "brutto";
  netto: number;
  steuer: number;
  brutto: number;
  /** Summe der Positionen vor Rabatt (netto) */
  basis: number;
  /** Rabatt gesamt (netto, positiv = Abzug) */
  rabatt: number;
  gruppen: Steuergruppe[];
  /** Nettobetrag je Position (für die E-Rechnung), Summe = Netto der Gruppe; Rabattzeilen negativ */
  zeilenNetto: number[];
  /** Bruttobetrag je Position (bei neuen Belegen nur zur Anzeige) */
  zeilenBrutto: number[];
};

/** Kaufmännisch runden, symmetrisch für negative Beträge (Storno). */
export function runden(wert: number): number {
  return Math.sign(wert) * Math.round(Math.abs(wert) + 1e-9);
}

/** Auf Hundertstel Cent runden (vier Nachkommastellen in Euro, so viel erlaubt die E-Rechnung beim Einzelpreis). */
export function centGenau(wert: number): number {
  return Math.sign(wert) * Math.round(Math.abs(wert) * 100 + 1e-7) / 100;
}

export const istRabatt = (p: Position) => Boolean(p.rabatt);

/** Alter Beleg: Preis brutto gespeichert, kein Nettopreis. */
export const istAlt = (p: Position) => p.einzel_netto_cent == null && p.einzel_brutto_cent != null;

/** Netto aus einem Bruttopreis, so genau, dass brutto für jede Menge wieder genau herauskommt. */
export function nettoAusBruttoPreis(bruttoCent: number, satz: number): number {
  return centGenau(bruttoCent / (1 + satz / 100));
}

/** Eine Position von brutto auf netto umstellen (alte Entwürfe beim Öffnen im Editor). */
export function alsNetto(p: Position): Position {
  if (!istAlt(p)) return p;
  const { einzel_brutto_cent, ...rest } = p;
  return { ...rest, einzel_netto_cent: nettoAusBruttoPreis(einzel_brutto_cent ?? 0, p.mwst_satz) };
}

/** Preis eines Teils aus Einkaufspreis und Aufschlag. */
export function ausEk(ekCent: number, aufschlag: number): number {
  return runden(ekCent * (1 + aufschlag / 100));
}

/** Alle Beträge umdrehen (Storno; in der E-Rechnung zurück ins Positive). Prozent-Rabatte drehen sich über die Positionen mit. */
export function vorzeichenWechseln(positionen: Position[]): Position[] {
  return positionen.map((p) => ({
    ...p,
    ...(p.einzel_netto_cent != null && { einzel_netto_cent: -p.einzel_netto_cent }),
    ...(p.einzel_brutto_cent != null && { einzel_brutto_cent: -p.einzel_brutto_cent }),
    ...(p.rabatt?.betrag_cent != null && { rabatt: { ...p.rabatt, betrag_cent: -p.rabatt.betrag_cent } }),
  }));
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
  if (positionen.length && positionen.every(istAlt)) return berechneBrutto(positionen);
  return berechneNetto(positionen.map(alsNetto));
}

/** Neue Belege: Zeile = Menge × Netto, Steuer je Satz auf die Gruppensumme nach Rabatt. */
function berechneNetto(positionen: Position[]): Summen {
  const zeilenNetto = positionen.map((p) => (istRabatt(p) ? 0 : runden(p.menge * (p.einzel_netto_cent ?? 0))));
  const saetze = [...new Set(positionen.filter((p) => !istRabatt(p)).map((p) => p.mwst_satz))].sort((a, b) => b - a);
  const basis = new Map(saetze.map((s) => [s, 0]));
  positionen.forEach((p, i) => {
    if (!istRabatt(p)) basis.set(p.mwst_satz, (basis.get(p.mwst_satz) ?? 0) + zeilenNetto[i]);
  });
  const gesamtBasis = [...basis.values()].reduce((a, b) => a + b, 0);

  // Rabatt je Steuersatz aufteilen: Die E-Rechnung braucht den Nachlass getrennt nach Satz.
  const abzug = new Map(saetze.map((s) => [s, 0]));
  const rabattJeZeile = new Map<number, Map<number, number>>();
  positionen.forEach((p, i) => {
    if (!p.rabatt) return;
    const anteil = new Map<number, number>();
    if (p.rabatt.prozent) {
      for (const s of saetze) anteil.set(s, runden(((basis.get(s) ?? 0) * p.rabatt.prozent) / 100));
    } else if (p.rabatt.betrag_cent && gesamtBasis !== 0) {
      let verteilt = 0;
      for (const s of saetze) {
        const a = runden((p.rabatt.betrag_cent * (basis.get(s) ?? 0)) / gesamtBasis);
        anteil.set(s, a);
        verteilt += a;
      }
      // Rundungsrest auf die größte Gruppe
      const groesste = saetze.reduce((a, b) => (Math.abs(basis.get(b) ?? 0) > Math.abs(basis.get(a) ?? 0) ? b : a));
      anteil.set(groesste, (anteil.get(groesste) ?? 0) + p.rabatt.betrag_cent - verteilt);
    }
    rabattJeZeile.set(i, anteil);
    for (const [s, a] of anteil) abzug.set(s, (abzug.get(s) ?? 0) + a);
    zeilenNetto[i] = -[...anteil.values()].reduce((x, y) => x + y, 0);
  });

  const gruppen: Steuergruppe[] = saetze.map((satz) => {
    const netto = (basis.get(satz) ?? 0) - (abzug.get(satz) ?? 0);
    const steuer = runden((netto * satz) / 100);
    return { satz, netto, steuer, brutto: netto + steuer, basis: basis.get(satz) ?? 0, rabatt: abzug.get(satz) ?? 0 };
  });
  const zeilenBrutto = positionen.map((p, i) =>
    p.rabatt
      ? -[...(rabattJeZeile.get(i) ?? new Map()).entries()].reduce((s, [satz, a]) => s + runden(a * (1 + satz / 100)), 0)
      : runden(zeilenNetto[i] * (1 + p.mwst_satz / 100)),
  );

  const netto = gruppen.reduce((s, g) => s + g.netto, 0);
  const steuer = gruppen.reduce((s, g) => s + g.steuer, 0);
  return {
    preisart: "netto",
    netto,
    steuer,
    brutto: netto + steuer,
    basis: gesamtBasis,
    rabatt: gruppen.reduce((s, g) => s + g.rabatt, 0),
    gruppen,
    zeilenNetto,
    zeilenBrutto,
  };
}

/** Alte Belege: Zeilen brutto, Netto und Steuer je Satz aus der Bruttosumme der Gruppe. */
function berechneBrutto(positionen: Position[]): Summen {
  const brutto = positionen.map((p) => runden(p.menge * (p.einzel_brutto_cent ?? 0)));
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
    gruppen.push({ satz, netto, steuer, brutto: netto + steuer, basis: netto, rabatt: 0 });
  }

  const netto = gruppen.reduce((s, g) => s + g.netto, 0);
  const steuer = gruppen.reduce((s, g) => s + g.steuer, 0);
  return { preisart: "brutto", netto, steuer, brutto: netto + steuer, basis: netto, rabatt: 0, gruppen, zeilenNetto, zeilenBrutto: brutto };
}

/** Einzelpreis, wie ihn PDF und Ansichten zeigen: netto bei neuen, brutto bei alten Belegen. */
export function einzelpreis(p: Position, preisart: Summen["preisart"]): number {
  return preisart === "brutto" ? (p.einzel_brutto_cent ?? 0) : (p.einzel_netto_cent ?? 0);
}

/**
 * Einzelpreis zum Anzeigen, so dass Menge × Einzelpreis die Zeile ergibt. Netto-Preise aus runden
 * Bruttopreisen haben Bruchteile eines Cents (15,00 € brutto = 12,605 € netto). Auf ganze Cent gerundet
 * stünde sonst „4 Stk × 12,61 € = 50,42 €“ auf der Rechnung. Ganze Cent, wenn die Rechnung damit aufgeht,
 * sonst der genaue Preis (bis vier Nachkommastellen in Euro, wie in der E-Rechnung).
 */
export function einzelpreisAnzeige(p: Position, s: Summen, i: number): number {
  const genau = einzelpreis(p, s.preisart);
  const rund = runden(genau);
  return runden(p.menge * rund) === zeilenbetrag(s, i) ? rund : genau;
}

/** Zeilenbetrag, wie ihn PDF und Ansichten zeigen. */
export function zeilenbetrag(s: Summen, i: number): number {
  return s.preisart === "brutto" ? s.zeilenBrutto[i] : s.zeilenNetto[i];
}

/** Text einer Rabattzeile, z. B. „Rabatt 10 %“. */
export function rabattText(p: Position): string {
  const name = p.text?.trim() || "Rabatt";
  return p.rabatt?.prozent ? `${name} ${String(p.rabatt.prozent).replace(".", ",")} %` : name;
}

/** Einkauf und Rohertrag eines Belegs (nur intern). Lohn hat keinen Einkauf. */
export function rohertrag(positionen: Position[], s: Summen): { ek: number; ertrag: number } | null {
  const mitEk = positionen.filter((p) => !p.rabatt && p.ek_cent != null && p.ek_cent > 0);
  if (!mitEk.length) return null;
  const ek = mitEk.reduce((sum, p) => sum + runden(p.menge * (p.ek_cent ?? 0)), 0);
  return { ek, ertrag: s.netto - ek };
}
