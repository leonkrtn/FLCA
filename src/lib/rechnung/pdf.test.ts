import { writeFileSync } from "node:fs";
import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { STANDARD } from "../einstellungen";
import { rechnungPdf } from "./pdf";
import { alsZugferd, eRechnungPruefen, istXRechnung, zugferdXml } from "./zugferd";

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
    // PDF/A-3: Farbprofil und Metadaten mit Factur-X-Stufe
    expect(dok.catalog.has(PDFName.of("OutputIntents"))).toBe(true);
    expect(Buffer.from(hybrid).includes(Buffer.from("<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>"))).toBe(true);
  }, 30000);
});

describe("E-Rechnung und XRechnung", () => {
  const behoerde = { ...daten, empfaenger: { ...daten.empfaenger, name: "Stadt Dietzenbach", leitweg_id: "991-12345-67" } };

  it("ohne Leitweg-ID: EN 16931, keine Käuferreferenz, Zahlungsbedingung und Verwendungszweck", () => {
    const xml = zugferdXml(daten);
    expect(istXRechnung(daten)).toBe(false);
    expect(xml).toContain("<ram:ID>urn:cen.eu:en16931:2017</ram:ID>");
    expect(xml).not.toContain("BuyerReference");
    expect(xml).toContain("<ram:Description>Zahlbar bis 22.11.2026 ohne Abzug</ram:Description>");
    expect(xml).toContain("<ram:PaymentReference>RE-2026-0001</ram:PaymentReference>");
  });

  it("mit Leitweg-ID: XRechnung 3.0 mit Leitweg-ID und Geschäftsprozess", () => {
    const xml = zugferdXml(behoerde);
    expect(istXRechnung(behoerde)).toBe(true);
    expect(xml).toContain("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0");
    expect(xml).toContain("<ram:BuyerReference>991-12345-67</ram:BuyerReference>");
    expect(xml).toContain("urn:fdc:peppol.eu:2017:poacc:billing:01:1.0");
    writeFileSync("/tmp/xrechnung-test.xml", xml);
  });

  it("prüft Pflichtangaben, bei Behörden strenger", () => {
    expect(eRechnungPruefen(daten)).toEqual([]);
    expect(eRechnungPruefen(behoerde)).toEqual([]);
    const ohne = { ...behoerde, empfaenger: { name: "Stadt", leitweg_id: "991-1" }, firma: { ...firma, iban: "", steuernummer: "", ustId: "" } };
    const fehlt = eRechnungPruefen(ohne).join(" | ");
    expect(fehlt).toContain("Steuernummer");
    expect(fehlt).toContain("IBAN");
    expect(fehlt).toContain("Straße, PLZ und Ort der Behörde");
    expect(fehlt).toContain("E-Mail-Adresse der Behörde");
    expect(eRechnungPruefen({ ...daten, positionen: [] })).toContain("mindestens eine Position");
  });
});

describe("Netto-Beleg mit Lohn, Teil und Rabatt", () => {
  const netto = {
    ...daten,
    nummer: "RE-2026-0002",
    positionen: [
      { text: "Bremsen vorne erneuern", menge: 1.5, einheit: "Std", einzel_netto_cent: 7500, mwst_satz: 19, lohnart: "Mechanik" },
      { text: "Bremsscheiben vorne", menge: 2, einheit: "Stk", einzel_netto_cent: 6500, mwst_satz: 19, ek_cent: 5000, aufschlag: 30 },
      { text: "Radwechsel", menge: 1, einheit: "Pauschal", einzel_netto_cent: 3361.34, mwst_satz: 19 },
      { text: "Stammkunde", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt: { prozent: 10 } },
    ],
  };

  it("PDF entsteht, E-Rechnung weist den Rabatt als Nachlass aus und verrät keinen Einkaufspreis", async () => {
    const pdf = await rechnungPdf({ ...netto, kundennummer: 10001, fahrzeug: { kennzeichen: "OF-FC 123", marke: "VW", modell: "Golf" }, einleitung: "Test", fusstext: "Fuß", bezahlt: false });
    expect(pdf.length).toBeGreaterThan(1000);
    const xml = zugferdXml(netto);
    // Positionen 11250 + 13000 + 3361 = 27611, Rabatt 2761, Netto 24850, Steuer 4722
    expect(xml).toContain("<ram:LineTotalAmount>276.11</ram:LineTotalAmount>");
    expect(xml).toContain("<ram:AllowanceTotalAmount>27.61</ram:AllowanceTotalAmount>");
    expect(xml).toContain("<ram:TaxBasisTotalAmount>248.50</ram:TaxBasisTotalAmount>");
    expect(xml).toContain("<ram:GrandTotalAmount>295.72</ram:GrandTotalAmount>");
    expect(xml.match(/<ram:IncludedSupplyChainTradeLineItem>/g)?.length).toBe(3);
    expect(xml).not.toContain("50.00");
  }, 30000);

  it("Storno als Gutschrift mit positiven Beträgen", () => {
    const xml = zugferdXml({ ...netto, storno: true, positionen: netto.positionen.map((p) => ({ ...p, einzel_netto_cent: -p.einzel_netto_cent })) });
    expect(xml).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(xml).toContain("<ram:GrandTotalAmount>295.72</ram:GrandTotalAmount>");
  });
});
