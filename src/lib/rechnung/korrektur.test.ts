import { describe, expect, it } from "vitest";
import { bereitsBezahlt, durchZahlungErledigt, fassungsNummer, grundPruefen, offenerBetrag, zahlungseingang } from "./korrektur";

describe("Rechnungskorrektur", () => {
  it("Nummer der Fassung", () => {
    expect(fassungsNummer("RE-2026-0001", false, [])).toBe("RE-2026-0001.1");
    // Korrektur einer Korrektur: dieselbe Wurzel, nächste Fassung
    expect(fassungsNummer("RE-2026-0001.1", true, ["RE-2026-0001.1"])).toBe("RE-2026-0001.2");
    expect(fassungsNummer("RE-2026-0001.2", true, ["RE-2026-0001.1", "RE-2026-0001.2", "RE-2026-0010.1"])).toBe("RE-2026-0001.3");
    // Andere Nummern mit gleichem Anfang zählen nicht
    expect(fassungsNummer("RE-2026-0001", false, ["RE-2026-00011.1", "RE-2026-0001.x"])).toBe("RE-2026-0001.1");
    // Punkt im Präfix: nur abschneiden, wenn das Original selbst eine Korrektur ist
    expect(fassungsNummer("RE.0001", false, [])).toBe("RE.0001.1");
  });

  it("Schon Gezahltes", () => {
    expect(bereitsBezahlt({ summe_brutto_cent: 10000, bezahlt_am: null })).toBe(0);
    expect(bereitsBezahlt({ summe_brutto_cent: 10000, bezahlt_am: "2026-11-02" })).toBe(10000);
    // Offene Korrektur trägt weiter, was sie selbst übernommen hat
    expect(bereitsBezahlt({ summe_brutto_cent: 12000, bereits_bezahlt_cent: 10000, bezahlt_am: null })).toBe(10000);
    // Bezahlt mit Überzahlung: das Gezahlte zählt
    expect(bereitsBezahlt({ summe_brutto_cent: 8000, bereits_bezahlt_cent: 10000, bezahlt_am: "2026-11-02" })).toBe(10000);
  });

  it("Offen, erledigt, DATEV", () => {
    const hoeher = { summe_brutto_cent: 12000, bereits_bezahlt_cent: 10000 };
    expect(offenerBetrag(hoeher)).toBe(2000);
    expect(durchZahlungErledigt(hoeher)).toBe(false);
    expect(zahlungseingang(hoeher)).toBe(2000);

    const niedriger = { summe_brutto_cent: 8000, bereits_bezahlt_cent: 10000 };
    expect(offenerBetrag(niedriger)).toBe(-2000);
    expect(durchZahlungErledigt(niedriger)).toBe(true);
    expect(zahlungseingang(niedriger)).toBe(0);

    expect(durchZahlungErledigt({ summe_brutto_cent: 8000 })).toBe(false);
    expect(zahlungseingang({ summe_brutto_cent: 8000 })).toBe(8000);
  });

  it("Pflichtgrund", () => {
    expect(() => grundPruefen("  ")).toThrow(/Grund/);
    expect(grundPruefen("  falsche   Anschrift ")).toBe("falsche Anschrift");
  });
});
