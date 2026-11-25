import { describe, expect, it } from "vitest";
import { STANDARD } from "./einstellungen";
import { einstellungenSuchen, einstellungenVerzeichnis, tippAbstand, trefferLink } from "./einstellungen-suche";

const verzeichnis = einstellungenVerzeichnis({
  e: STANDARD,
  whatsapp: [{ schluessel: "fertig", titel: "Auto fertig", wann: "Auftrag fertig gemeldet", text: "Hallo {name}, Ihr Auto ist fertig und kann abgeholt werden." }],
});
const erster = (anfrage: string) => einstellungenSuchen(anfrage, verzeichnis)[0];
const ziele = (anfrage: string, n = 3) => einstellungenSuchen(anfrage, verzeichnis).slice(0, n).map((t) => t.eintrag.ziel);

describe("einstellungenSuchen", () => {
  it("findet Felder über ihren Namen", () => {
    expect(erster("IBAN")?.eintrag.ziel).toBe("iban");
    expect(erster("Zahlungsziel")?.eintrag.ziel).toBe("zahlungszielTage");
    expect(erster("stornofrist")?.eintrag.ziel).toBe("stornoFristStd");
  });

  it("verzeiht Tippfehler und halbe Wörter", () => {
    expect(erster("Öfnungszeiten")?.eintrag.bereich).toBe("zeiten");
    expect(erster("oeffnungzeiten")?.eintrag.bereich).toBe("zeiten");
    expect(erster("Steuerbe")?.eintrag.bereich).toBe("automatik");
    expect(erster("Instagarm")?.eintrag.ziel).toBe("instagram");
  });

  it("kennt Alltagswörter", () => {
    expect(ziele("Bankverbindung")).toContain("iban");
    expect(erster("Stundenlohn")?.eintrag.ziel).toBe("lohn_name_0");
    expect(erster("Hebebühnen")?.eintrag.ziel).toBe("kapazitaet");
    expect(erster("Marge Ersatzteile")?.eintrag.ziel).toBe("aufschlagProzent");
    expect(erster("Samstag")?.eintrag.ziel).toBe("t6_1_von");
  });

  it("versteht Fragen", () => {
    expect(erster("Wie ändere ich die Mail an den Steuerberater?")?.eintrag.ziel).toBe("datev_email");
    expect(erster("Wo stelle ich die Rechnungsnummer ein?")?.eintrag.ziel).toBe("#nummernkreis");
    expect(erster("Wie kann ich die Karriere-Seite ausschalten?")?.eintrag.ziel).toBe("karriere");
    expect(erster("Online-Termine abschalten")?.eintrag.ziel).toBe("aktiv");
  });

  it("findet gespeicherte Werte mit Ausschnitt", () => {
    const strasse = erster("Siemensstraße");
    expect(strasse?.eintrag.ziel).toBe("strasse");
    expect(strasse?.imWert).toContain("Siemens");
    expect(ziele("40384963")).toEqual(expect.arrayContaining(["telefon", "whatsapp"]));
    expect(erster("abgeholt")?.eintrag.ziel).toBe("fertig");
  });

  it("liefert nichts für Unsinn und Füllwörter", () => {
    expect(einstellungenSuchen("xyzqv", verzeichnis)).toEqual([]);
    expect(einstellungenSuchen("wie", verzeichnis)).toEqual([]);
    expect(einstellungenSuchen("  ", verzeichnis)).toEqual([]);
  });

  it("baut den Link mit Reiter und Ziel", () => {
    expect(trefferLink(erster("IBAN")!.eintrag)).toBe("/admin/einstellungen?bereich=firma&feld=iban");
    expect(trefferLink(erster("Webhooks")!.eintrag)).toBe("/admin/einstellungen?bereich=schnittstellen&feld=%23webhooks");
  });
});

describe("tippAbstand", () => {
  it("zählt Vertauschen als einen Fehler", () => {
    expect(tippAbstand("garm", "gram")).toBe(1);
    expect(tippAbstand("bank", "bank")).toBe(0);
    expect(tippAbstand("", "abc")).toBe(3);
  });
});
