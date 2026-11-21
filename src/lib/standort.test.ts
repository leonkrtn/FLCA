import { describe, expect, it } from "vitest";
import { abstandM, abstandText, vorOrt } from "./standort";

describe("standort", () => {
  const werkstatt = { lat: 50.0086, lng: 8.7944 };
  it("Abstand von rund 1,1 km je 0,01 Grad Breite", () => expect(abstandM(werkstatt, { lat: 50.0186, lng: 8.7944 })).toBeGreaterThan(1100));
  it("derselbe Punkt", () => expect(abstandM(werkstatt, werkstatt)).toBe(0));
  it("Ungenauigkeit zählt höchstens 50 m", () => {
    expect(vorOrt(180, 40, 150)).toBe(true);
    expect(vorOrt(220, 900, 150)).toBe(false);
  });
  it("Text", () => {
    expect(abstandText(350)).toBe("350 m");
    expect(abstandText(2400)).toBe("2,4 km");
  });
});
