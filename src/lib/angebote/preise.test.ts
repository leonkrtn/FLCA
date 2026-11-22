import { describe, expect, it } from "vitest";
import { type Angebot, angeboteAnwenden, countdownText, laeuft, mitAngebot, reduziert, trifft } from "./preise";

const angebot = (x: Partial<Angebot>): Angebot => ({
  id: "a",
  titel: "Reifensaison",
  kurztext: "",
  bedingungen: "",
  bild_pfad: null,
  art: "prozent",
  wert: 20,
  kategorien: ["reifen"],
  leistung_ids: [],
  von: "2026-10-01",
  bis: "2026-11-15",
  aktiv: true,
  ...x,
});

const radwechsel = { id: "r", kategorie: "reifen", preis_cent: 4000 };

describe("laeuft", () => {
  it("gilt von Beginn bis Ende einschließlich", () => {
    const a = angebot({});
    expect(laeuft(a, "2026-09-30")).toBe(false);
    expect(laeuft(a, "2026-10-01")).toBe(true);
    expect(laeuft(a, "2026-11-15")).toBe(true);
    expect(laeuft(a, "2026-11-16")).toBe(false);
  });
  it("ohne Ende läuft es weiter, ausgeschaltet nie", () => {
    expect(laeuft(angebot({ bis: null }), "2030-01-01")).toBe(true);
    expect(laeuft(angebot({ aktiv: false }), "2026-10-10")).toBe(false);
  });
});

describe("trifft", () => {
  it("Kategorie trifft Leistungen, aber keine Teile", () => {
    const a = angebot({ kategorien: ["service"] });
    expect(trifft(a, { id: "x", kategorie: "service" })).toBe(true);
    expect(trifft(a, { id: "x", kategorie: "service", art: "position" })).toBe(false);
  });
  it("Einzelauswahl trifft auch Teile", () => {
    expect(trifft(angebot({ kategorien: [], leistung_ids: ["t"] }), { id: "t", kategorie: "service", art: "position" })).toBe(true);
  });
});

describe("reduziert", () => {
  it("rundet Prozent und Euro auf volle Euro", () => {
    expect(reduziert({ art: "prozent", wert: 15 }, 4000)).toBe(3400);
    expect(reduziert({ art: "prozent", wert: 15 }, 9500)).toBe(8100); // 80,75 → 81
    expect(reduziert({ art: "euro", wert: 550 }, 4000)).toBe(3500); // 34,50 → 35
  });
  it("nie unter null und nie über dem Listenpreis", () => {
    expect(reduziert({ art: "euro", wert: 9000 }, 4000)).toBe(0);
    expect(reduziert({ art: "festpreis", wert: 5000 }, 4000)).toBe(4000);
    expect(reduziert({ art: "festpreis", wert: 2990 }, 4000)).toBe(2990);
  });
});

describe("mitAngebot", () => {
  it("ohne passendes Angebot bleibt der Listenpreis", () => {
    expect(mitAngebot({ id: "o", kategorie: "service", preis_cent: 9500 }, [angebot({})], "2026-10-10")).toEqual({ preis_cent: 9500, angebot: null });
  });
  it("Reifensaison −20 %: 40 € werden 32 €", () => {
    const p = mitAngebot(radwechsel, [angebot({})], "2026-10-10");
    expect(p.preis_cent).toBe(3200);
    expect(p.angebot).toMatchObject({ titel: "Reifensaison", rabatt: "−20 %", listen_cent: 4000 });
  });
  it("mehrere Angebote: der günstigste Preis gilt, nichts wird addiert", () => {
    const p = mitAngebot(radwechsel, [angebot({ id: "a" }), angebot({ id: "b", titel: "Herbst", art: "euro", wert: 1000 })], "2026-10-10");
    expect(p.preis_cent).toBe(3000);
    expect(p.angebot?.titel).toBe("Herbst");
  });
  it("Festpreis über dem Listenpreis ist kein Angebot", () => {
    expect(mitAngebot(radwechsel, [angebot({ art: "festpreis", wert: 4500 })], "2026-10-10").angebot).toBeNull();
  });
  it("ohne Listenpreis: Prozent nur als Hinweis, Festpreis mit Betrag", () => {
    const l = { id: "k", kategorie: "reifen", preis_cent: null };
    expect(mitAngebot(l, [angebot({})], "2026-10-10")).toMatchObject({ preis_cent: null, angebot: { rabatt: "−20 %", listen_cent: null } });
    expect(mitAngebot(l, [angebot({}), angebot({ id: "f", art: "festpreis", wert: 7900 })], "2026-10-10")).toMatchObject({ preis_cent: 7900, angebot: { id: "f" } });
  });
  it("angeboteAnwenden ersetzt preis_cent und behält alles andere", () => {
    const [l] = angeboteAnwenden([{ ...radwechsel, name: "Radwechsel" }], [angebot({})], "2026-10-10");
    expect(l).toMatchObject({ name: "Radwechsel", preis_cent: 3200, angebot: { listen_cent: 4000 } });
  });
});

describe("countdownText", () => {
  it("zählt den heutigen Tag mit", () => {
    expect(countdownText("2026-11-15", "2026-11-15")).toBe("Nur noch heute");
    expect(countdownText("2026-11-15", "2026-11-14")).toBe("Noch bis morgen");
    expect(countdownText("2026-11-15", "2026-11-03")).toBe("Noch 13 Tage");
    expect(countdownText("2026-11-15", "2026-11-16")).toBeNull();
    expect(countdownText(null, "2026-11-16")).toBeNull();
  });
  it("rechnet über die Zeitumstellung hinweg ganze Tage", () => {
    expect(countdownText("2026-10-30", "2026-10-20")).toBe("Noch 11 Tage");
  });
});
