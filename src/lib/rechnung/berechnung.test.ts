import { describe, expect, it } from "vitest";
import { euroGenau, zahlAusText } from "../format";
import { alsNetto, berechne, einzelpreisAnzeige, nettoAusBrutto, nettoAusBruttoPreis, rohertrag, vorzeichenWechseln } from "./berechnung";

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

describe("berechne netto", () => {
  it("runder Listenpreis bleibt brutto rund, auch bei Menge 2 und 3", () => {
    const einzel = nettoAusBruttoPreis(4000, 19);
    for (const menge of [1, 2, 3, 4]) {
      const s = berechne([{ text: "Radwechsel", menge, einheit: "Pauschal", einzel_netto_cent: einzel, mwst_satz: 19 }]);
      expect(s.brutto).toBe(4000 * menge);
    }
  });

  it("Netto-Zeilen, Steuer auf die Gruppe", () => {
    const s = berechne([
      { text: "Zahnriemen", menge: 2.5, einheit: "Std", einzel_netto_cent: 7500, mwst_satz: 19, lohnart: "Mechanik" },
      { text: "Zahnriemensatz", menge: 1, einheit: "Satz", einzel_netto_cent: 18990, mwst_satz: 19, ek_cent: 14608, aufschlag: 30 },
    ]);
    expect(s.preisart).toBe("netto");
    expect(s.zeilenNetto).toEqual([18750, 18990]);
    expect(s.netto).toBe(37740);
    expect(s.steuer).toBe(Math.round(37740 * 0.19));
    expect(rohertrag([{ text: "x", menge: 1, einheit: "Stk", einzel_netto_cent: 18990, mwst_satz: 19, ek_cent: 14608 }], s)?.ek).toBe(14608);
  });

  it("Rabatt in Prozent und Euro, getrennt nach Steuersatz", () => {
    const pos = [
      { text: "Arbeit", menge: 1, einheit: "Pauschal", einzel_netto_cent: 10000, mwst_satz: 19 },
      { text: "Buch", menge: 1, einheit: "Stk", einzel_netto_cent: 10000, mwst_satz: 7 },
    ];
    const p = berechne([...pos, { text: "Rabatt", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt: { prozent: 10 } }]);
    expect(p.basis).toBe(20000);
    expect(p.rabatt).toBe(2000);
    expect(p.netto).toBe(18000);
    expect(p.zeilenNetto[2]).toBe(-2000);
    expect(p.gruppen.map((g) => g.rabatt)).toEqual([1000, 1000]);
    expect(p.steuer).toBe(Math.round(9000 * 0.19) + Math.round(9000 * 0.07));

    const e = berechne([...pos, { text: "Nachlass", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt: { betrag_cent: 5001 } }]);
    expect(e.rabatt).toBe(5001);
    expect(e.gruppen.reduce((s, g) => s + g.netto, 0)).toBe(14999);
  });

  it("Storno dreht alles um, auch einen Euro-Rabatt", () => {
    const pos = [
      { text: "Arbeit", menge: 2, einheit: "Std", einzel_netto_cent: 7500, mwst_satz: 19 },
      { text: "Rabatt", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt: { betrag_cent: 1000 } },
    ];
    const a = berechne(pos);
    const b = berechne(vorzeichenWechseln(pos));
    expect(b.netto).toBe(-a.netto);
    expect(b.steuer).toBe(-a.steuer);
    expect(b.brutto).toBe(-a.brutto);
  });

  it("alte Brutto-Belege rechnen unverändert, gemischte werden netto", () => {
    const alt = { text: "Radwechsel", menge: 1, einheit: "Pauschal", einzel_brutto_cent: 4000, mwst_satz: 19 };
    expect(berechne([alt]).preisart).toBe("brutto");
    const gemischt = berechne([alt, { text: "Ventil", menge: 1, einheit: "Stk", einzel_netto_cent: 251, mwst_satz: 19 }]);
    expect(gemischt.preisart).toBe("netto");
    expect(alsNetto(alt).einzel_netto_cent).toBe(3361.34);
  });
});

describe("Einzelpreis auf dem Beleg geht mit der Menge auf", () => {
  const zeile = (menge: number, brutto: number) => {
    const p = { text: "Zündkerze", menge, einheit: "Stk", einzel_netto_cent: nettoAusBruttoPreis(brutto, 19), mwst_satz: 19 };
    const s = berechne([p]);
    return { anzeige: einzelpreisAnzeige(p, s, 0), zeile: s.zeilenNetto[0] };
  };
  it("4 Stück à 15 € brutto: genauer Preis, damit 4 × Einzel = Zeile", () => {
    const { anzeige, zeile: z } = zeile(4, 1500);
    expect(euroGenau(anzeige).replace(/\s/g, " ")).toBe("12,605 €");
    expect(Math.round(4 * anzeige)).toBe(z);
  });
  it("ein Stück: ganze Cent", () => expect(euroGenau(zeile(1, 4000).anzeige).replace(/\s/g, " ")).toBe("33,61 €"));
  it("für jede Menge 1–10 und viele runde Preise rechnet die Zeile nach", () => {
    for (let brutto = 100; brutto <= 30000; brutto += 50) {
      for (let menge = 1; menge <= 10; menge++) {
        const { anzeige, zeile: z } = zeile(menge, brutto);
        expect(Math.round(menge * anzeige)).toBe(z);
      }
    }
  });
});

describe("Zahlen aus Eingaben", () => {
  it("deutsch, mit Punkt als Komma und mit Tausendern", () => {
    expect(zahlAusText("12,50")).toBe(12.5);
    expect(zahlAusText("12.50")).toBe(12.5);
    expect(zahlAusText("1.250,50")).toBe(1250.5);
    expect(zahlAusText("120.000")).toBe(120000);
    expect(zahlAusText("2,5")).toBe(2.5);
    expect(zahlAusText("40 €")).toBe(40);
    expect(zahlAusText("")).toBeNull();
    expect(zahlAusText("abc")).toBeNull();
  });
});
