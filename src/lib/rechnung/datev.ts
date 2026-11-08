import "server-only";
import { zipSync } from "fflate";
import type { Einstellungen } from "../einstellungen";
import { db } from "../supabase/admin";
import { dateiname, pdfErzeugen, type Rechnung } from "./rechnungen";

/**
 * Monatsexport für den Steuerberater: DATEV-Buchungsstapel (EXTF, Format 700) mit den Ausgangsrechnungen
 * und Zahlungseingängen des Monats, dazu alle Rechnungs-PDFs, als ZIP.
 *
 * Gebucht wird über ein Debitoren-Sammelkonto: Rechnung = Debitor an Erlöse (Automatikkonto, z. B. 8400
 * im SKR03 mit 19 %), Zahlung = Kasse bzw. Bank an Debitor. Kontonummern und Berater-/Mandantennummer
 * kommen aus den Einstellungen. Vor dem ersten echten Export einmal mit dem Steuerberater abgleichen.
 */

const zelle = (wert: string | number) => (typeof wert === "number" ? String(wert) : `"${wert.replace(/"/g, '""')}"`);
const betrag = (cent: number) => (Math.abs(cent) / 100).toFixed(2).replace(".", ",");
const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;

const SPALTEN = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
];

type Buchung = { cent: number; konto: string; gegenkonto: string; datum: string; beleg: string; text: string };

export function buchungsstapel(buchungen: Buchung[], monat: string, d: Einstellungen["automatik"]["datev"]): string {
  const [jahr, mon] = monat.split("-");
  const letzter = new Date(Date.UTC(Number(jahr), Number(mon), 0)).getUTCDate();
  const jetzt = new Date();
  const erstellt =
    jetzt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
  const kopf = [
    zelle("EXTF"), 700, 21, zelle("Buchungsstapel"), 13, erstellt, "", zelle("RE"), zelle(""), zelle(""),
    Number(d.beraterNr) || "", Number(d.mandantNr) || "", `${jahr}0101`, d.sachkontenlaenge,
    `${jahr}${mon}01`, `${jahr}${mon}${String(letzter).padStart(2, "0")}`, zelle(`Ausgangsrechnungen ${mon}/${jahr}`),
    zelle(""), 1, 0, 0, zelle("EUR"), "", zelle(""), "", "", zelle(""), zelle(""),
  ].join(";");
  const zeilen = buchungen.map((b) =>
    [
      betrag(b.cent),
      zelle(b.cent >= 0 ? "S" : "H"),
      zelle("EUR"),
      "",
      "",
      zelle(""),
      zelle(b.konto),
      zelle(b.gegenkonto),
      zelle(""),
      zelle(ddmm(b.datum)),
      zelle(b.beleg.slice(0, 36)),
      zelle(""),
      "",
      zelle(b.text.slice(0, 60)),
    ].join(";"),
  );
  // DATEV erwartet Windows-1252; Umlaute im Buchungstext sind in Latin-1 enthalten.
  return [kopf, SPALTEN.map(zelle).join(";"), ...zeilen].join("\r\n") + "\r\n";
}

export async function monatsexport(monat: string, d: Einstellungen["automatik"]["datev"]): Promise<{ zip: Buffer; anzahl: number }> {
  const von = `${monat}-01`;
  const [j, m] = monat.split("-").map(Number);
  const bis = new Date(Date.UTC(j, m, 1)).toISOString().slice(0, 10);

  const [{ data: gestellt }, { data: bezahlt }] = await Promise.all([
    db().from("rechnungen").select("*, kunde:kunden(nummer)").not("nummer", "is", null).gte("rechnungsdatum", von).lt("rechnungsdatum", bis).order("nummer"),
    db().from("rechnungen").select("*").not("bezahlt_am", "is", null).gte("bezahlt_am", von).lt("bezahlt_am", bis).order("bezahlt_am"),
  ]);

  const buchungen: Buchung[] = [];
  for (const r of (gestellt ?? []) as Rechnung[]) {
    buchungen.push({
      cent: r.summe_brutto_cent,
      konto: d.debitorSammel,
      gegenkonto: d.erloeskonto19,
      datum: r.rechnungsdatum!,
      beleg: r.nummer!,
      text: r.empfaenger?.firma || r.empfaenger?.name || "Rechnung",
    });
  }
  for (const r of (bezahlt ?? []) as Rechnung[]) {
    buchungen.push({
      cent: r.summe_brutto_cent,
      konto: r.zahlungsart === "bar" ? d.kasse : d.bank,
      gegenkonto: d.debitorSammel,
      datum: r.bezahlt_am!,
      beleg: r.nummer!,
      text: `Zahlung ${r.nummer}`,
    });
  }

  const csv = buchungsstapel(buchungen, monat, d);
  const dateien: Record<string, Uint8Array> = {
    [`EXTF_Buchungsstapel_${monat}.csv`]: new Uint8Array(Buffer.from(csv, "latin1")),
  };
  for (const r of (gestellt ?? []) as Rechnung[]) {
    dateien[`Rechnungen/${dateiname(r)}`] = new Uint8Array(await pdfErzeugen(r));
  }
  return { zip: Buffer.from(zipSync(dateien)), anzahl: (gestellt ?? []).length };
}
