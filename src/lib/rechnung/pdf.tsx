import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { datum, euro } from "../format";
import { berechne } from "./berechnung";
import { girocode } from "./girocode";
import type { RechnungsDaten } from "./zugferd";

const wurzel = process.cwd();

Font.register({
  family: "Barlow",
  fonts: [
    { src: path.join(wurzel, "src/fonts/barlow-400.ttf"), fontWeight: 400 },
    { src: path.join(wurzel, "src/fonts/barlow-600.ttf"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((wort) => [wort]);

const logo = readFileSync(path.join(wurzel, "src/assets/logo-schwarz.png"));

const tinte = "#141414";
const grau = "#6b6862";
const linie = "#d6d3cd";
const rot = "#cc0605";

const s = StyleSheet.create({
  seite: { paddingTop: 40, paddingBottom: 96, paddingHorizontal: 56, fontFamily: "Barlow", fontSize: 9.5, color: tinte, lineHeight: 1.45 },
  kopf: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 },
  logo: { width: 150 },
  firma: { fontSize: 8.5, color: grau, textAlign: "right", lineHeight: 1.5 },
  absender: { fontSize: 7, color: grau, borderBottom: `0.5pt solid ${linie}`, paddingBottom: 2, marginBottom: 6, width: 240 },
  adressblock: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  empfaenger: { width: 240, fontSize: 10 },
  info: { width: 190 },
  infoZeile: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  infoLabel: { color: grau },
  zahl: {},
  titel: { fontSize: 17, fontWeight: 600, marginBottom: 10 },
  absatz: { marginBottom: 8 },
  tabelle: { marginTop: 12, borderTop: `1.2pt solid ${tinte}` },
  kopfzeile: { flexDirection: "row", borderBottom: `0.5pt solid ${linie}`, paddingVertical: 5, color: grau, fontSize: 8 },
  zeile: { flexDirection: "row", borderBottom: `0.5pt solid ${linie}`, paddingVertical: 6 },
  pos: { width: 24 },
  text: { flex: 1, paddingRight: 8 },
  menge: { width: 64, textAlign: "right" },
  einzel: { width: 72, textAlign: "right" },
  gesamt: { width: 76, textAlign: "right" },
  summen: { marginTop: 10, marginLeft: "auto", width: 230 },
  summenZeile: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  endsumme: { flexDirection: "row", justifyContent: "space-between", borderTop: `1.2pt solid ${tinte}`, marginTop: 4, paddingTop: 5, fontWeight: 600, fontSize: 11 },
  zahlung: { marginTop: 26, flexDirection: "row", gap: 18, alignItems: "flex-start" },
  qr: { width: 74, height: 74 },
  zahlungText: { flex: 1 },
  storno: { color: rot, fontWeight: 600, marginBottom: 6 },
  fuss: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    borderTop: `0.5pt solid ${linie}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: grau,
    lineHeight: 1.45,
  },
  seitenzahl: { position: "absolute", bottom: 20, right: 56, fontSize: 7, color: grau },
});

const menge = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);

export type PdfDaten = RechnungsDaten & {
  kundennummer: number | null;
  fahrzeug: { kennzeichen?: string; modell?: string; km?: number | null };
  einleitung: string;
  fusstext: string;
  bezahlt: boolean;
};

/**
 * Das einzige Rechnungs-PDF. Admin, Kunden-Link und Mailversand rufen alle diese Funktion mit den
 * gespeicherten Daten der Rechnung auf, damit es nie zwei abweichende Fassungen derselben Rechnung gibt.
 */
export async function rechnungPdf(r: PdfDaten): Promise<Buffer> {
  const summen = berechne(r.positionen);
  const f = r.firma;
  const qr =
    !r.storno && !r.bezahlt
      ? await girocode({ name: f.name, iban: f.iban, bic: f.bic, cent: summen.brutto, zweck: `Rechnung ${r.nummer}` })
      : null;

  const dokument = (
    <Document title={`Rechnung ${r.nummer}`} author={f.name} language="de">
      <Page size="A4" style={s.seite}>
        <View style={s.kopf}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
          <Image src={logo} style={s.logo} />
          <Text style={s.firma}>
            {f.name}
            {"\n"}
            {f.strasse}
            {"\n"}
            {f.plz} {f.ort}
            {"\n"}
            {f.telefon}
            {"\n"}
            {f.email}
          </Text>
        </View>

        <View style={s.adressblock}>
          <View>
            <Text style={s.absender}>
              {f.name} · {f.strasse} · {f.plz} {f.ort}
            </Text>
            <Text style={s.empfaenger}>
              {[r.empfaenger.firma, r.empfaenger.name, r.empfaenger.strasse, [r.empfaenger.plz, r.empfaenger.ort].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join("\n")}
            </Text>
          </View>
          <View style={s.info}>
            {[
              ["Rechnungsnummer", r.nummer],
              ["Rechnungsdatum", datum(r.rechnungsdatum)],
              ["Leistungsdatum", r.leistungsdatum ? datum(r.leistungsdatum) : datum(r.rechnungsdatum)],
              ...(r.kundennummer ? [["Kundennummer", String(r.kundennummer)]] : []),
              ...(r.fahrzeug.kennzeichen ? [["Kennzeichen", r.fahrzeug.kennzeichen]] : []),
              ...(r.fahrzeug.km ? [["Kilometerstand", menge(r.fahrzeug.km)]] : []),
              ...(r.empfaenger.ust_id ? [["USt-IdNr. Kunde", r.empfaenger.ust_id]] : []),
            ].map(([label, wert]) => (
              <View key={label} style={s.infoZeile}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text>{wert}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.titel}>{r.storno ? `Stornorechnung ${r.nummer}` : `Rechnung ${r.nummer}`}</Text>
        {r.storno && r.storno_zu_nummer ? <Text style={s.storno}>Storniert Rechnung {r.storno_zu_nummer} vollständig.</Text> : null}
        {r.fahrzeug.modell ? <Text style={s.absatz}>Fahrzeug: {r.fahrzeug.modell}</Text> : null}
        {!r.storno ? <Text style={s.absatz}>{r.einleitung}</Text> : null}

        <View style={s.tabelle}>
          <View style={s.kopfzeile} fixed>
            <Text style={s.pos}>Pos.</Text>
            <Text style={s.text}>Bezeichnung</Text>
            <Text style={s.menge}>Menge</Text>
            <Text style={s.einzel}>Einzelpreis</Text>
            <Text style={s.gesamt}>Gesamt</Text>
          </View>
          {r.positionen.map((p, i) => (
            <View key={i} style={s.zeile} wrap={false}>
              <Text style={s.pos}>{i + 1}</Text>
              <Text style={s.text}>{p.text}</Text>
              <Text style={s.menge}>{`${menge(p.menge)} ${p.einheit}`}</Text>
              <Text style={[s.einzel, s.zahl]}>{euro(p.einzel_brutto_cent)}</Text>
              <Text style={[s.gesamt, s.zahl]}>{euro(summen.zeilenBrutto[i])}</Text>
            </View>
          ))}
        </View>

        <View style={s.summen} wrap={false}>
          <View style={s.summenZeile}>
            <Text style={s.infoLabel}>Summe netto</Text>
            <Text style={s.zahl}>{euro(summen.netto)}</Text>
          </View>
          {summen.gruppen.map((g) => (
            <View key={g.satz} style={s.summenZeile}>
              <Text style={s.infoLabel}>
                MwSt. {menge(g.satz)} % auf {euro(g.netto)}
              </Text>
              <Text style={s.zahl}>{euro(g.steuer)}</Text>
            </View>
          ))}
          <View style={s.endsumme}>
            <Text>Gesamtbetrag</Text>
            <Text style={s.zahl}>{euro(summen.brutto)}</Text>
          </View>
        </View>

        <View style={s.zahlung} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
          {qr ? <Image src={qr} style={s.qr} /> : null}
          <View style={s.zahlungText}>
            {r.storno ? (
              <Text>Der Betrag wird Ihnen erstattet bzw. mit offenen Forderungen verrechnet.</Text>
            ) : r.bezahlt ? (
              <Text>Der Betrag wurde bereits bezahlt. Vielen Dank.</Text>
            ) : (
              <>
                <Text>
                  {`Bitte überweisen Sie den Betrag ${r.faellig_am ? `bis zum ${datum(r.faellig_am)} ` : ""}unter Angabe der Rechnungsnummer${
                    f.iban ? ` auf das Konto ${f.iban}${f.bic ? ` (BIC ${f.bic})` : ""}${f.bank ? ` bei der ${f.bank}` : ""}` : ""
                  }. Barzahlung in der Werkstatt ist ebenfalls möglich.`}
                </Text>
                {qr ? <Text style={{ color: grau, marginTop: 4 }}>Mit der Banking-App den Code scannen, alle Angaben sind ausgefüllt.</Text> : null}
              </>
            )}
            {r.hinweis ? <Text style={{ marginTop: 8 }}>{r.hinweis}</Text> : null}
            {r.fusstext ? <Text style={{ marginTop: 8, color: grau }}>{r.fusstext}</Text> : null}
          </View>
        </View>

        <View style={s.fuss} fixed>
          <Text>
            {f.name}
            {"\n"}Inhaber: {f.inhaber}, {f.titel}
            {"\n"}
            {f.strasse}, {f.plz} {f.ort}
          </Text>
          <Text>
            Telefon {f.telefon}
            {"\n"}
            {f.email}
            {"\n"}
            {f.ustId ? `USt-IdNr. ${f.ustId}` : f.steuernummer ? `Steuernummer ${f.steuernummer}` : ""}
          </Text>
          <Text>
            {f.bank}
            {"\n"}
            {f.iban ? `IBAN ${f.iban}` : ""}
            {"\n"}
            {f.bic ? `BIC ${f.bic}` : ""}
          </Text>
        </View>
        <Text style={s.seitenzahl} render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Seite ${pageNumber} von ${totalPages}` : "")} fixed />
      </Page>
    </Document>
  );

  return renderToBuffer(dokument);
}
