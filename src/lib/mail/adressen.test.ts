import { describe, expect, it } from "vitest";
import { adresseZerlegen, adressListe, antwortBetreff, betreffKern, htmlAlsText, mailNameAus, mailNameVon, nachrichtenIds, postfaecherFuer, textAlsHtml, zitat } from "./adressen";

describe("mailNameAus", () => {
  it("Vorname.Nachname klein", () => expect(mailNameAus("Flavio Ciurli")).toBe("flavio.ciurli"));
  it("Umlaute ausgeschrieben", () => expect(mailNameAus("Jürgen Größer")).toBe("juergen.groesser"));
  it("Akzente weg", () => expect(mailNameAus("José Müller-Lüdenscheidt")).toBe("jose.mueller-luedenscheidt"));
  it("zweiter Vorname fällt weg", () => expect(mailNameAus("Anna Maria Schmidt")).toBe("anna.schmidt"));
  it("nur ein Wort", () => expect(mailNameAus("  Max ")).toBe("max"));
  it("leer", () => expect(mailNameAus("")).toBe(""));
  it("eigener Name hat Vorrang", () => expect(mailNameVon({ name: "Flavio Ciurli", mail_name: "flavio" })).toBe("flavio"));
});

describe("Adressen", () => {
  it("mit Namen", () => expect(adresseZerlegen('"Max Muster" <Max@Beispiel.de>')).toEqual({ name: "Max Muster", adresse: "max@beispiel.de" }));
  it("nackt", () => expect(adresseZerlegen("max@beispiel.de")).toEqual({ name: "", adresse: "max@beispiel.de" }));
  it("Liste", () => expect(adressListe("a@b.de, C <c@d.de>; e@f.de")).toEqual(["a@b.de", "c@d.de", "e@f.de"]));
});

describe("postfaecherFuer", () => {
  const personen = [
    { id: "p1", name: "Flavio Ciurli", aktiv: true },
    { id: "p2", name: "Max Muster", mail_name: "max", aktiv: true },
    { id: "p3", name: "Alt Weg", aktiv: false },
  ];
  it("Person nach Vorname.Nachname", () => expect(postfaecherFuer(["Flavio <flavio.ciurli@flcautomotive.de>"], "flcautomotive.de", personen)).toEqual(["p1"]));
  it("eigener Name", () => expect(postfaecherFuer(["max@flcautomotive.de"], "flcautomotive.de", personen)).toEqual(["p2"]));
  it("info@ ins Firmenpostfach", () => expect(postfaecherFuer(["info@flcautomotive.de"], "flcautomotive.de", personen)).toEqual([null]));
  it("deaktivierte Person ins Firmenpostfach", () => expect(postfaecherFuer(["alt.weg@flcautomotive.de"], "flcautomotive.de", personen)).toEqual([null]));
  it("mehrere Empfänger, fremde Adressen zählen nicht", () =>
    expect(postfaecherFuer(["info@flcautomotive.de", "max@flcautomotive.de", "kunde@web.de"], "flcautomotive.de", personen)).toEqual([null, "p2"]));
  it("ohne eigene Adresse ins Firmenpostfach", () => expect(postfaecherFuer(["kunde@web.de"], "flcautomotive.de", personen)).toEqual([null]));
});

describe("Betreff und Verlauf", () => {
  it("Kern ohne AW/Re", () => expect(betreffKern("AW: Re: WG: Termin am Montag")).toBe("termin am montag"));
  it("Antwort bekommt genau ein AW", () => expect(antwortBetreff("Re: AW: Termin")).toBe("AW: Termin"));
  it("Message-IDs", () => expect(nachrichtenIds("<a@x>", "<b@y> <c@z>", null)).toEqual(["<a@x>", "<b@y>", "<c@z>"]));
  it("Zitat", () => expect(zitat("Hallo\n\nGruß", "Max", "1.12.2026")).toBe("\n\nAm 1.12.2026 schrieb Max:\n> Hallo\n>\n> Gruß"));
});

describe("Text und HTML", () => {
  it("HTML maskiert", () => expect(textAlsHtml("a <b> & c")).toContain("a &lt;b&gt; &amp; c"));
  it("Zitat als blockquote", () => expect(textAlsHtml("Hi\n\n> alt")).toContain("<blockquote"));
  it("Antwort mit Zitat darunter", () => {
    const html = textAlsHtml(`Danke!${zitat("Hallo\n\nGruß", "Max", "1.12.2026")}`);
    expect(html).toContain("<p style=\"margin:0 0 1em\">Am 1.12.2026 schrieb Max:</p><blockquote");
    expect(html).toContain("Hallo<br><br>Gruß</blockquote>");
  });
  it("HTML zu Text", () => expect(htmlAlsText("<p>Hallo&nbsp;Welt</p><style>x{}</style><div>Zeile<br>2</div>")).toBe("Hallo Welt\nZeile\n2"));
});
