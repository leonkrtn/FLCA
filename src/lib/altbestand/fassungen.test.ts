import { describe, expect, it } from "vitest";
import { letzteFassungen } from "./fassungen";

const r = (id: string, nummer: string, rechnungsdatum: string, kunde_id = "k1") => ({ id, nummer, rechnungsdatum, kunde_id });

describe("letzteFassungen", () => {
  it("zeigt die letzte Fassung mit ihrer Nummer, die älteren hängen daran", () => {
    const [eine, ...rest] = letzteFassungen([r("a", "0055", "2026-05-18"), r("b", "0055.1", "2026-05-18"), r("c", "0055.2", "2026-05-19")]);
    expect(rest).toEqual([]);
    expect(eine.nummer).toBe("0055.2");
    expect(eine.aeltere.map((x) => x.nummer)).toEqual(["0055.1", "0055"]);
  });
  it("gleiche Nummer bei verschiedenen Kunden bleibt getrennt, jüngste zuerst", () => {
    const l = letzteFassungen([r("a", "0005", "2025-10-31", "k1"), r("b", "0005", "2025-10-31", "k2"), r("c", "0140", "2026-11-19", "k1")]);
    expect(l[0].id).toBe("c");
    expect(l.slice(1).map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(l.every((x) => x.aeltere.length === 0)).toBe(true);
  });
  it("gleiche Nummer, späteres Datum gewinnt", () => {
    const [x] = letzteFassungen([r("a", "0022", "2025-11-27"), r("b", "0022", "2025-11-28")]);
    expect(x.id).toBe("b");
    expect(x.aeltere.map((y) => y.id)).toEqual(["a"]);
  });
});
