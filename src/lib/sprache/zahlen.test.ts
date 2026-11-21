import { describe, expect, it } from "vitest";
import { centAusText, dezimal, ordnungszahl, zahlenEinsetzen, zahlwort } from "./zahlen";

describe("Zahlwörter", () => {
  it("einfache und zusammengesetzte", () => {
    expect(zahlwort("zwei")).toBe(2);
    expect(zahlwort("zwölf")).toBe(12);
    expect(zahlwort("einundzwanzig")).toBe(21);
    expect(zahlwort("dreihundertfünfzig")).toBe(350);
    expect(zahlwort("einhundertzwanzig")).toBe(120);
    expect(zahlwort("zweitausendsechsundzwanzig")).toBe(2026);
    expect(zahlwort("null")).toBe(0);
    expect(zahlwort("Wunder")).toBeNull();
    expect(zahlwort("Golf")).toBeNull();
  });
  it("Ordnungszahlen", () => {
    expect(ordnungszahl("ersten")).toBe(1);
    expect(ordnungszahl("dritten")).toBe(3);
    expect(ordnungszahl("sechste")).toBe(6);
    expect(ordnungszahl("siebten")).toBe(7);
    expect(ordnungszahl("achten")).toBe(8);
    expect(ordnungszahl("zwanzigsten")).toBe(20);
    expect(ordnungszahl("einunddreißigsten")).toBe(31);
    expect(ordnungszahl("besten")).toBeNull();
    expect(ordnungszahl("Golf")).toBeNull();
  });
  it("im Satz, Artikel bleiben Wörter", () => {
    expect(zahlenEinsetzen("zwei Stunden und eine Pause")).toBe("2 Stunden und eine Pause");
    expect(zahlenEinsetzen("halb neun")).toBe("halb 9");
    expect(zahlenEinsetzen("zweieinhalb Stunden")).toBe("2,5 Stunden");
    expect(zahlenEinsetzen("anderthalb Stunden")).toBe("1,5 Stunden");
    expect(zahlenEinsetzen("zwei Komma fünf Liter")).toBe("2,5 Liter");
    expect(zahlenEinsetzen("Telefon null eins fünf eins")).toBe("Telefon 0 1 5 1");
  });
  it("Beträge", () => {
    expect(dezimal("2,5")).toBe(2.5);
    expect(dezimal("1.200")).toBe(1200);
    expect(centAusText("180")).toBe(18000);
    expect(centAusText("19,90")).toBe(1990);
    expect(centAusText("19", "5")).toBe(1950);
    expect(centAusText("1.200,50")).toBe(120050);
  });
});
