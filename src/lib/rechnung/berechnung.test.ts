import { describe, expect, it } from "vitest";
import { berechne, nettoAusBrutto } from "./berechnung";

describe("nettoAusBrutto", () => {
  it("40 € Radwechsel", () => expect(nettoAusBrutto(4000, 19)).toEqual({ netto: 3361, steuer: 639 }));
  it("findet für alle Beträge bis 1.000 € ein exaktes Paar oder weicht um höchstens 1 Cent ab", () => {
    for (let b = 1; b <= 100000; b++) {
      const { netto, steuer } = nettoAusBrutto(b, 19);
      expect(Math.abs(netto + steuer - b)).toBeLessThanOrEqual(1);
      expect(steuer).toBe(Math.round((netto * 19) / 100));
    }
  });
  it("Storno mit negativem Betrag", () => expect(nettoAusBrutto(-4000, 19)).toEqual({ netto: -3361, steuer: -639 }));
});

describe("berechne", () => {
  it("Summen und Zeilen-Netto gehen auf", () => {
    const s = berechne([
      { text: "Radwechsel", menge: 1, einheit: "Pauschal", einzel_brutto_cent: 4000, mwst_satz: 19 },
      { text: "Arbeitszeit", menge: 1.5, einheit: "Std", einzel_brutto_cent: 8900, mwst_satz: 19 },
      { text: "Ventile", menge: 4, einheit: "Stk", einzel_brutto_cent: 299, mwst_satz: 19 },
    ]);
    expect(s.zeilenBrutto).toEqual([4000, 13350, 1196]);
    expect(s.brutto).toBe(18546);
    expect(s.zeilenNetto.reduce((a, b) => a + b, 0)).toBe(s.netto);
    expect(s.steuer).toBe(Math.round((s.netto * 19) / 100));
  });
});
