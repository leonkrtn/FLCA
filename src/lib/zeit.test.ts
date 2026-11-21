import { describe, expect, it } from "vitest";
import { berlin, berlinDatum, berlinUhrzeit, naechsteWiederholung, plusMonate, plusTage, wochenbeginn, wochentag } from "./zeit";

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

describe("Wiederkehrende Erinnerungen", () => {
  const am = berlin("2026-03-27", "07:30");
  it("täglich zur selben Uhrzeit, auch über die Umstellung auf Sommerzeit", () => {
    const n = naechsteWiederholung(am, "taeglich", am)!;
    expect(berlinDatum(n)).toBe("2026-03-28");
    const ueber = naechsteWiederholung(n, "taeglich", n)!;
    expect(berlinDatum(ueber)).toBe("2026-03-29");
    expect(berlinUhrzeit(ueber)).toBe("07:30");
  });
  it("wöchentlich", () => {
    expect(berlinDatum(naechsteWiederholung(am, "woechentlich", am)!)).toBe("2026-04-03");
  });
  it("monatlich vom 31. auf den letzten Tag", () => {
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(plusMonate("2026-12-15", 1)).toBe("2027-01-15");
    const ende = berlin("2026-01-31", "09:00");
    expect(berlinDatum(naechsteWiederholung(ende, "monatlich", ende)!)).toBe("2026-02-28");
  });
  it("springt nach einer Pause direkt in die Zukunft", () => {
    const spaeter = berlin("2026-04-10", "12:00");
    const n = naechsteWiederholung(am, "taeglich", spaeter)!;
    expect(berlinDatum(n)).toBe("2026-04-11");
    expect(berlinUhrzeit(n)).toBe("07:30");
  });
  it("ohne Wiederholung nichts", () => {
    expect(naechsteWiederholung(am, "keine", am)).toBeNull();
  });
});
