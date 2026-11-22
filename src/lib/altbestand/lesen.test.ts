import { describe, expect, it } from "vitest";
import { alsObjekte, csvLesen, dateiArt, gueltigesKennzeichen, isoDatum, planen, plzOrt, zaehlen } from "./lesen";

// Erfundene Kunden im Format der Dateien aus der Übernahme der alten Rechnungs-PDFs.
const KUNDEN = `﻿Name;Anrede;Straße;PLZ Ort;Kennzeichen;KM-Stände;Sonstiges;Rechnungen;Anzahl;Umsatz brutto (ohne Korrekturen);Erste;Letzte;Zahlart
Max Muster;Herr;Altweg 1 | Neuweg 2;63128 Dietzenbach | 63110 Rodgau;OF-MM 1, OF-MM 2;"120000 (OF-MM 1, 01.02.2026); 125000 (OF-MM 1, 01.06.2026)";;0005, 0007, 0007.1*;3;500,00;01.02.2026;01.06.2026;bar (bezahlt) (3)
Erika Probe;Frau;Bachstraße 3;63150 Heusenstamm;OF-SJ;;fahrzeug: BMW 5 Touring;0005;1;100,00;01.03.2026;01.03.2026;Überweisung (1)
Schulungen;Firma;Odenwald Str. 36;63322 Rödermark;;;ansprechpartner: Karl Kurs;0009;1;119,00;10.11.2026;10.11.2026;Überweisung (1)
"Werkstatt ""Süd"" GmbH";Firma;Ring 5;60311 Frankfurt am Main;F-WS 9;;;0010;1;50,00;01.01.2026;01.01.2026;Überweisung (1)
Ion Popescu;Herr;Rozelor 34;Constanta (RO);CT 97 DST;;;0011;1;290,00;13.11.2026;13.11.2026;bar (bezahlt) (1)
`;

const RECHNUNGEN = `nummer;fassung;datum;leistungsdatum;name;anrede;strasse;plz;ort;land;kennzeichen;km;steuer;netto;mwst;brutto;vereinbarter_preis;regulaerpreis;brutto_inkl_durchlaufend;endbetrag;zahlart;datei
0005;Original;01.02.2026;31.01.2026;Max Muster;;Altweg 1;63128;Dietzenbach;DE;OF-MM 1;120000;19% USt;100,0;19,0;119,0;;;;119,0;bar (bezahlt);Rechnung Max Muster 0005.pdf
0005;Original;01.03.2026;01.03.2026;Erika Probe;;Bachstraße 3;63150;Heusenstamm;DE;;;§19 Kleinunternehmer (ohne USt);;;100,0;;;;100,0;Überweisung, Frist 10.03.2026;Rechnung Erika Probe 0005.pdf
0007;Original;01.06.2026;01.06.2026;Max Muster;;Altweg 1;63128;Dietzenbach;DE;OF-MM 1;125000;19% USt;200,0;38,0;238,0;;;;238,0;bar (bezahlt);Rechnung Max Muster 0007.pdf
0007.1;Korrektur/Neufassung;01.06.2026;01.06.2026;Max Muster;;Neuweg 2;63110;Rodgau;DE;OF-MM 1;;19% USt;200,0;38,0;238,0;;;;238,0;bar (bezahlt);Rechnung Max Muster 0007.1.pdf
0011;Original;13.11.2026;13.11.2026;Ion Popescu;;Rozelor 34;;Constanta;RO;CT 97 DST;514332;19% USt;243,7;46,3;290,0;;;;290,0;bar (bezahlt);Rechnung Ion Popescu 0011.pdf
0012;Original;14.11.2026;14.11.2026;Neu Ohne Kartei;;Gasse 1;63128;Dietzenbach;DE;;;19% USt;10,0;1,9;11,9;150,0;250,0;;150,0;bar (bezahlt);Rechnung Neu 0012.pdf
`;

const POSITIONEN = `rechnung;datum;kunde;kennzeichen;pos;bezeichnung;menge;einzel;summe;steuer
0005;01.02.2026;Max Muster;OF-MM 1;1;Ölwechsel 5W30;1;100,0;100,0;19% USt
0005;01.03.2026;Erika Probe;;1;Räderwechsel;4;25,0;100,0;§19 Kleinunternehmer (ohne USt)
0007;01.06.2026;Max Muster;OF-MM 1;1;Dienstleistung;2h;100,0;200,0;19% USt
0099;01.01.2026;Niemand;;1;Gibt es nicht;1;1,0;1,0;19% USt
`;

const lesen = (t: string) => {
  const z = csvLesen(t);
  return { art: dateiArt(z[0]), zeilen: alsObjekte(z) };
};

describe("CSV lesen", () => {
  it("erkennt die drei Dateien an den Spalten", () => {
    expect(lesen(KUNDEN).art).toBe("kunden");
    expect(lesen(RECHNUNGEN).art).toBe("rechnungen");
    expect(lesen(POSITIONEN).art).toBe("positionen");
    expect(dateiArt(["a", "b"])).toBeNull();
  });
  it("Anführungszeichen, verdoppelte Anführungszeichen und Semikolon im Feld", () => {
    expect(csvLesen('a;b\n"x;y";"sagt ""hallo"""\n')).toEqual([["a", "b"], ["x;y", 'sagt "hallo"']]);
  });
  it("Windows-Zeilenenden und leere Zeilen", () => {
    expect(csvLesen("a;b\r\n1;2\r\n\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("Werte", () => {
  it("Datum", () => {
    expect(isoDatum("01.02.2026")).toBe("2026-02-01");
    expect(isoDatum("32.01.2026")).toBeNull();
    expect(isoDatum("")).toBeNull();
  });
  it("PLZ und Ort, auch im Ausland", () => {
    expect(plzOrt("63179 Obertshausen")).toEqual({ plz: "63179", ort: "Obertshausen" });
    expect(plzOrt("Constanta (RO)")).toEqual({ plz: "", ort: "Constanta, Rumänien" });
  });
  it("unvollständige Kennzeichen fallen weg", () => {
    expect(gueltigesKennzeichen("of-ab 12")).toBe("OF-AB 12");
    expect(gueltigesKennzeichen("OF-SJ")).toBe("");
  });
});

describe("planen", () => {
  const plan = planen({ kunden: lesen(KUNDEN).zeilen, rechnungen: lesen(RECHNUNGEN).zeilen, positionen: lesen(POSITIONEN).zeilen });
  const kunde = (name: string) => plan.kunden.find((k) => k.name === name)!;

  it("doppelte Rechnungsnummer landet über den Namen beim richtigen Kunden", () => {
    expect(kunde("Max Muster").rechnungen.map((r) => r.nummer)).toEqual(["0005", "0007", "0007.1"]);
    expect(kunde("Erika Probe").rechnungen.map((r) => r.datei)).toEqual(["Rechnung Erika Probe 0005.pdf"]);
  });
  it("Positionen über Nummer, Datum und Name", () => {
    expect(kunde("Max Muster").rechnungen[0].positionen).toEqual([{ pos: 1, text: "Ölwechsel 5W30", menge: "1", einzel_cent: 10000, summe_cent: 10000 }]);
    expect(kunde("Erika Probe").rechnungen[0].positionen[0].text).toBe("Räderwechsel");
    expect(plan.hinweise).toContain("1 Positionen passen zu keiner Rechnung und wurden übergangen.");
  });
  it("Anschrift der jüngsten Rechnung, am selben Tag gewinnt die Korrektur", () => {
    expect(kunde("Max Muster")).toMatchObject({ strasse: "Neuweg 2", plz: "63110", ort: "Rodgau" });
  });
  it("Fahrzeuge mit dem jüngsten KM-Stand, unvollständiges Kennzeichen nicht", () => {
    expect(kunde("Max Muster").fahrzeuge).toEqual([
      { kennzeichen: "OF-MM 1", km_stand: 125000, km_datum: "2026-06-01", marke_modell: "" },
      { kennzeichen: "OF-MM 2", km_stand: null, km_datum: null, marke_modell: "" },
    ]);
    expect(kunde("Erika Probe").fahrzeuge).toEqual([]);
    expect(kunde("Erika Probe").notiz).toBe("Aus alten Rechnungen: Fahrzeug: BMW 5 Touring");
  });
  it("Firma mit Ansprechpartner, Firma ohne steht im Namen", () => {
    expect(kunde("Karl Kurs")).toMatchObject({ firma: "Schulungen", notiz: "Aus alten Rechnungen: Geschäftskunde" });
    expect(kunde('Werkstatt "Süd" GmbH').firma).toBe("");
  });
  it("Ausland: Land am Ort", () => {
    expect(kunde("Ion Popescu")).toMatchObject({ plz: "", ort: "Constanta, Rumänien" });
  });
  it("Beträge, Steuer und Sonderpreis", () => {
    const klein = kunde("Erika Probe").rechnungen[0];
    expect(klein).toMatchObject({ steuer: "kleinunternehmer", netto_cent: 10000, mwst_cent: 0, endbetrag_cent: 10000, rechnungsdatum: "2026-03-01" });
    expect(kunde("Max Muster").rechnungen[2].korrektur).toBe(true);
    expect(kunde("Neu Ohne Kartei").rechnungen[0]).toMatchObject({ endbetrag_cent: 15000, regulaer_cent: 25000 });
  });
  it("Rechnung ohne Zeile in der Kundendatei legt den Kunden aus der Rechnung an", () => {
    expect(kunde("Neu Ohne Kartei")).toMatchObject({ strasse: "Gasse 1", plz: "63128" });
    expect(plan.hinweise.some((h) => h.includes("Neu Ohne Kartei"))).toBe(true);
  });
  it("zählt", () => {
    expect(zaehlen(plan)).toEqual({ kunden: 6, fahrzeuge: 4, rechnungen: 6, positionen: 3 });
  });
});

describe("planen mit einzelnen Dateien", () => {
  it("nur Rechnungen: Kunden entstehen aus den Rechnungen", () => {
    const p = planen({ rechnungen: lesen(RECHNUNGEN).zeilen });
    expect(p.kunden.map((k) => k.name)).toEqual(["Max Muster", "Erika Probe", "Ion Popescu", "Neu Ohne Kartei"]);
    expect(p.hinweise).toEqual([]);
  });
  it("nur Positionen: werden gemeldet und übergangen", () => {
    const p = planen({ positionen: lesen(POSITIONEN).zeilen });
    expect(p.kunden).toEqual([]);
    expect(p.hinweise).toEqual(["Positionen gehen nur zusammen mit rechnungen.csv, sie wurden übergangen."]);
  });
  it("gleiches Kennzeichen bei zwei Kunden: der mit der jüngsten Rechnung bekommt es", () => {
    const r = RECHNUNGEN.replace("Bachstraße 3;63150;Heusenstamm;DE;;", "Bachstraße 3;63150;Heusenstamm;DE;OF-MM 1;");
    const p = planen({ rechnungen: lesen(r).zeilen });
    expect(p.kunden.find((k) => k.name === "Erika Probe")!.fahrzeuge).toEqual([]);
    expect(p.hinweise[0]).toContain("OF-MM 1");
  });
});
