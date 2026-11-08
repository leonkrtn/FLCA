import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { STANDARD } from "../einstellungen";
import { rechnungPdf } from "./pdf";
import { alsZugferd, zugferdXml } from "./zugferd";

const firma = { ...STANDARD.firma, steuernummer: "035 123 45678", iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX", bank: "Commerzbank" };
const daten = {
  nummer: "RE-2026-0001",
  storno: false,
  rechnungsdatum: "2026-11-08",
  leistungsdatum: "2026-11-07",
  faellig_am: "2026-11-22",
  hinweis: "",
  positionen: [
    { text: "Radwechsel inkl. Auswuchten", menge: 1, einheit: "Pauschal", einzel_brutto_cent: 4000, mwst_satz: 19 },
    { text: "Ventil", menge: 4, einheit: "Stk", einzel_brutto_cent: 299, mwst_satz: 19 },
    { text: "Arbeitszeit", menge: 0.5, einheit: "Std", einzel_brutto_cent: 8900, mwst_satz: 19 },
  ],
  empfaenger: { name: "Max Beispielkunde", strasse: "Hauptstraße 1", plz: "63128", ort: "Dietzenbach", email: "max@example.org" },
  firma,
};

describe("Rechnungs-PDF mit E-Rechnung", () => {
  it("erzeugt ein PDF mit eingebetteter factur-x.xml", async () => {
    const pdf = await rechnungPdf({ ...daten, kundennummer: 10001, fahrzeug: { kennzeichen: "OF-FC 123", modell: "Lancia Delta" }, einleitung: "Test", fusstext: "Fuß", bezahlt: false });
    const xml = zugferdXml(daten);
    const hybrid = await alsZugferd(new Uint8Array(pdf), xml, daten.nummer);
    writeFileSync("/tmp/rechnung-test.pdf", hybrid);
    writeFileSync("/tmp/factur-x.xml", xml);
    const dok = await PDFDocument.load(hybrid);
    expect(dok.getPageCount()).toBe(1);
    expect(Buffer.from(hybrid).includes(Buffer.from("factur-x.xml"))).toBe(true);
    expect(xml).toContain("<ram:GrandTotalAmount>96.46</ram:GrandTotalAmount>");
  }, 30000);
});
