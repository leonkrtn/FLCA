import { describe, expect, it } from "vitest";
import { ansichtAusSuche, kalenderHref, kalLesen, kalWert, mitKal, monatsende, monatsRaster } from "./kalender-ansicht";

const ID = "0b8f0b52-6c7e-4d8e-9a43-2a1e5f0c9d11";

describe("Kalenderansicht", () => {
  it("ohne Angabe gilt die Woche von heute", () => {
    expect(ansichtAusSuche({}, "2026-11-26")).toEqual({ art: "woche", datum: "2026-11-23", person: undefined });
  });

  it("liest Tag, Woche und Monat", () => {
    expect(ansichtAusSuche({ tag: "2026-11-24", person: ID }, "2026-11-26")).toEqual({ art: "tag", datum: "2026-11-24" });
    expect(ansichtAusSuche({ woche: "2026-11-25" }, "2026-11-26").datum).toBe("2026-11-23");
    expect(ansichtAusSuche({ monat: "2026-02", person: "ohne" }, "2026-11-26")).toEqual({ art: "monat", datum: "2026-02-01", person: "ohne" });
    // Unsinn fällt auf die aktuelle Woche zurück
    expect(ansichtAusSuche({ monat: "2026-13" }, "2026-11-26").art).toBe("woche");
  });

  it("baut die Adresse der Kalenderseite", () => {
    expect(kalenderHref({ art: "woche", datum: "2026-11-23", person: ID })).toBe(`/admin/kalender?woche=2026-11-23&person=${ID}`);
    expect(kalenderHref({ art: "monat", datum: "2026-11-01" })).toBe("/admin/kalender?monat=2026-11");
    expect(kalenderHref({ art: "tag", datum: "2026-11-24", person: ID })).toBe("/admin/kalender?tag=2026-11-24");
  });

  it("kal hin und zurück", () => {
    for (const a of [{ art: "woche", datum: "2026-11-23", person: ID }, { art: "monat", datum: "2026-11-01" }, { art: "tag", datum: "2026-11-24" }] as const) {
      expect(kalLesen(kalWert(a))).toEqual(a);
    }
    expect(kalLesen("woche:2026-11-23:<script>")).toBeNull();
    expect(kalLesen("jahr:2026-01-01")).toBeNull();
    expect(kalLesen(undefined)).toBeNull();
  });

  it("hängt kal an, mit ? oder &", () => {
    expect(mitKal("/admin/termine/1", { art: "tag", datum: "2026-11-24" })).toBe("/admin/termine/1?kal=tag%3A2026-11-24");
    expect(mitKal("/admin/termine/neu?datum=2026-11-24", { art: "monat", datum: "2026-11-01" })).toBe("/admin/termine/neu?datum=2026-11-24&kal=monat%3A2026-11-01");
    expect(mitKal("/admin/termine/1", null)).toBe("/admin/termine/1");
  });

  it("Monatsraster geht von Montag bis Sonntag über ganze Wochen", () => {
    const tage = monatsRaster("2026-11-15");
    expect(tage[0]).toBe("2026-10-26");
    expect(tage[tage.length - 1]).toBe("2026-12-06");
    expect(tage.length % 7).toBe(0);
    expect(monatsende("2028-02-10")).toBe("2028-02-29");
    // Februar 2027 beginnt an einem Montag und endet an einem Sonntag: genau vier Wochen
    expect(monatsRaster("2027-02-01")).toHaveLength(28);
  });
});
