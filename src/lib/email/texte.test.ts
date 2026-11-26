import { describe, expect, it } from "vitest";
import { fahrzeugAngabe, fuerFahrzeug, GRUSS_STANDARD, MAIL_PLATZHALTER, MAIL_PLATZHALTER_JE, MAIL_STANDARD, MAIL_VORLAGEN, mailTexte, type MailTexteEinstellung } from "./texte";

const firma = { name: "FLC Automotive", inhaber: "Flavio Ciurli", telefon: "06074 123", strasse: "Siemensstraße 15", plz: "63128", ort: "Dietzenbach", hinweisAnfahrt: "Eingang in der Karl-Benz-Straße." };
const mit = (t: MailTexteEinstellung) => ({ mailTexte: t, firma });
const leer: MailTexteEinstellung = { gruss: "", vorlagen: {} };

describe("mailTexte", () => {
  it("füllt den Standard im Fließtext", () => {
    const m = mailTexte(mit(leer), "rechnung", {
      name: "Max Mustermann",
      nummer: "RE-2026-0142",
      betrag: "389,00 €",
      fuer_fahrzeug: "für Ihr Fahrzeug VW Golf (OF-MM 123)",
      zahlung: "Bitte überweisen Sie den Betrag bis zum 10.12.2026.",
    });
    expect(m.betreff).toBe("Ihre Rechnung RE-2026-0142");
    expect(m.text).toBe(
      "Hallo Max Mustermann,\n\nvielen Dank für Ihren Auftrag. Anbei erhalten Sie unsere Rechnung RE-2026-0142 über 389,00 € für Ihr Fahrzeug VW Golf (OF-MM 123).\n\nBitte überweisen Sie den Betrag bis zum 10.12.2026.",
    );
    expect(m.gruss).toBe("Viele Grüße\nFlavio Ciurli und Team");
  });

  it("ohne Fahrzeug und ohne offenen Betrag bleibt kein Loch", () => {
    const m = mailTexte(mit(leer), "rechnung", { name: "Jan", nummer: "RE-1", betrag: "10,00 €", fuer_fahrzeug: "", zahlung: "" });
    expect(m.text).toBe("Hallo Jan,\n\nvielen Dank für Ihren Auftrag. Anbei erhalten Sie unsere Rechnung RE-1 über 10,00 €.");
  });

  it("leere Klammern und Sätze fallen weg", () => {
    const m = mailTexte(mit(leer), "termin_bestaetigt", { name: "Jan", leistung: "Ölwechsel", datum: "Montag, 1. Dezember", uhrzeit: "10:00", fahrzeug: "", frist: "24" });
    expect(m.text).toBe(
      "Hallo Jan,\n\nIhr Termin für Ölwechsel am Montag, 1. Dezember um 10:00 Uhr ist bestätigt. Die Kalenderdatei hängt an dieser Mail.\n\nSie finden uns in der Siemensstraße 15, 63128 Dietzenbach. Eingang in der Karl-Benz-Straße.",
    );
    const a = mailTexte(mit(leer), "auftrag_freigabe", { name: "Jan", nummer: "WA-7", betrag: "120,00 €", fuer_fahrzeug: "", grenze_satz: "", termin_satz: "" });
    expect(a.text).toBe("Hallo Jan,\n\nanbei erhalten Sie den Werkstattauftrag WA-7. Die Arbeiten kosten voraussichtlich 120,00 €.\n\nBitte schauen Sie sich den Auftrag an und erteilen Sie ihn uns mit einem Klick.");
  });

  it("nimmt eigene Texte, leere Felder fallen auf den Standard zurück", () => {
    const m = mailTexte(mit({ gruss: "Beste Grüße\n{firma}", vorlagen: { rechnung: { text: "Moin {name}, hier ist Rechnung {nummer}.", betreff: "  " } } }), "rechnung", { name: "Jan", nummer: "RE-1" });
    expect(m.text).toBe("Moin Jan, hier ist Rechnung RE-1.");
    expect(m.betreff).toBe("Ihre Rechnung RE-1");
    expect(m.gruss).toBe("Beste Grüße\nFLC Automotive");
  });

  it("Betreff einzeilig, Felder, die es bei der Mail nicht gibt, bleiben leer", () => {
    const m = mailTexte(mit({ gruss: "", vorlagen: { intern_absage: { betreff: "Absage\n{leistung}", text: "soll nicht erscheinen" } } }), "intern_absage", { leistung: "Ölwechsel" });
    expect(m.betreff).toBe("Absage Ölwechsel");
    expect(m.text).toBe("");
  });
});

describe("Fahrzeug im Text", () => {
  it("Termin und Beleg", () => {
    expect(fahrzeugAngabe({ kennzeichen: "OF-MM 123", marke_modell: "VW Golf" })).toBe("VW Golf, OF-MM 123");
    expect(fuerFahrzeug({ kennzeichen: "OF-MM 123", marke: "Lancia", modell: "Delta" })).toBe("für Ihr Fahrzeug Lancia Delta (OF-MM 123)");
    expect(fuerFahrzeug({ kennzeichen: "OF-MM 123" })).toBe("für Ihr Fahrzeug OF-MM 123");
    expect(fuerFahrzeug(null)).toBe("");
  });
});

describe("Standardtexte", () => {
  it("jede Mail hat einen Standard und nur Platzhalter, die sie auch füllt", () => {
    const bekannt = new Set(MAIL_PLATZHALTER.map(([k]) => k));
    for (const { schluessel } of MAIL_VORLAGEN) {
      const t = MAIL_STANDARD[schluessel];
      expect(t.betreff, schluessel).toBeTruthy();
      for (const wert of Object.values(t)) {
        for (const [, k] of wert.matchAll(/\{(\w+)\}/g)) {
          expect(MAIL_PLATZHALTER_JE[schluessel], `${schluessel}: {${k}}`).toContain(k);
          expect(bekannt.has(k), k).toBe(true);
        }
      }
    }
    expect(Object.keys(MAIL_STANDARD).sort()).toEqual(MAIL_VORLAGEN.map((v) => v.schluessel).sort());
    expect(GRUSS_STANDARD).toContain("{inhaber}");
  });
});
