import { describe, expect, it } from "vitest";
import type { Fenster } from "./einstellungen";
import { arbeitsende, belegungMax, freieSlots } from "./slots";
import { berlin, berlinUhrzeit } from "./zeit";

const werktag: Fenster[] = [["08:30", "13:00"], ["14:00", "18:00"]];

describe("arbeitsende", () => {
  it("passt in ein Fenster", () => expect(arbeitsende(werktag, 510, 30)).toBe(540));
  it("überspringt die Mittagspause", () => expect(arbeitsende(werktag, 750, 60)).toBe(14 * 60 + 30));
  it("Arbeit von 8 Stunden ab Öffnung", () => expect(arbeitsende(werktag, 510, 480)).toBe(17 * 60 + 30));
  it("passt nicht mehr an diesem Tag", () => expect(arbeitsende(werktag, 16 * 60, 180)).toBeNull());
  it("Start in der Pause ist ungültig", () => expect(arbeitsende(werktag, 13 * 60 + 30, 30)).toBeNull());
});

describe("belegungMax", () => {
  it("zählt die gleichzeitige, nicht die gesamte Belegung", () => {
    const h = (s: number) => s * 3600000;
    expect(belegungMax(h(9), h(11), [
      { beginn: h(9), bis: h(10), gewicht: 1 },
      { beginn: h(10), bis: h(11), gewicht: 1 },
    ])).toBe(1);
  });
});

describe("freieSlots", () => {
  const basis = {
    datum: "2026-12-01",
    fenster: werktag,
    dauerMin: 30,
    pufferMin: 0,
    rasterMin: 30,
    kapazitaet: 1,
    fruehestens: new Date("2026-11-01T00:00:00Z"),
    belegungen: [],
  };
  it("liefert alle Slots eines leeren Tages", () => {
    const slots = freieSlots(basis);
    expect(slots).toHaveLength(9 + 8);
    expect(berlinUhrzeit(slots[0].beginn)).toBe("08:30");
    expect(berlinUhrzeit(slots.at(-1)!.beginn)).toBe("17:30");
  });
  it("blendet belegte Slots aus", () => {
    const slots = freieSlots({
      ...basis,
      belegungen: [{ beginn: berlin("2026-12-01", "09:00").getTime(), bis: berlin("2026-12-01", "10:00").getTime(), gewicht: 1 }],
    });
    const zeiten = slots.map((s) => berlinUhrzeit(s.beginn));
    expect(zeiten).not.toContain("09:00");
    expect(zeiten).not.toContain("09:30");
    expect(zeiten).toContain("08:30");
    expect(zeiten).toContain("10:00");
  });
  it("ganztägige Sperre schließt den Tag", () => {
    const slots = freieSlots({
      ...basis,
      kapazitaet: 2,
      belegungen: [{ beginn: berlin("2026-12-01").getTime(), bis: berlin("2026-12-02").getTime(), gewicht: 2 }],
    });
    expect(slots).toHaveLength(0);
  });
  it("Vorlauf", () => {
    const slots = freieSlots({ ...basis, fruehestens: berlin("2026-12-01", "15:00") });
    expect(berlinUhrzeit(slots[0].beginn)).toBe("15:00");
  });
});
