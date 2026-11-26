import { describe, expect, it } from "vitest";
import { GRUSS_STANDARD, MAIL_PLATZHALTER, MAIL_PLATZHALTER_JE, MAIL_STANDARD, MAIL_VORLAGEN, mailTexte, type MailTexteEinstellung } from "./texte";

const firma = { name: "FLC Automotive", inhaber: "Flavio Ciurli", telefon: "06074 123" };
const mit = (mailTexte_: MailTexteEinstellung) => ({ mailTexte: mailTexte_, firma });
const leer: MailTexteEinstellung = { gruss: "", vorlagen: {} };

describe("mailTexte", () => {
  it("füllt den Standard", () => {
    const m = mailTexte(mit(leer), "rechnung", { name: "Frau Meier", nummer: "RE-2026-0001" });
    expect(m.betreff).toBe("Rechnung RE-2026-0001 von FLC Automotive");
    expect(m.ueberschrift).toBe("Ihre Rechnung RE-2026-0001");
    expect(m.text).toBe("Hallo Frau Meier,\nvielen Dank für Ihren Auftrag. Ihre Rechnung hängt als PDF an dieser Mail.");
    expect(m.gruss).toBe("Viele Grüße\nFlavio Ciurli und Team");
  });

  it("nimmt eigene Texte, leere Felder fallen auf den Standard zurück", () => {
    const m = mailTexte(mit({ gruss: "Beste Grüße\n{firma}", vorlagen: { rechnung: { text: "Moin {name}, hier ist Rechnung {nummer}.", betreff: "  " } } }), "rechnung", { name: "Jan", nummer: "RE-1" });
    expect(m.text).toBe("Moin Jan, hier ist Rechnung RE-1.");
    expect(m.betreff).toBe("Rechnung RE-1 von FLC Automotive");
    expect(m.gruss).toBe("Beste Grüße\nFLC Automotive");
  });

  it("lässt leere und unbekannte Platzhalter ohne Lücke weg", () => {
    const m = mailTexte(mit(leer), "termin_gegenvorschlag", { name: "Jan", wunschzeit: "zu Ihrer Wunschzeit", frei_bis: "" });
    expect(m.text).toBe("Hallo Jan,\nzu Ihrer Wunschzeit klappt es leider nicht. Wir schlagen Ihnen diesen Termin vor und halten ihn für Sie frei.");
    const r = mailTexte(mit(leer), "radwechsel", { name: "Jan", reifen: "Winterreifen", raeder: "Winterräder", fuer_fahrzeug: "", dauer: "" });
    expect(r.text).toBe("Hallo Jan,\nIhre Winterräder liegen bei uns bereit. Suchen Sie sich einen freien Termin aus.");
  });

  it("Hinweise ans Büro: Überschrift ist der Betreff, Betreff einzeilig", () => {
    const m = mailTexte(mit({ gruss: "", vorlagen: { intern_absage: { betreff: "Absage\n{leistung}" } } }), "intern_absage", { leistung: "Ölwechsel" });
    expect(m.betreff).toBe("Absage Ölwechsel");
    expect(m.ueberschrift).toBe("Absage Ölwechsel");
    expect(m.text).toBe("");
  });

  it("ignoriert gespeicherte Felder, die es bei dieser Mail nicht gibt", () => {
    const m = mailTexte(mit({ gruss: "", vorlagen: { intern_krank: { text: "soll nicht erscheinen" } } }), "intern_krank", { person: "Tom" });
    expect(m.text).toBe("");
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
