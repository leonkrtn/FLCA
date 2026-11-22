import { describe, expect, it } from "vitest";
import { eingabeFehler, gleich, nummerText, warnungen } from "./nummernkreis";

const k = { praefix: "", mit_jahr: false, stellen: 4, naechste: 141 };

describe("Nummernkreis", () => {
  it("Format wie rechnung_stellen", () => {
    expect(nummerText(k, 2026)).toBe("0141");
    expect(nummerText({ praefix: "RE-", mit_jahr: true, stellen: 4, naechste: 7 }, 2026)).toBe("RE-2026-0007");
  });
  it("Eingabefehler", () => {
    expect(eingabeFehler(k)).toBeNull();
    expect(eingabeFehler({ ...k, naechste: 0 })).toContain("ab 1");
    expect(eingabeFehler({ ...k, naechste: NaN })).toContain("ab 1");
    expect(eingabeFehler({ ...k, naechste: 12345 })).toContain("mehr als 4 Stellen");
  });
  it("gleich", () => {
    expect(gleich(k, { ...k })).toBe(true);
    expect(gleich(k, { ...k, naechste: 142 })).toBe(false);
  });
  it("vor der ersten Rechnung nur der Hinweis", () => {
    expect(warnungen(k, { ...k, naechste: 1 }, 0, 2026)).toEqual(["Die erste Rechnung im System bekommt die Nummer 0001."]);
  });
  it("Sprung nach vorn nennt die Lücke", () => {
    const w = warnungen(k, { ...k, naechste: 150 }, 3, 2026);
    expect(w[0]).toContain("141 bis 149 werden übersprungen");
    expect(w.at(-1)).toContain("0150");
  });
  it("eine einzelne übersprungene Nummer", () => {
    expect(warnungen(k, { ...k, naechste: 142 }, 3, 2026)[0]).toContain("Die Nummer 141 wird übersprungen");
  });
  it("Rückschritt", () => {
    expect(warnungen(k, { ...k, naechste: 100 }, 3, 2026)[0]).toContain("zurück von 141 auf 100");
  });
  it("Formatwechsel", () => {
    expect(warnungen(k, { ...k, praefix: "RE-" }, 3, 2026)[0]).toContain("von 0141 auf RE-0141");
  });
});
