import { describe, expect, it } from "vitest";
import { fahrzeugText, kvVorlage, rechnungVorlage, terminVorlage, WHATSAPP_STANDARD, WHATSAPP_VORLAGEN, whatsappText } from "./whatsapp";

// Dienstag, 24.11.2026, 10:00 in Berlin
const jetzt = new Date("2026-11-24T09:00:00Z");
const basis = { status: "bestaetigt" as const, beginn: "2026-11-30T08:00:00Z", auftrag_status: "offen" as const };

describe("Vorlage am Termin", () => {
  it("Anfrage und Gegenvorschlag", () => {
    expect(terminVorlage({ ...basis, status: "angefragt" }, jetzt)).toBe("anfrage");
    expect(terminVorlage({ ...basis, status: "angefragt", vorschlag_am: "2026-11-24T08:00:00Z" }, jetzt)).toBe("gegenvorschlag");
  });

  it("bestätigt: Hinweis, Erinnerung ab morgen, Rückfrage sobald das Auto da ist", () => {
    expect(terminVorlage(basis, jetzt)).toBe("bestaetigt");
    expect(terminVorlage({ ...basis, beginn: "2026-11-25T07:30:00Z" }, jetzt)).toBe("erinnerung");
    expect(terminVorlage({ ...basis, beginn: "2026-11-24T13:00:00Z" }, jetzt)).toBe("erinnerung");
    expect(terminVorlage({ ...basis, beginn: "2026-11-24T08:00:00Z" }, jetzt)).toBe("rueckfrage");
    expect(terminVorlage({ ...basis, auftrag_status: "in_arbeit" }, jetzt)).toBe("rueckfrage");
  });

  it("fertig geht vor Kostengrenze, die vor Freigabe", () => {
    const auftrag = { auftrag_nummer: "WA-1", auftrag_gesendet_am: "2026-11-24T08:00:00Z" };
    expect(terminVorlage({ ...basis, ...auftrag }, jetzt)).toBe("freigabe");
    expect(terminVorlage({ ...basis, ...auftrag, auftrag_erteilt_am: "2026-11-24T08:30:00Z" }, jetzt)).toBe("bestaetigt");
    const drueber = { ...basis, ...auftrag, auftrag_kostengrenze_cent: 30000, auftrag_summe_brutto_cent: 35000 };
    expect(terminVorlage(drueber, jetzt)).toBe("kostengrenze");
    expect(terminVorlage({ ...drueber, auftrag_status: "fertig" }, jetzt)).toBe("fertig");
  });

  it("erledigt am selben Tag ist fertig, danach Bitte um Bewertung", () => {
    expect(terminVorlage({ ...basis, status: "erledigt", beginn: "2026-11-24T07:00:00Z" }, jetzt)).toBe("fertig");
    expect(terminVorlage({ ...basis, status: "erledigt", beginn: "2026-11-23T07:00:00Z" }, jetzt)).toBe("bewertung");
  });

  it("Auftrag ohne Termin: Termin vereinbaren, solange er nicht zur Freigabe beim Kunden liegt", () => {
    const ohne = { ...basis, status: "ungeplant" as const, beginn: null, auftrag_nummer: "WA-1", auftrag_erteilt_am: "2026-11-24T08:00:00Z" };
    expect(terminVorlage(ohne, jetzt)).toBe("einplanen");
    expect(terminVorlage({ ...ohne, auftrag_erteilt_am: null, auftrag_gesendet_am: "2026-11-24T08:30:00Z" }, jetzt)).toBe("freigabe");
  });

  it.each(["abgelehnt", "storniert", "nicht_erschienen"] as const)("%s: neuer Termin", (status) => {
    expect(terminVorlage({ ...basis, status }, jetzt)).toBe("neuer_termin");
  });
});

describe("Vorlage an Beleg", () => {
  it("Kostenvoranschlag nur, solange er offen ist", () => {
    expect(kvVorlage({ status: "offen" })).toBe("kostenvoranschlag");
    expect(kvVorlage({ status: "entwurf" })).toBeNull();
    expect(kvVorlage({ status: "angenommen" })).toBeNull();
  });

  it("Rechnung nach Status und offenem Betrag", () => {
    expect(rechnungVorlage({ status: "gestellt", summe_brutto_cent: 10000 })).toBe("rechnung");
    expect(rechnungVorlage({ status: "gestellt", summe_brutto_cent: 10000, bereits_bezahlt_cent: 10000 })).toBe("rechnung_bezahlt");
    expect(rechnungVorlage({ status: "bezahlt", summe_brutto_cent: 10000 })).toBe("rechnung_bezahlt");
    expect(rechnungVorlage({ status: "entwurf", summe_brutto_cent: 10000 })).toBeNull();
    expect(rechnungVorlage({ status: "storniert", summe_brutto_cent: 10000 })).toBeNull();
    expect(rechnungVorlage({ status: "gestellt", summe_brutto_cent: -10000, storno_zu: "x" })).toBeNull();
  });
});

describe("Text füllen", () => {
  it("setzt Werte ein", () => {
    expect(whatsappText("Hallo {name}, Ihr Fahrzeug {fahrzeug} ist fertig.", { name: "Max Müller", fahrzeug: "VW Golf (OF-AB 123)" })).toBe(
      "Hallo Max Müller, Ihr Fahrzeug VW Golf (OF-AB 123) ist fertig.",
    );
  });

  it("lässt leere und unbekannte Platzhalter ohne Lücke weg", () => {
    expect(whatsappText("Hallo {name}, Ihr Fahrzeug {fahrzeug} ist {gibtsnicht} fertig.", { name: "Max" })).toBe("Hallo Max, Ihr Fahrzeug ist fertig.");
  });

  it("behält das Leerzeichen am Ende, damit man gleich weiterschreiben kann", () => {
    expect(whatsappText(WHATSAPP_STANDARD.rueckfrage, { name: "Max", fahrzeug: "OF-AB 123" })).toBe("Hallo Max, kurze Rückfrage zu Ihrem Fahrzeug OF-AB 123: ");
  });

  it("Fahrzeug", () => {
    expect(fahrzeugText({ kennzeichen: "OF-AB 123", marke_modell: "VW Golf" })).toBe("VW Golf (OF-AB 123)");
    expect(fahrzeugText({ kennzeichen: "OF-AB 123", marke_modell: "" })).toBe("OF-AB 123");
    expect(fahrzeugText(null)).toBe("");
  });

  it("jede Vorlage hat einen Standardtext", () => {
    for (const v of WHATSAPP_VORLAGEN) expect(WHATSAPP_STANDARD[v.schluessel].length).toBeGreaterThan(10);
  });
});
