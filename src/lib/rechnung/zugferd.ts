import "server-only";
import { AFRelationship, PDFDocument, PDFName, PDFString } from "pdf-lib";
import type { Einstellungen } from "../einstellungen";
import { berechne, type Position } from "./berechnung";

export type RechnungsDaten = {
  nummer: string;
  storno: boolean;
  rechnungsdatum: string;
  leistungsdatum: string | null;
  faellig_am: string | null;
  hinweis: string;
  positionen: Position[];
  empfaenger: { name: string; firma?: string; strasse?: string; plz?: string; ort?: string; email?: string; ust_id?: string; leitweg_id?: string };
  firma: Einstellungen["firma"];
  storno_zu_nummer?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const betrag = (cent: number) => (cent / 100).toFixed(2);
const tag = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

const EINHEITEN: Record<string, string> = { Stk: "H87", Std: "HUR", Pauschal: "LS", l: "LTR", Satz: "SET", km: "KMT" };

/**
 * Rechnungsdaten als UN/CEFACT Cross Industry Invoice im Profil EN 16931 (ZUGFeRD 2 / Factur-X).
 * Eine Stornorechnung wird als Gutschrift (Typ 381) mit positiven Beträgen ausgegeben, so wie es die
 * Norm vorsieht; im PDF steht sie mit Minusbeträgen.
 */
export function zugferdXml(r: RechnungsDaten): string {
  const vorzeichen = r.storno ? -1 : 1;
  const positionen = r.positionen.map((p) => ({ ...p, einzel_brutto_cent: p.einzel_brutto_cent * vorzeichen }));
  const s = berechne(positionen);
  const steuerId = r.firma.ustId
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(r.firma.ustId)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : r.firma.steuernummer
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(r.firma.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "";

  const zeilen = positionen
    .map((p, i) => {
      const netto = s.zeilenNetto[i];
      const einzelNetto = p.menge === 0 ? 0 : netto / p.menge / 100;
      return `<ram:IncludedSupplyChainTradeLineItem>
<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
<ram:SpecifiedTradeProduct><ram:Name>${esc(p.text)}</ram:Name></ram:SpecifiedTradeProduct>
<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${einzelNetto.toFixed(4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${EINHEITEN[p.einheit] ?? "C62"}">${p.menge}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
<ram:SpecifiedLineTradeSettlement>
<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${p.mwst_satz}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${betrag(netto)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
</ram:SpecifiedLineTradeSettlement>
</ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n");

  const e = r.empfaenger;
  const adresse = (plz?: string, strasse?: string, ort?: string) =>
    `<ram:PostalTradeAddress>${plz ? `<ram:PostcodeCode>${esc(plz)}</ram:PostcodeCode>` : ""}${strasse ? `<ram:LineOne>${esc(strasse)}</ram:LineOne>` : ""}${ort ? `<ram:CityName>${esc(ort)}</ram:CityName>` : ""}<ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument>
<ram:ID>${esc(r.nummer)}</ram:ID>
<ram:TypeCode>${r.storno ? "381" : "380"}</ram:TypeCode>
<ram:IssueDateTime><udt:DateTimeString format="102">${tag(r.rechnungsdatum)}</udt:DateTimeString></ram:IssueDateTime>
${r.hinweis ? `<ram:IncludedNote><ram:Content>${esc(r.hinweis)}</ram:Content></ram:IncludedNote>` : ""}
</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${zeilen}
<ram:ApplicableHeaderTradeAgreement>
<ram:BuyerReference>${esc(e.leitweg_id || "-")}</ram:BuyerReference>
<ram:SellerTradeParty>
<ram:Name>${esc(r.firma.name)}</ram:Name>
<ram:DefinedTradeContact><ram:PersonName>${esc(r.firma.inhaber)}</ram:PersonName><ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(r.firma.telefon)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication><ram:EmailURIUniversalCommunication><ram:URIID>${esc(r.firma.email)}</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>
${adresse(r.firma.plz, r.firma.strasse, r.firma.ort)}
<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(r.firma.email)}</ram:URIID></ram:URIUniversalCommunication>
${steuerId}
</ram:SellerTradeParty>
<ram:BuyerTradeParty>
<ram:Name>${esc(e.firma || e.name)}</ram:Name>
${adresse(e.plz, e.strasse, e.ort)}
${e.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(e.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
${e.ust_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(e.ust_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
</ram:BuyerTradeParty>
</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery>${r.leistungsdatum ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${tag(r.leistungsdatum)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` : ""}</ram:ApplicableHeaderTradeDelivery>
<ram:ApplicableHeaderTradeSettlement>
<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${r.firma.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(r.firma.iban.replace(/\s/g, ""))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>10</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>`}
${s.gruppen
  .map(
    (g) =>
      `<ram:ApplicableTradeTax><ram:CalculatedAmount>${betrag(g.steuer)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>${betrag(g.netto)}</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${g.satz}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`,
  )
  .join("\n")}
${r.faellig_am ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${tag(r.faellig_am)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ""}
<ram:SpecifiedTradeSettlementHeaderMonetarySummation>
<ram:LineTotalAmount>${betrag(s.netto)}</ram:LineTotalAmount>
<ram:TaxBasisTotalAmount>${betrag(s.netto)}</ram:TaxBasisTotalAmount>
<ram:TaxTotalAmount currencyID="EUR">${betrag(s.steuer)}</ram:TaxTotalAmount>
<ram:GrandTotalAmount>${betrag(s.brutto)}</ram:GrandTotalAmount>
<ram:DuePayableAmount>${betrag(s.brutto)}</ram:DuePayableAmount>
</ram:SpecifiedTradeSettlementHeaderMonetarySummation>
${r.storno && r.storno_zu_nummer ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${esc(r.storno_zu_nummer)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : ""}
</ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`.replace(/\n{2,}/g, "\n");
}

function xmp(nummer: string): string {
  const jetzt = new Date().toISOString();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Rechnung ${esc(nummer)}</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>${jetzt}</xmp:CreateDate><xmp:ModifyDate>${jetzt}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Version of the Factur-X XML schema</pdfaProperty:description></rdf:li>
<rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Conformance level of the embedded XML</pdfaProperty:description></rdf:li>
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Bettet die XML-Rechnung als factur-x.xml in das PDF ein und setzt die Factur-X-Metadaten. Das ergibt eine
 * hybride E-Rechnung: Menschen lesen das PDF, Buchhaltungsprogramme die XML.
 */
export async function alsZugferd(pdf: Uint8Array, xml: string, nummer: string): Promise<Uint8Array> {
  const dok = await PDFDocument.load(pdf);
  await dok.attach(Buffer.from(xml, "utf8"), "factur-x.xml", {
    mimeType: "text/xml",
    description: "Factur-X/ZUGFeRD Rechnung",
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  dok.setTitle(`Rechnung ${nummer}`);
  dok.setLanguage("de-DE");
  const metadaten = dok.context.stream(Buffer.from(xmp(nummer), "utf8"), { Type: "Metadata", Subtype: "XML" });
  dok.catalog.set(PDFName.of("Metadata"), dok.context.register(metadaten));
  dok.catalog.set(PDFName.of("Lang"), PDFString.of("de-DE"));
  return dok.save({ useObjectStreams: false });
}
