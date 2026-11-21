import { describe, expect, it } from "vitest";
import { aehnlichkeit, besterTreffer, fahrzeugSchluessel, markeModellTrennen, SCHWELLE, textNorm } from "./aehnlich";

describe("Fahrzeugtyp", () => {
  it("Schreibweisen von Marke und Modell sind egal", () => {
    expect(fahrzeugSchluessel("VW", "Golf VII")).toEqual(fahrzeugSchluessel("Volkswagen", "golf 7"));
    expect(fahrzeugSchluessel("Mercedes-Benz", "C-Klasse")).toEqual(fahrzeugSchluessel("Mercedes", "C Klasse"));
    expect(fahrzeugSchluessel("VW", "")).toBeNull();
  });

  it("alter Freitext wird getrennt", () => {
    expect(markeModellTrennen("VW Golf 7")).toEqual({ marke: "VW", modell: "Golf 7" });
    expect(markeModellTrennen("Alfa Romeo Giulia")).toEqual({ marke: "Alfa Romeo", modell: "Giulia" });
    expect(markeModellTrennen("Mercedes-Benz C 220")).toEqual({ marke: "Mercedes-Benz", modell: "C 220" });
    expect(markeModellTrennen("")).toEqual({ marke: "", modell: "" });
  });
});

describe("Bezeichnungen", () => {
  it("Mehrzahl, Kürzel und Groß-/Kleinschreibung zählen als gleich", () => {
    expect(textNorm("Bremsscheiben VA")).toBe(textNorm("bremsscheibe vorne"));
    expect(aehnlichkeit(textNorm("Bremsbeläge vorne erneuern"), textNorm("Bremsbelag vorne wechseln"))).toBeGreaterThanOrEqual(SCHWELLE);
  });

  it("verschiedene Positionen bleiben verschieden", () => {
    const liste = [{ text_norm: textNorm("Bremsscheiben hinten") }, { text_norm: textNorm("Ölfilter") }];
    expect(besterTreffer("Bremsscheiben vorne", liste)).toBeNull();
    expect(besterTreffer("Oelfilter", liste)).toBe(liste[1]);
  });
});
