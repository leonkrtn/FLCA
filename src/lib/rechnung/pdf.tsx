import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import logoMasse from "@/assets/logo-pfade.json";
import { datum, euro, euroGenau } from "../format";
import { fahrzeugText } from "./aehnlich";
import { berechne, einzelpreisAnzeige, rabattText, zeilenbetrag } from "./berechnung";
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

// Schwarzes PNG des Logos (aus logo-pfade.json gerendert, 1200 px breit, damit es im Druck scharf bleibt).
const logo = readFileSync(path.join(wurzel, "src/assets/logo-schwarz.png"));
const logoBreite = 104;

const tinte = "#141414";
const grau = "#6b6862";
const linie = "#d6d3cd";
const rot = "#cc0605";

const s = StyleSheet.create({
  seite: { paddingTop: 40, paddingBottom: 96, paddingHorizontal: 56, fontFamily: "Barlow", fontSize: 9.5, color: tinte, lineHeight: 1.45 },
  kopf: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 },
  logo: { width: logoBreite, height: (logoBreite * logoMasse.hoehe) / logoMasse.breite },
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
  vermerk: { fontWeight: 600, marginBottom: 8 },
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
  zwischentitel: { fontWeight: 600, marginBottom: 4 },
  annahmeZeile: { flexDirection: "row", borderBottom: `0.5pt solid ${linie}`, paddingVertical: 3 },
  annahmeLabel: { width: 110, color: grau },
  unterschriften: { flexDirection: "row", gap: 40, marginTop: 16 },
  unterschriftFeld: { flex: 1 },
  unterschriftFlaeche: { height: 36, justifyContent: "flex-end", borderBottom: `0.8pt solid ${tinte}`, paddingBottom: 2 },
  unterschriftBild: { height: 32, objectFit: "contain", objectPosition: "left bottom" },
  unterschriftText: { fontSize: 7.5, color: grau, marginTop: 3 },
});

const menge = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);

export type PdfDaten = RechnungsDaten & {
  /**
   * Dasselbe Layout dient auch dem Kostenvoranschlag (anderer Titel, Gültigkeit statt Zahlungsteil) und dem
   * Werkstattauftrag (Termin, Beanstandung, Fahrzeugannahme, Kostengrenze und Unterschrift statt Zahlungsteil).
   */
  art?: "rechnung" | "kostenvoranschlag" | "auftrag";
  auftrag?: {
    termin: string;
    telefon: string;
    beschreibung: string;
    kostengrenze_cent: number | null;
    annahme: [string, string][];
    /** „Erteilt am … per …“, leer = noch nicht erteilt (dann Linien zum Unterschreiben auf Papier) */
    erteilt: string;
    ortDatum: string;
    name: string;
    /** PNG als data:-URL */
    unterschrift: string | null;
  };
  gueltig_bis?: string | null;
  kundennummer: number | null;
  fahrzeug: { kennzeichen?: string; marke?: string; modell?: string; km?: number | null };
  einleitung: string;
  fusstext: string;
  bezahlt: boolean;
  /** Korrektur: Grund und die Stornorechnung des ersetzten Originals */
  korrektur_grund?: string;
  storno_des_originals?: string | null;
  /** Storniertes Original: durch welche Stornorechnung, ersetzt durch welche Fassung */
  storniert?: { durch: string | null; ersetzt: string | null } | null;
};

/**
 * Das einzige Rechnungs-PDF (und mit art „kostenvoranschlag“ das des Kostenvoranschlags). Admin, Kunden-Link und Mailversand rufen alle diese Funktion mit den
 * gespeicherten Daten der Rechnung auf, damit es nie zwei abweichende Fassungen derselben Rechnung gibt.
 */
export async function rechnungPdf(r: PdfDaten): Promise<Buffer> {
  const summen = berechne(r.positionen);
  const netto = summen.preisart === "netto";
  // Rabattzeilen bekommen keine Positionsnummer, die Nummern laufen ohne Lücke weiter.
  const nummern: number[] = [];
  r.positionen.reduce((n, p, i) => {
    nummern[i] = n;
    return p.rabatt ? n : n + 1;
  }, 0);
  const f = r.firma;
  const kv = r.art === "kostenvoranschlag";
  const wa = r.art === "auftrag" ? r.auftrag : undefined;
  const titel = wa ? `Werkstattauftrag ${r.nummer}` : kv ? `Kostenvoranschlag ${r.nummer}` : r.storno ? `Stornorechnung ${r.nummer}` : `Rechnung ${r.nummer}`;
  // Korrektur: Schon Gezahltes wird abgezogen; offen < 0 heißt, es wird erstattet.
  const bereits = r.storno ? 0 : (r.bereits_bezahlt_cent ?? 0);
  const offen = summen.brutto - bereits;
  // Kein Zahlungsaufruf auf einer stornierten Rechnung, sonst überweist der Kunde ein ungültiges Original.
  const qr =
    !kv && !wa && !r.storno && !r.bezahlt && !r.storniert && offen > 0
      ? await girocode({ name: f.name, iban: f.iban, bic: f.bic, cent: offen, zweck: `Rechnung ${r.nummer}` })
      : null;

  const dokument = (
    <Document title={titel} author={f.name} language="de">
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
              ...(wa
                ? [
                    ["Auftragsnummer", r.nummer],
                    ["Datum", datum(r.rechnungsdatum)],
                    ["Termin", wa.termin],
                    ...(wa.telefon ? [["Telefon", wa.telefon]] : []),
                  ]
                : kv
                ? [
                    ["Nummer", r.nummer],
                    ["Datum", datum(r.rechnungsdatum)],
                    ...(r.gueltig_bis ? [["Gültig bis", datum(r.gueltig_bis)]] : []),
                  ]
                : [
                    ["Rechnungsnummer", r.nummer],
                    ["Rechnungsdatum", datum(r.rechnungsdatum)],
                    ["Leistungsdatum", r.leistungsdatum ? datum(r.leistungsdatum) : datum(r.rechnungsdatum)],
                  ]),
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

        <Text style={s.titel}>{titel}</Text>
        {r.storno && r.storno_zu_nummer ? <Text style={s.storno}>Storniert Rechnung {r.storno_zu_nummer} vollständig.</Text> : null}
        {r.storniert ? (
          <Text style={s.storno}>
            {`Storniert${r.storniert.durch ? ` durch Stornorechnung ${r.storniert.durch}` : ""}.${r.storniert.ersetzt ? ` Ersetzt durch die berichtigte Rechnung ${r.storniert.ersetzt}.` : ""}`}
          </Text>
        ) : null}
        {!r.storno && r.korrektur_zu ? (
          <Text style={s.vermerk}>
            {`Berichtigte Rechnung. Sie ersetzt Rechnung ${r.korrektur_zu.nummer}${r.korrektur_zu.datum ? ` vom ${datum(r.korrektur_zu.datum)}` : ""}${
              r.storno_des_originals ? `, storniert durch ${r.storno_des_originals}` : ""
            }.${r.korrektur_grund ? ` Grund: ${r.korrektur_grund}.` : ""}`}
          </Text>
        ) : null}
        {fahrzeugText(r.fahrzeug) ? <Text style={s.absatz}>Fahrzeug: {fahrzeugText(r.fahrzeug)}</Text> : null}
        {!r.storno ? <Text style={s.absatz}>{r.einleitung}</Text> : null}
        {wa?.beschreibung ? <Text style={s.absatz}>{`Auftrag / Beanstandung des Kunden: ${wa.beschreibung}`}</Text> : null}

        <View style={s.tabelle}>
          <View style={s.kopfzeile} fixed>
            <Text style={s.pos}>Pos.</Text>
            <Text style={s.text}>Bezeichnung</Text>
            <Text style={s.menge}>Menge</Text>
            <Text style={s.einzel}>{netto ? "Einzel netto" : "Einzelpreis"}</Text>
            <Text style={s.gesamt}>{netto ? "Gesamt netto" : "Gesamt"}</Text>
          </View>
          {r.positionen.map((p, i) =>
            p.rabatt ? (
              <View key={i} style={s.zeile} wrap={false}>
                <Text style={s.pos} />
                <Text style={s.text}>{rabattText(p)}</Text>
                <Text style={s.menge} />
                <Text style={s.einzel} />
                <Text style={[s.gesamt, s.zahl]}>{euro(summen.zeilenNetto[i])}</Text>
              </View>
            ) : (
              <View key={i} style={s.zeile} wrap={false}>
                <Text style={s.pos}>{(nummern[i] ?? 0) + 1}</Text>
                <Text style={s.text}>
                  {p.text}
                  {/* Lohn: Stunden × Satz, die Lohnart klein darunter */}
                  {p.einheit === "Std" && p.lohnart ? <Text style={{ color: grau }}>{`\nArbeitslohn ${p.lohnart}`}</Text> : null}
                </Text>
                <Text style={s.menge}>{`${menge(p.menge)} ${p.einheit}`}</Text>
                <Text style={[s.einzel, s.zahl]}>{euroGenau(einzelpreisAnzeige(p, summen, i))}</Text>
                <Text style={[s.gesamt, s.zahl]}>{euro(zeilenbetrag(summen, i))}</Text>
              </View>
            ),
          )}
        </View>

        <View style={s.summen} wrap={false}>
          {summen.rabatt ? (
            <>
              <View style={s.summenZeile}>
                <Text style={s.infoLabel}>Summe Positionen</Text>
                <Text style={s.zahl}>{euro(summen.basis)}</Text>
              </View>
              <View style={s.summenZeile}>
                <Text style={s.infoLabel}>Rabatt</Text>
                <Text style={s.zahl}>{euro(-summen.rabatt)}</Text>
              </View>
            </>
          ) : null}
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
            <Text>{wa ? "Voraussichtlich gesamt" : "Gesamtbetrag"}</Text>
            <Text style={s.zahl}>{euro(summen.brutto)}</Text>
          </View>
          {bereits ? (
            <>
              <View style={s.summenZeile}>
                <Text style={s.infoLabel}>Bereits bezahlt{r.korrektur_zu ? ` (Rechnung ${r.korrektur_zu.nummer})` : ""}</Text>
                <Text style={s.zahl}>{euro(-bereits)}</Text>
              </View>
              <View style={s.endsumme}>
                <Text>{offen < 0 ? "Wird erstattet" : "Noch zu zahlen"}</Text>
                <Text style={s.zahl}>{euro(Math.abs(offen))}</Text>
              </View>
            </>
          ) : null}
        </View>

        {wa ? (
          <View style={{ marginTop: 16 }}>
            <Text>
              {wa.kostengrenze_cent != null
                ? `Kostengrenze: Arbeiten bis ${euro(wa.kostengrenze_cent)} brutto sind freigegeben. Was darüber hinausgeht, besprechen wir vorher mit Ihnen.`
                : "Die Beträge sind voraussichtlich. Berechnet wird, was tatsächlich gemacht wurde."}
            </Text>
            {wa.annahme.length ? (
              <View style={{ marginTop: 10 }} wrap={false}>
                <Text style={s.zwischentitel}>Fahrzeugannahme</Text>
                {wa.annahme.map(([label, wert]) => (
                  <View key={label} style={s.annahmeZeile}>
                    <Text style={s.annahmeLabel}>{label}</Text>
                    <Text style={{ flex: 1 }}>{wert}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {r.fusstext ? <Text style={{ marginTop: 8, color: grau }}>{r.fusstext}</Text> : null}
            {/* Unterschrift und Vermerk bleiben zusammen, damit die Unterschrift nie allein auf einer Seite steht */}
            <View wrap={false}>
            <View style={s.unterschriften}>
              <View style={s.unterschriftFeld}>
                <View style={s.unterschriftFlaeche}>
                  <Text>{wa.ortDatum}</Text>
                </View>
                <Text style={s.unterschriftText}>Ort, Datum</Text>
              </View>
              <View style={s.unterschriftFeld}>
                <View style={s.unterschriftFlaeche}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
                  {wa.unterschrift ? <Image src={wa.unterschrift} style={s.unterschriftBild} /> : null}
                </View>
                <Text style={s.unterschriftText}>Unterschrift Auftraggeber{wa.name ? ` (${wa.name})` : ""}</Text>
              </View>
            </View>
            {wa.erteilt ? <Text style={{ marginTop: 4, color: grau }}>{wa.erteilt}.</Text> : null}
            </View>
          </View>
        ) : (
        <View style={s.zahlung} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf kennt kein alt */}
          {qr ? <Image src={qr} style={s.qr} /> : null}
          <View style={s.zahlungText}>
            {kv ? (
              <Text>
                {`${r.gueltig_bis ? `Dieser Kostenvoranschlag gilt bis zum ${datum(r.gueltig_bis)}. ` : ""}Sie können ihn über den Link in unserer E-Mail annehmen oder uns einfach anrufen${f.telefon ? ` (${f.telefon})` : ""}.`}
              </Text>
            ) : r.storno ? (
              <Text>Der Betrag wird Ihnen erstattet bzw. mit offenen Forderungen verrechnet.</Text>
            ) : r.storniert ? (
              <Text>Diese Rechnung ist storniert und muss nicht mehr bezahlt werden.{r.storniert.ersetzt ? ` Es gilt die Rechnung ${r.storniert.ersetzt}.` : ""}</Text>
            ) : bereits && offen < 0 ? (
              <Text>{`Sie haben ${euro(bereits)} bezahlt. Den Unterschied von ${euro(-offen)} erstatten wir Ihnen bzw. verrechnen ihn mit offenen Forderungen.`}</Text>
            ) : r.bezahlt || (bereits && offen === 0) ? (
              <Text>Der Betrag wurde bereits bezahlt. Vielen Dank.</Text>
            ) : (
              <>
                <Text>
                  {`Bitte überweisen Sie ${bereits ? `den offenen Betrag von ${euro(offen)}` : "den Betrag"} ${r.faellig_am ? `bis zum ${datum(r.faellig_am)} ` : ""}unter Angabe der Rechnungsnummer${
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
        )}

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
