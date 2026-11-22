import { describe, expect, it } from "vitest";
import { annahmeAus, arbeitsMinuten, lohnEinsetzen, annahmeZeilen, auftragStand, bruttoVon, erteiltText, grenzeText, positionenAusLeistungen, ueberKostengrenze } from "./auftrag-regeln";

describe("auftragStand", () => {
  it("ohne Nummer gibt es keinen Auftrag", () => {
    expect(auftragStand({})).toBe("kein");
    expect(auftragStand({ auftrag_nummer: null, auftrag_erteilt_am: "2026-11-20T10:00:00Z" })).toBe("kein");
  });
  it("angelegt, gesendet, erteilt", () => {
    expect(auftragStand({ auftrag_nummer: "WA-2026-0001" })).toBe("offen");
    expect(auftragStand({ auftrag_nummer: "WA-2026-0001", auftrag_gesendet_am: "2026-11-20T10:00:00Z" })).toBe("beim_kunden");
    expect(auftragStand({ auftrag_nummer: "WA-2026-0001", auftrag_gesendet_am: "2026-11-20T10:00:00Z", auftrag_erteilt_am: "2026-11-20T11:00:00Z" })).toBe("erteilt");
  });
});

describe("erteiltText", () => {
  it("nennt Zeit (Berlin), Weg und Namen", () => {
    expect(erteiltText({ auftrag_erteilt_am: "2026-11-20T09:15:00Z", auftrag_erteilt_wie: "unterschrift", auftrag_erteilt_name: "Max Muster" })).toBe(
      "Erteilt am 20.11.2026, 10:15 per Unterschrift (Max Muster)",
    );
    expect(erteiltText({ auftrag_erteilt_am: "2026-07-01T08:00:00Z", auftrag_erteilt_wie: "online" })).toBe("Erteilt am 01.07.2026, 10:00 online über den Terminlink");
  });
  it("leer, solange nicht erteilt", () => {
    expect(erteiltText({ auftrag_erteilt_wie: "online" })).toBe("");
  });
});

describe("Kostengrenze", () => {
  it("ohne Grenze oder darunter keine Warnung", () => {
    expect(ueberKostengrenze({ auftrag_summe_brutto_cent: 50000, auftrag_kostengrenze_cent: null })).toBeNull();
    expect(ueberKostengrenze({ auftrag_summe_brutto_cent: 50000, auftrag_kostengrenze_cent: 50000 })).toBeNull();
    expect(grenzeText({ auftrag_summe_brutto_cent: 100, auftrag_kostengrenze_cent: 200 })).toBe("");
  });
  it("darüber: Betrag und Hinweis", () => {
    expect(ueberKostengrenze({ auftrag_summe_brutto_cent: 61000, auftrag_kostengrenze_cent: 50000 })).toBe(11000);
    expect(grenzeText({ auftrag_summe_brutto_cent: 61000, auftrag_kostengrenze_cent: 50000 })).toMatch(/^110,00\s€ über der Kostengrenze von 500,00\s€/);
  });
  it("Grenze 0 heißt: nichts ohne Rückfrage", () => {
    expect(ueberKostengrenze({ auftrag_summe_brutto_cent: 1, auftrag_kostengrenze_cent: 0 })).toBe(1);
  });
});

describe("annahmeAus", () => {
  it("nimmt nur erlaubte Werte", () => {
    expect(annahmeAus({ tank: "1/2", schluessel: "2", vorschaeden: "  Kratzer Tür hinten links " })).toEqual({ tank: "1/2", schluessel: 2, vorschaeden: "Kratzer Tür hinten links" });
    expect(annahmeAus({ tank: "halb", schluessel: "zwei", vorschaeden: "" })).toEqual({ tank: "", schluessel: null, vorschaeden: "" });
    expect(annahmeAus({ schluessel: "-1" }).schluessel).toBeNull();
    expect(annahmeAus(null)).toEqual({ tank: "", schluessel: null, vorschaeden: "" });
  });
  it("leeres Feld ist kein Schlüssel (nicht 0)", () => {
    expect(annahmeAus({ schluessel: "" }).schluessel).toBeNull();
    expect(annahmeAus({ schluessel: "0" }).schluessel).toBe(0);
  });
});

describe("annahmeZeilen", () => {
  it("nur ausgefüllte Angaben, km mit Tausenderpunkt", () => {
    expect(annahmeZeilen({ tank: "voll", schluessel: 0, vorschaeden: "" }, 123456, { fin: "WVWZZZ1KZAW000001", hsn: "0603", tsn: "", erstzulassung: "" })).toEqual([
      ["Kilometerstand", "123.456"],
      ["Tank / Ladung", "voll"],
      ["Schlüssel", "0"],
      ["FIN", "WVWZZZ1KZAW000001"],
      ["HSN / TSN", "0603"],
    ]);
    expect(annahmeZeilen(null, null, null)).toEqual([]);
  });
});

describe("positionenAusLeistungen", () => {
  const radwechsel = { id: "a", name: "Radwechsel", preis_cent: 4000, einheit: "Pauschal", mwst_satz: 19 };
  const oel = { id: "b", name: "Ölwechsel", preis_cent: null, einheit: "Pauschal", mwst_satz: 19 };

  it("Listenpreis brutto bleibt brutto rund", () => {
    const p = positionenAusLeistungen([radwechsel], "Radwechsel");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ text: "Radwechsel", menge: 1, artikel_id: "a" });
    expect(bruttoVon(p)).toBe(4000);
  });
  it("frei eingetragene Arbeit hinter den Leistungen wird eine eigene Zeile", () => {
    const p = positionenAusLeistungen([radwechsel, oel], "Radwechsel, Ölwechsel, Bremsen prüfen");
    expect(p.map((x) => x.text)).toEqual(["Radwechsel", "Ölwechsel", "Bremsen prüfen"]);
    expect(p[2].einzel_netto_cent).toBe(0);
  });
  it("festgehaltener Angebotspreis gilt statt Listenpreis", () => {
    const p = positionenAusLeistungen([radwechsel], "Radwechsel", { a: { titel: "Herbstaktion", cent: 3000 } });
    expect(bruttoVon(p)).toBe(3000);
    expect(p[0].angebot).toBe("Herbstaktion");
  });
  it("ohne Leistung eine Zeile mit dem Namen des Termins", () => {
    expect(positionenAusLeistungen([], "Klappern vorne links").map((x) => x.text)).toEqual(["Klappern vorne links"]);
    expect(positionenAusLeistungen([], "").map((x) => x.text)).toEqual(["Arbeit"]);
  });
});

describe("arbeitsMinuten", () => {
  it("zählt beendete und laufende Einträge", () => {
    const jetzt = new Date("2026-12-01T10:30:00Z").getTime();
    expect(arbeitsMinuten([{ beginn: "2026-12-01T08:00:00Z", ende: "2026-12-01T09:00:00Z" }, { beginn: "2026-12-01T10:00:00Z", ende: null }], jetzt)).toBe(90);
  });
});

describe("lohnEinsetzen", () => {
  const lohn = { text: "Arbeitslohn", menge: 0, einheit: "Std", einzel_netto_cent: 8000, mwst_satz: 19 };
  const fest = { text: "Ölwechsel", menge: 1, einheit: "Stk", einzel_netto_cent: 5000, mwst_satz: 19 };
  it("setzt Stunden auf Viertelstunden aufgerundet in leere Lohnpositionen", () => {
    const e = lohnEinsetzen([fest, lohn], 70);
    expect(e.eingesetzt).toBe(true);
    expect(e.positionen[1].menge).toBe(1.25);
    expect(e.positionen[0]).toBe(fest);
  });
  it("lässt feste Preise und gefüllte Lohnpositionen in Ruhe", () => {
    expect(lohnEinsetzen([fest, { ...lohn, menge: 2 }], 70).eingesetzt).toBe(false);
    expect(lohnEinsetzen([lohn], 0).eingesetzt).toBe(false);
  });
});
