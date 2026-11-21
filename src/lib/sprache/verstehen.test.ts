import { describe, expect, it } from "vitest";
import { textNorm } from "../rechnung/aehnlich";
import { nettoAusBruttoPreis } from "../rechnung/berechnung";
import { berlin } from "../zeit";
import { positionenBauen } from "./positionen";
import { absichtErkennen, notizVerstehen, rechnungVerstehen, terminVerstehen } from "./verstehen";

// Freitag, 20. November 2026, 10 Uhr
const heute = "2026-11-20";
const jetzt = berlin(heute, "10:00");
const team = [
  { id: "m1", name: "Marco Rossi" },
  { id: "m2", name: "Flavio Ciurli" },
];
const leistungen = [
  { id: "radwechsel", name: "Radwechsel" },
  { id: "oelwechsel", name: "Ölwechsel inkl. Filter" },
  { id: "inspektion", name: "Inspektion" },
  { id: "hu", name: "HU/AU" },
];
const preisliste = [
  { id: "radwechsel", name: "Radwechsel", einheit: "Pauschal", preis_brutto_cent: 4000, mwst_satz: 19 },
  { id: "oelwechsel", name: "Ölwechsel inkl. Filter", einheit: "Pauschal", preis_brutto_cent: 9500, mwst_satz: 19 },
  { id: "kerze", name: "Zündkerze", einheit: "Stk", preis_brutto_cent: 1500, mwst_satz: 19 },
];
const lohnarten = ["Mechanik", "Elektrik/Diagnose"];
const stundensaetze = [
  { name: "Mechanik", netto_cent: 7500 },
  { name: "Elektrik/Diagnose", netto_cent: 8500 },
];

describe("Absicht", () => {
  it("erstes Schlüsselwort entscheidet", () => {
    expect(absichtErkennen("Erinnere mich an den Termin mit Müller")).toBe("notiz");
    expect(absichtErkennen("Termin für Müller morgen")).toBe("termin");
    expect(absichtErkennen("Rechnung für Müller, Termin war gestern")).toBe("rechnung");
    expect(absichtErkennen("Bremsen vorne für Müller")).toBeNull();
  });
});

describe("Notiz", () => {
  const n = (s: string) => notizVerstehen(s, { heute, jetzt, team });

  it("Erinnerung mit Datum und Uhrzeit", () => {
    const e = n("Erinnere mich morgen um 9 daran, Bremsbeläge für Müller zu bestellen");
    expect(e).toMatchObject({ datum: "2026-11-21", uhrzeit: "09:00", titel: "Bremsbeläge für Müller zu bestellen", erinnernAn: null, wiederholung: "keine" });
  });
  it("fürs Büro, ohne Erinnerung", () => {
    expect(n("Notiz fürs Büro: Hebebühne 2 prüfen")).toMatchObject({ sichtbar: "buero", titel: "Hebebühne 2 prüfen", datum: null, uhrzeit: null });
  });
  it("an jemand anderen, wöchentlich", () => {
    const e = n("Erinnere Marco jeden Montag um 8 an die Altölabholung");
    expect(e).toMatchObject({ erinnernAn: { id: "m1" }, wiederholung: "woechentlich", datum: "2026-11-23", uhrzeit: "08:00", titel: "Altölabholung" });
  });
  it("in zwei Stunden", () => {
    expect(n("In zwei Stunden Kunde Schmidt zurückrufen")).toMatchObject({ datum: "2026-11-20", uhrzeit: "12:00", titel: "Kunde Schmidt zurückrufen" });
  });
  it("Uhrzeit schon vorbei: morgen", () => {
    expect(n("Um 8 Reifen bestellen")).toMatchObject({ datum: "2026-11-21", uhrzeit: "08:00", titel: "Reifen bestellen" });
  });
  it("nächsten Dienstag halb drei ist nachmittags", () => {
    expect(n("Erinnerung nächsten Dienstag halb drei TÜV für den Passat")).toMatchObject({ datum: "2026-11-24", uhrzeit: "14:30", titel: "TÜV für den Passat" });
  });
  it("Datum mit Monat und Viertel vor", () => {
    expect(n("Erinnere mich am dritten Dezember Viertel vor zehn an die Versicherung")).toMatchObject({ datum: "2026-12-03", uhrzeit: "09:45", titel: "Versicherung" });
  });
  it("langer Text: erster Satz wird Titel", () => {
    const e = n("Notiz: Lieferant anrufen. Die Bremsscheiben für den Golf von Müller sind falsch gekommen, es fehlen außerdem zwei Ölfilter und der Luftfilter für den Passat.");
    expect(e.titel).toBe("Lieferant anrufen");
    expect(e.text).toContain("Ölfilter");
  });
});

describe("Termin", () => {
  const t = (s: string) => terminVerstehen(s, { heute, leistungen, team });

  it("alles in einem Satz", () => {
    const e = t("Termin für Herrn Müller, Ölwechsel und Reifen wechseln, nächsten Dienstag halb neun, Kennzeichen OF AB 123, Telefon 0151 2345678");
    expect(e.leistungen.map((l) => l.id)).toEqual(["oelwechsel", "radwechsel"]);
    expect(e).toMatchObject({ datum: "2026-11-24", uhrzeit: "08:30", name: "Müller", kennzeichen: "OF-AB 123", telefon: "01512345678", leistungFrei: "" });
  });
  it("Name direkt nach Termin, Fahrzeug, TÜV", () => {
    const e = t("Neuer Termin Max Schulz am 3. Dezember um 14 Uhr TÜV VW Golf");
    expect(e).toMatchObject({ name: "Max Schulz", datum: "2026-12-03", uhrzeit: "14:00", fahrzeug: { marke: "VW", modell: "Golf" } });
    expect(e.leistungen.map((l) => l.id)).toEqual(["hu"]);
  });
  it("Dauer und Mitarbeiter", () => {
    const e = t("Termin morgen um 10 Inspektion für Frau Yilmaz, dauert drei Stunden, Mitarbeiter Marco");
    expect(e).toMatchObject({ datum: "2026-11-21", uhrzeit: "10:00", name: "Yilmaz", dauerMin: 180, mitarbeiter: { id: "m1" } });
    expect(e.leistungen.map((l) => l.id)).toEqual(["inspektion"]);
  });
  it("unbekannte Arbeit wird freie Leistung, „um 3“ ist 15 Uhr", () => {
    const e = t("Termin Bremsen vorne für Schneider Freitag um 3");
    expect(e).toMatchObject({ leistungFrei: "Bremsen vorne", name: "Schneider", datum: "2026-11-27", uhrzeit: "15:00" });
    expect(e.leistungen).toEqual([]);
  });
  it("E-Mail diktiert", () => {
    expect(t("Termin für Weber morgen 9 Uhr Radwechsel E-Mail weber at web punkt de").email).toBe("weber@web.de");
  });
});

describe("Rechnung", () => {
  const r = (s: string) => rechnungVerstehen(s, { heute, preisliste, lohnarten });

  it("Kunde, Fahrzeug, Positionen, Rabatt", () => {
    const e = r("Rechnung für Müller, Golf, Ölwechsel, zwei Stunden Arbeit, Bremsscheiben vorne 180 Euro brutto, 10 Prozent Rabatt");
    expect(e).toMatchObject({ name: "Müller", fahrzeug: { marke: "VW", modell: "Golf" } });
    expect(e.positionen).toMatchObject([
      { text: "Ölwechsel", preisCent: null },
      { stunden: true, menge: 2, text: "Arbeit", lohnart: null },
      { text: "Bremsscheiben vorne", preisCent: 18000, brutto: true },
      { rabatt: { prozent: 10 } },
    ]);
  });
  it("Kennzeichen, Menge je Stück, Diagnose-Stunde", () => {
    const e = r("Rechnung Kennzeichen OF AB 123 vier Zündkerzen je 12 Euro und eine halbe Stunde Diagnose");
    expect(e.kennzeichen).toBe("OF-AB 123");
    expect(e.positionen).toMatchObject([
      { text: "Zündkerzen", menge: 4, preisCent: 1200, brutto: false },
      { stunden: true, menge: 0.5, lohnart: "Elektrik/Diagnose", text: "Diagnose" },
    ]);
  });
  it("„und“ ohne Preis davor bleibt eine Position", () => {
    const e = r("Rechnung für Weber Bremsscheiben und Beläge vorne 240 Euro");
    expect(e.name).toBe("Weber");
    expect(e.positionen).toMatchObject([{ text: "Bremsscheiben und Beläge vorne", preisCent: 24000 }]);
  });
  it("Name direkt nach Rechnung, Preis für alle zusammen", () => {
    const e = r("Rechnung Becker 5 Liter Motoröl zusammen 60 Euro netto");
    expect(e.name).toBe("Becker");
    expect(e.positionen).toMatchObject([{ text: "Motoröl", menge: 5, einheit: "l", preisCent: 6000, gesamt: true, brutto: false }]);
  });
  it("Preis nach einem Komma gehört zur Position davor", () => {
    const e = r("Rechnung für Krause, Auspuff schweißen, 85 Euro");
    expect(e.positionen).toMatchObject([{ text: "Auspuff schweißen", preisCent: 8500 }]);
  });
  it("alle Preise brutto", () => {
    const e = r("Rechnung für Krause, alle Preise brutto, Wischerblätter 30 Euro");
    expect(e.positionen).toMatchObject([{ text: "Wischerblätter", preisCent: 3000, brutto: true }]);
  });
});

describe("Positionen bauen", () => {
  const g = { preisliste, gemerkt: [], stundensaetze, aufschlagProzent: 30 };

  it("Preisliste, Stundensatz, brutto, Rabatt", () => {
    const e = rechnungVerstehen("Rechnung für Müller, Ölwechsel, zwei Stunden Arbeit, Bremsscheiben vorne 180 Euro brutto, 10 Prozent Rabatt", { heute, preisliste, lohnarten });
    const p = positionenBauen(e.positionen, g);
    expect(p.map((x) => x.herkunft)).toEqual(["Preisliste", "Stundensatz", "gesprochen brutto", "Rabatt"]);
    expect(p[0].position).toMatchObject({ text: "Ölwechsel inkl. Filter", artikel_id: "oelwechsel", einzel_netto_cent: nettoAusBruttoPreis(9500, 19) });
    expect(p[1].position).toMatchObject({ einheit: "Std", menge: 2, einzel_netto_cent: 7500, lohnart: "Mechanik" });
    expect(p[2].position).toMatchObject({ einzel_netto_cent: nettoAusBruttoPreis(18000, 19), einheit: "Pauschal" });
    expect(p[3].position.rabatt).toEqual({ prozent: 10 });
  });
  it("netto ohne Angabe, Preis zusammen durch Menge", () => {
    const e = rechnungVerstehen("Rechnung Becker 5 Liter Motoröl zusammen 60 Euro", { heute, preisliste, lohnarten });
    expect(positionenBauen(e.positionen, g)[0].position).toMatchObject({ menge: 5, einheit: "l", einzel_netto_cent: 1200 });
  });
  it("gemerkter Preis für dieses Auto vor der Preisliste", () => {
    const gemerkt = [
      { marke: "VW", modell: "Golf", text: "Bremsscheiben vorne", text_norm: textNorm("Bremsscheiben vorne"), einheit: "Satz", menge: 1, einzel_netto_cent: 15000, mwst_satz: 19, lohnart: null, ek_cent: 9000, aufschlag: 66.67, artikel_id: null },
    ];
    const e = rechnungVerstehen("Rechnung für Müller Golf Bremsscheibe vorne", { heute, preisliste, lohnarten });
    const [p] = positionenBauen(e.positionen, { ...g, gemerkt });
    expect(p.herkunft).toBe("gemerkt");
    expect(p.position).toMatchObject({ einzel_netto_cent: 15000, einheit: "Satz", ek_cent: 9000 });
  });
});

describe("Neue Angebote und Umbenennungen", () => {
  // Nichts davon steht im Code: Die Liste kommt aus der Datenbank, wie sie gerade ist.
  const neu = [
    ...leistungen,
    { id: "aufbereitung", name: "Fahrzeugaufbereitung" },
    { id: "klima", name: "Klimaanlagen-Service", sprachnamen: ["Klima auffüllen"] },
    { id: "versiegelung", name: "Hohlraumversiegelung", sprachnamen: ["Unterbodenschutz"] },
    { id: "bv", name: "Bremsen vorne" },
    { id: "bh", name: "Bremsen hinten" },
  ];
  const t = (s: string, liste = neu) => terminVerstehen(s, { heute, leistungen: liste, team });

  it("neues Angebot, auch nur mit einem Teil des Namens", () => {
    const e = t("Termin für Müller Aufbereitung morgen um 10");
    expect(e.leistungen.map((l) => l.id)).toEqual(["aufbereitung"]);
    expect(e.name).toBe("Müller");
  });
  it("weitere Namen beim Sprechen", () => {
    expect(t("Termin für Weber, Klima auffüllen, Freitag um 9").leistungen.map((l) => l.id)).toEqual(["klima"]);
    expect(t("Termin Unterbodenschutz für Krause übermorgen 8 Uhr").leistungen.map((l) => l.id)).toEqual(["versiegelung"]);
  });
  it("nach einer Umbenennung gilt der neue Name", () => {
    const umbenannt = neu.map((l) => (l.id === "radwechsel" ? { ...l, name: "Saisonwechsel Räder" } : l));
    expect(t("Termin für Müller Saisonwechsel morgen 9 Uhr", umbenannt).leistungen.map((l) => l.id)).toEqual(["radwechsel"]);
  });
  it("mehrdeutiges Teilwort bleibt frei statt falsch", () => {
    const e = t("Termin für Schneider Bremsen morgen um 3");
    expect(e.leistungen).toEqual([]);
    expect(e.leistungFrei).toBe("Bremsen");
  });
  it("Wort aus der Preisliste beendet den Namen", () => {
    expect(t("Termin für Müller Unterbodenschutz morgen").name).toBe("Müller");
  });
  it("neuer Eintrag der Preisliste in der Rechnung", () => {
    const liste = [...preisliste, { id: "aufb", name: "Fahrzeugaufbereitung komplett", einheit: "Pauschal", preis_brutto_cent: 14900, mwst_satz: 19, sprachnamen: ["Innenreinigung"] }];
    const e = rechnungVerstehen("Rechnung für Müller Innenreinigung", { heute, preisliste: liste, lohnarten });
    expect(e.name).toBe("Müller");
    const [p] = positionenBauen(e.positionen, { preisliste: liste, gemerkt: [], stundensaetze, aufschlagProzent: 30 });
    expect(p.position).toMatchObject({ text: "Fahrzeugaufbereitung komplett", artikel_id: "aufb", einzel_netto_cent: nettoAusBruttoPreis(14900, 19) });
  });
  it("Modell aus der Kartei auch ohne Marke", () => {
    const typen = { marken: ["Lancia"], modelle: [{ marke: "Lancia", modell: "Ypsilon" }] };
    const e = rechnungVerstehen("Rechnung für Müller Ypsilon Ölwechsel", { heute, preisliste, lohnarten, typen });
    expect(e).toMatchObject({ name: "Müller", fahrzeug: { marke: "Lancia", modell: "Ypsilon" } });
    expect(e.positionen).toMatchObject([{ text: "Ölwechsel" }]);
  });
});
