import { describe, expect, it } from "vitest";
import { berlin, berlinDatum, berlinUhrzeit, plusTage, wochenbeginn, wochentag } from "./zeit";

describe("Zeitrechnung Berlin", () => {
  it("Winterzeit ist UTC+1", () => {
    expect(berlin("2026-12-01", "09:00").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
  it("Sommerzeit ist UTC+2", () => {
    expect(berlin("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
  it("Tag der Umstellung auf Sommerzeit", () => {
    expect(berlin("2026-03-29", "08:30").toISOString()).toBe("2026-03-29T06:30:00.000Z");
  });
  it("Rückweg", () => {
    const t = new Date("2026-10-25T13:15:00Z");
    expect(berlinDatum(t)).toBe("2026-10-25");
    expect(berlinUhrzeit(t)).toBe("14:15");
  });
  it("Wochentage", () => {
    expect(wochentag("2026-11-09")).toBe(1);
    expect(wochentag("2026-11-08")).toBe(7);
    expect(wochenbeginn("2026-11-12")).toBe("2026-11-09");
    expect(plusTage("2026-12-31", 1)).toBe("2027-01-01");
  });
});
