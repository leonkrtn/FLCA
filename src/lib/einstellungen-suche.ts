/**
 * Suche in den Einstellungen: findet ein einzelnes Feld über seinen Namen, Alltagswörter, ganze Fragen
 * („Wie ändere ich die Mail an den Steuerberater?“), Tippfehler und auch über den gespeicherten Wert.
 *
 * Feste Regeln, kein KI-Dienst, ohne Datenbank: Das Verzeichnis baut der Server aus den Einstellungen, gesucht
 * wird im Browser bei jedem Tastendruck. Deshalb nur Typ-Importe, sonst landet Servercode im Browser.
 */
import { klein } from "./sprache/text";
import { MAIL_VORLAGEN } from "./email/texte";
import type { Einstellungen } from "./einstellungen";

/** Reiter der Einstellungsseite, in dieser Reihenfolge. */
export const BEREICHE = [
  ["firma", "Firma"],
  ["zeiten", "Öffnungszeiten"],
  ["buchung", "Terminvergabe"],
  ["rechnung", "Rechnungen"],
  ["preise", "Gemerkte Preise"],
  ["automatik", "Automatik"],
  ["benachrichtigung", "Benachrichtigungen"],
  ["mail", "E-Mail"],
  ["mailtexte", "Mailtexte"],
  ["whatsapp", "WhatsApp-Texte"],
  ["module", "Module"],
  ["schnittstellen", "Schnittstellen"],
  ["recht", "Rechtstexte"],
  ["uebernahme", "Datenübernahme"],
  ["archiv", "Archiv"],
  ["fehler", "Fehler"],
] as const;

export type Bereich = (typeof BEREICHE)[number][0];

export type SuchEintrag = {
  bereich: Bereich;
  bereichTitel: string;
  /** Beschriftung wie auf der Seite */
  titel: string;
  /** Kasten oder Gruppe innerhalb des Reiters, falls es mehrere gibt */
  abschnitt?: string;
  /** Wohin gescrollt wird: `name` des Eingabefelds oder `#id` eines Kastens. Ohne Ziel: Anfang des Reiters. */
  ziel?: string;
  hilfe?: string;
  /** Alltagswörter und andere Bezeichnungen, unter denen man das Feld sucht */
  woerter?: string[];
  /** Ein Häkchen: „ausschalten“, „aktivieren“ in der Frage passen besonders. */
  schalter?: boolean;
  /** Gespeicherter Inhalt, damit man auch nach dem Wert suchen kann */
  wert?: string;
};

export type SuchTreffer = { eintrag: SuchEintrag; punkte: number; imWert?: string };

type Quelle = {
  e: Einstellungen;
  /** WhatsApp-Vorlagen mit dem geltenden Text (gespeichert oder Standard) */
  whatsapp: { schluessel: string; titel: string; wann: string; text: string }[];
};

const titelVon = (b: Bereich) => BEREICHE.find(([k]) => k === b)![1];
const zahl = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Alle auffindbaren Einstellungen. Neue Felder auf der Einstellungsseite hier mit eintragen. */
export function einstellungenVerzeichnis({ e, whatsapp }: Quelle): SuchEintrag[] {
  const liste: SuchEintrag[] = [];
  const add = (bereich: Bereich, eintraege: Omit<SuchEintrag, "bereich" | "bereichTitel">[]) => {
    for (const x of eintraege) liste.push({ bereich, bereichTitel: titelVon(bereich), ...x });
  };

  const adresse = ["adresse", "anschrift", "standort", "impressum"];
  const bankverbindung = ["bankverbindung", "konto", "überweisung", "rechnung"];
  add("firma", [
    { titel: "Firmenname", ziel: "name", wert: e.firma.name, woerter: ["firma", "unternehmen", "betrieb", "werkstatt", "impressum"] },
    { titel: "Inhaber", ziel: "inhaber", wert: e.firma.inhaber, woerter: ["chef", "besitzer", "eigentümer", "geschäftsführer", "impressum"] },
    { titel: "Berufsbezeichnung", ziel: "titel", wert: e.firma.titel, woerter: ["beruf", "meistertitel", "meister", "impressum"] },
    { titel: "Rechtsform", ziel: "rechtsform", wert: e.firma.rechtsform, woerter: ["gmbh", "einzelunternehmen", "firmenform", "impressum"] },
    { titel: "Zuständige Kammer", ziel: "kammer", wert: e.firma.kammer, woerter: ["handwerkskammer", "hwk", "ihk", "impressum"] },
    { titel: "Straße", ziel: "strasse", wert: e.firma.strasse, woerter: [...adresse, "hausnummer"] },
    { titel: "PLZ", ziel: "plz", wert: e.firma.plz, woerter: [...adresse, "postleitzahl"] },
    { titel: "Ort", ziel: "ort", wert: e.firma.ort, woerter: [...adresse, "stadt"] },
    { titel: "Telefon", ziel: "telefon", wert: e.firma.telefon, woerter: ["telefonnummer", "rufnummer", "nummer", "handy", "mobil", "festnetz", "anrufen", "kontakt"] },
    { titel: "WhatsApp-Nummer", ziel: "whatsapp", wert: e.firma.whatsapp, woerter: ["whatsapp", "messenger", "handy", "nummer", "kontakt"] },
    { titel: "E-Mail", ziel: "email", wert: e.firma.email, woerter: ["mail", "emailadresse", "mailadresse", "kontakt", "absender"] },
    { titel: "Instagram-Name", ziel: "instagram", wert: e.firma.instagram, woerter: ["insta", "social", "media"] },
    { titel: "Steuernummer", ziel: "steuernummer", wert: e.firma.steuernummer, woerter: ["steuer", "finanzamt", "stnr", "rechnung"] },
    { titel: "USt-IdNr.", ziel: "ustId", wert: e.firma.ustId, woerter: ["umsatzsteuer", "ust", "ustid", "mwst", "mehrwertsteuer", "identifikationsnummer", "vat"] },
    { titel: "IBAN", ziel: "iban", wert: e.firma.iban, woerter: [...bankverbindung, "kontonummer"] },
    { titel: "BIC", ziel: "bic", wert: e.firma.bic, woerter: [...bankverbindung, "swift"] },
    { titel: "Bank", ziel: "bank", wert: e.firma.bank, woerter: [...bankverbindung, "kreditinstitut", "sparkasse", "volksbank"] },
    { titel: "Link zu den Google-Bewertungen", ziel: "googleBewertungLink", wert: e.firma.googleBewertungLink, woerter: ["google", "bewertung", "rezension", "review", "maps"] },
    { titel: "Google-Note", ziel: "googleNote", wert: e.firma.googleNote, woerter: ["google", "bewertung", "sterne", "rating", "durchschnitt"] },
    { titel: "Anzahl Google-Bewertungen", ziel: "googleAnzahl", wert: e.firma.googleAnzahl, woerter: ["google", "bewertung", "rezensionen", "anzahl"] },
    { titel: "Hinweis zur Anfahrt", ziel: "hinweisAnfahrt", wert: e.firma.hinweisAnfahrt, woerter: ["anfahrt", "wegbeschreibung", "weg", "einfahrt", "eingang", "tor", "parken", "anreise"] },
  ]);

  const zeiten = ["öffnungszeiten", "geöffnet", "offen", "geschlossen", "ruhetag", "mittagspause", "pause", "uhrzeit", "arbeitszeit"];
  const tage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  add("zeiten", [
    { titel: "Öffnungszeiten", ziel: "t1_1_von", hilfe: "Grundlage für freie Termine", woerter: [...zeiten, "wochentage", "termine"] },
    ...tage.map((tag, i) => {
      const f = e.oeffnungszeiten[String(i + 1) as "1"] ?? [];
      return {
        titel: tag,
        abschnitt: "Öffnungszeiten",
        ziel: `t${i + 1}_1_von`,
        wert: f.length ? f.map(([von, bis]) => `${von}–${bis}`).join(", ") : "geschlossen",
        woerter: [...zeiten, ...(i >= 5 ? ["wochenende"] : [])],
      };
    }),
  ]);

  const buchung = ["termin", "terminanfrage", "anfrage", "buchung", "online"];
  add("buchung", [
    { titel: "Online-Anfragen annehmen", ziel: "aktiv", schalter: true, hilfe: "Aus = die Seite zeigt nur Telefon und WhatsApp.", woerter: [...buchung, "terminbuchung", "buchen", "website", "urlaub", "pausieren"] },
    { titel: "Fahrzeuge gleichzeitig", ziel: "kapazitaet", wert: zahl(e.buchung.kapazitaet), hilfe: "Hebebühnen und Plätze, die parallel arbeiten", woerter: [...buchung, "kapazität", "hebebühne", "bühne", "arbeitsplätze", "plätze", "parallel", "autos"] },
    { titel: "Puffer nach jedem Termin (Min.)", ziel: "pufferMin", wert: zahl(e.buchung.pufferMin), woerter: [...buchung, "abstand", "luft", "pause", "zwischen", "minuten"] },
    { titel: "Raster der Startzeiten", ziel: "rasterMin", woerter: [...buchung, "takt", "intervall", "startzeit", "zeitraster", "uhrzeiten", "slots", "viertelstunde"] },
    { titel: "Frühestens (Stunden vorher)", ziel: "vorlaufStd", wert: zahl(e.buchung.vorlaufStd), woerter: [...buchung, "vorlauf", "kurzfristig", "spontan", "mindestens", "stunden"] },
    { titel: "Höchstens (Tage im Voraus)", ziel: "maxTage", wert: zahl(e.buchung.maxTage), woerter: [...buchung, "voraus", "vorausbuchen", "langfristig", "zukunft", "tage"] },
    { titel: "Anfrage hält den Termin (Stunden)", ziel: "haltenStd", wert: zahl(e.buchung.haltenStd), woerter: [...buchung, "reservieren", "reservierung", "blocken", "freihalten", "unbestätigt", "verfall"] },
    { titel: "Kunde kann online absagen bis (Std. vorher)", ziel: "stornoFristStd", wert: zahl(e.buchung.stornoFristStd), woerter: [...buchung, "storno", "stornieren", "stornofrist", "absage", "absagefrist", "kündigen"] },
  ]);

  const nk = ["rechnungsnummer", "nummer", "nummernkreis", "fortlaufend"];
  const lohn = ["stundensatz", "stundensätze", "stundenlohn", "stundenverrechnungssatz", "lohn", "arbeitslohn", "arbeitswert", "lohnart", "mechanik", "elektrik", "preis", "netto"];
  add("rechnung", [
    { titel: "Nummernkreis", ziel: "#nummernkreis", woerter: nk },
    { titel: "Präfix", abschnitt: "Nummernkreis", ziel: "praefix", woerter: [...nk, "vorsilbe", "kürzel", "re"] },
    { titel: "Nächste Nummer", abschnitt: "Nummernkreis", ziel: "naechste", woerter: [...nk, "startnummer", "beginnen", "weiterzählen"] },
    { titel: "Stellen", abschnitt: "Nummernkreis", ziel: "stellen", woerter: [...nk, "ziffern", "länge", "nullen"] },
    { titel: "Jahr in der Nummer", abschnitt: "Nummernkreis", ziel: "mit_jahr", schalter: true, woerter: [...nk, "jahreszahl"] },
    { titel: "Zahlungsziel (Tage)", abschnitt: "Rechnungen", ziel: "zahlungszielTage", wert: zahl(e.rechnung.zahlungszielTage), woerter: ["zahlungsfrist", "frist", "fällig", "fälligkeit", "zahlbar", "bezahlen", "tage"] },
    { titel: "Einleitungssatz", abschnitt: "Rechnungen", ziel: "einleitung", wert: e.rechnung.einleitung, woerter: ["rechnung", "rechnungstext", "anschreiben", "text", "oben", "einleitung"] },
    { titel: "Fußtext", abschnitt: "Rechnungen", ziel: "fusstext", wert: e.rechnung.fusstext, woerter: ["rechnung", "rechnungstext", "fußzeile", "text", "unten", "schluss", "dank"] },
    { titel: "Stundensätze und Teile", abschnitt: "Rechnungen", ziel: "lohn_name_0", wert: e.rechnung.stundensaetze.map((s) => s.name).join(", "), woerter: lohn },
    { titel: "Aufschlag auf Teile-Einkauf (%)", abschnitt: "Stundensätze und Teile", ziel: "aufschlagProzent", wert: zahl(e.rechnung.aufschlagProzent), woerter: ["aufschlag", "marge", "gewinn", "kalkulation", "ersatzteile", "teile", "einkauf", "einkaufspreis", "ek", "prozent"] },
    { titel: "Gültig (Tage)", abschnitt: "Kostenvoranschläge", ziel: "kv_gueltigTage", wert: zahl(e.kostenvoranschlag.gueltigTage), woerter: ["kostenvoranschlag", "kv", "angebot", "gültigkeit", "frist", "tage"] },
    { titel: "Einleitungssatz", abschnitt: "Kostenvoranschläge", ziel: "kv_einleitung", wert: e.kostenvoranschlag.einleitung, woerter: ["kostenvoranschlag", "kv", "angebot", "text", "oben", "einleitung"] },
    { titel: "Fußtext", abschnitt: "Kostenvoranschläge", ziel: "kv_fusstext", wert: e.kostenvoranschlag.fusstext, woerter: ["kostenvoranschlag", "kv", "angebot", "fußzeile", "text", "unten"] },
    { titel: "Einleitungssatz", abschnitt: "Werkstattaufträge", ziel: "wa_einleitung", wert: e.auftrag.einleitung, woerter: ["werkstattauftrag", "auftrag", "wa", "text", "oben", "einleitung"] },
    { titel: "Bedingungen (Fußtext)", abschnitt: "Werkstattaufträge", ziel: "wa_fusstext", wert: e.auftrag.fusstext, hilfe: "Steht über der Unterschrift des Kunden.", woerter: ["werkstattauftrag", "auftrag", "wa", "unterschrift", "haftung", "agb", "fußtext", "text", "unten"] },
    { titel: "Frühere Rechnungen", ziel: "#fruehere-rechnungen", woerter: ["alte", "rechnungen", "archiv", "altbestand", "übernommen"] },
  ]);

  add("preise", [
    { titel: "Gemerkte Preise", ziel: "q", woerter: ["preisgedächtnis", "preise", "merken", "teilepreise", "pakete", "marke", "modell", "positionen"] },
  ]);

  const datev = ["datev", "steuerberater", "buchhaltung", "export", "monatsabschluss"];
  add("automatik", [
    { titel: "Erinnerung 24 Stunden vor dem Termin", ziel: "erinnerung", schalter: true, hilfe: "Mail an den Kunden mit Anfahrt und Absagelink", woerter: ["erinnerung", "terminerinnerung", "reminder", "mail", "vorher", "automatisch"] },
    { titel: "Nach dem Termin um eine Google-Bewertung bitten", ziel: "bewertung", schalter: true, woerter: ["bewertung", "google", "rezension", "review", "sterne", "mail", "automatisch"] },
    { titel: "Stunden nach dem Termin", abschnitt: "Google-Bewertung", ziel: "stundenNach", wert: zahl(e.automatik.bewertung.stundenNach), woerter: ["bewertung", "verzögerung", "später", "stunden"] },
    { titel: "Reifen-Saison-Mail an Kunden mit eingelagerten Rädern", ziel: "saison", schalter: true, woerter: ["reifen", "reifenwechsel", "radwechsel", "räder", "winterreifen", "sommerreifen", "einlagerung", "saison", "mail"] },
    { titel: "Frühjahr (MM-TT)", abschnitt: "Reifen-Saison-Mail", ziel: "fruehjahr", wert: e.automatik.saison.fruehjahr, woerter: ["sommerreifen", "saison", "datum", "reifen"] },
    { titel: "Herbst (MM-TT)", abschnitt: "Reifen-Saison-Mail", ziel: "herbst", wert: e.automatik.saison.herbst, woerter: ["winterreifen", "saison", "datum", "reifen"] },
    { titel: "DATEV-Export an den Steuerberater senden", ziel: "datev", schalter: true, woerter: [...datev, "monatlich", "automatisch"] },
    { titel: "E-Mail Steuerberater", abschnitt: "DATEV", ziel: "datev_email", wert: e.automatik.datev.email, woerter: [...datev, "mail", "steuerbüro", "buchhalter", "adresse"] },
    { titel: "Beraternummer", abschnitt: "DATEV", ziel: "beraterNr", wert: e.automatik.datev.beraterNr, woerter: [...datev, "berater"] },
    { titel: "Mandantennummer", abschnitt: "DATEV", ziel: "mandantNr", wert: e.automatik.datev.mandantNr, woerter: [...datev, "mandant"] },
    { titel: "Sachkontenlänge", abschnitt: "DATEV", ziel: "sachkontenlaenge", wert: zahl(e.automatik.datev.sachkontenlaenge), woerter: [...datev, "konto", "stellen"] },
    { titel: "Erlöskonto 19 %", abschnitt: "DATEV", ziel: "erloeskonto19", wert: e.automatik.datev.erloeskonto19, hilfe: "SKR03: 8400, SKR04: 4400", woerter: [...datev, "erlöse", "umsatz", "konto", "skr03", "skr04"] },
    { titel: "Debitoren-Sammelkonto", abschnitt: "DATEV", ziel: "debitorSammel", wert: e.automatik.datev.debitorSammel, woerter: [...datev, "debitoren", "kunden", "konto", "sammelkonto"] },
    { titel: "Kasse", abschnitt: "DATEV", ziel: "kasse", wert: e.automatik.datev.kasse, woerter: [...datev, "kassenkonto", "bar", "barzahlung", "konto"] },
    { titel: "Bank", abschnitt: "DATEV", ziel: "bank", wert: e.automatik.datev.bank, woerter: [...datev, "bankkonto", "konto", "überweisung"] },
  ]);

  add("benachrichtigung", [
    {
      titel: "E-Mail-Adressen für neue Anfragen und Bewerbungen",
      ziel: "emails",
      wert: e.benachrichtigung.emails.join(", "),
      woerter: ["benachrichtigung", "empfänger", "mail", "hinweis", "nachricht", "anfrage", "terminanfrage", "bewerbung", "push", "informieren"],
    },
  ]);

  const mail = ["mail", "e-mail", "email", "postfach", "outlook"];
  add("mail", [
    { titel: "Einrichtung prüfen und Testmail", ziel: "#einrichtung", woerter: [...mail, "resend", "webhook", "mx", "dns", "empfang", "test", "funktioniert"] },
    { titel: "Name im Absender", ziel: "absenderName", wert: e.mail.absenderName, woerter: [...mail, "absender", "von", "name"] },
    { titel: "Standardadresse", ziel: "standardAdresse", wert: e.mail.standardAdresse, woerter: [...mail, "absender", "adresse", "service", "info", "von"] },
    { titel: "Adressen des Firmenpostfachs", ziel: "firmenAdressen", wert: e.mail.firmenAdressen.join(", "), woerter: [...mail, "info", "service", "termine", "sonstige", "weiterleitung", "alias"] },
    { titel: "Wer sieht das Firmenpostfach, Push bei neuer Mail", ziel: "#zugriff", woerter: [...mail, "zugriff", "rechte", "push", "benachrichtigung", "firmenpostfach"] },
    { titel: "Signatur", ziel: "#signatur", wert: e.mail.signatur.gruss, woerter: [...mail, "signatur", "grußformel", "logo", "fußzeile", "unterschrift"] },
    { titel: "Mailadressen, Jobbezeichnung und Telefon der Personen", ziel: "#personen", woerter: [...mail, "mitarbeiter", "adresse", "jobbezeichnung", "position", "signatur", "telefon"] },
    { titel: "Kategorien", ziel: "#kategorien", woerter: [...mail, "kategorie", "farbe", "ordnen", "label"] },
    { titel: "Textbausteine", ziel: "#vorlagen", wert: e.mail.vorlagen.map((v) => v.name).join(", "), woerter: [...mail, "vorlage", "textbaustein", "baustein", "schnellbaustein"] },
  ]);

  add("mailtexte", [
    ...MAIL_VORLAGEN.map((v) => ({
      titel: `Mail: ${v.titel}`,
      abschnitt: v.gruppe,
      ziel: `${v.schluessel}.betreff`,
      hilfe: `Wann: ${v.wann}`,
      wert: [e.mailTexte.vorlagen[v.schluessel]?.betreff, e.mailTexte.vorlagen[v.schluessel]?.text].filter(Boolean).join(" "),
      woerter: ["mail", "e-mail", "text", "betreff", "vorlage", "automatisch", "kunde", v.gruppe.toLowerCase()],
    })),
  ]);

  add(
    "whatsapp",
    whatsapp.map((v) => ({ titel: v.titel, ziel: v.schluessel, hilfe: `Wann: ${v.wann}`, wert: v.text, woerter: ["whatsapp", "nachricht", "text", "vorlage", "kunde", "schreiben"] })),
  );

  const modul = ["modul", "funktion", "anzeigen", "website", "menü"];
  add("module", [
    { titel: "Karriere", ziel: "karriere", schalter: true, hilfe: "Stellenanzeigen und Bewerbungen", woerter: [...modul, "jobs", "stellen", "stellenanzeigen", "bewerbung", "jobangebote"] },
    { titel: "Rädereinlagerung", ziel: "einlagerung", schalter: true, woerter: [...modul, "einlagerung", "reifen", "räder", "reifenhotel", "lager"] },
    { titel: "Zeiterfassung", ziel: "zeiterfassung", schalter: true, hilfe: "Stempeln in der Team-App", woerter: [...modul, "stempeln", "arbeitszeit", "stunden", "stechuhr"] },
    { titel: "Bewertungen auf der Startseite", ziel: "bewertungen", schalter: true, woerter: [...modul, "rezensionen", "kundenstimmen", "sterne", "google"] },
  ]);

  add("schnittstellen", [
    { titel: "Webhooks", ziel: "#webhooks", hilfe: "Für n8n, Make, Zapier oder eigene Dienste", woerter: ["webhook", "schnittstelle", "integration", "automation", "ereignisse", "n8n", "make", "zapier"] },
    { titel: "API-Schlüssel", ziel: "#api-schluessel", woerter: ["api", "schnittstelle", "token", "schlüssel", "key", "zugriff", "bearer"] },
  ]);

  const recht = ["rechtstexte", "rechtlich", "it-recht", "kanzlei", "abmahnung"];
  add("recht", [
    { titel: "Adresse Datenschutzerklärung", ziel: "datenschutzUrl", wert: e.rechtstexte.datenschutzUrl, woerter: [...recht, "datenschutz", "dsgvo", "privacy", "link", "url"] },
    { titel: "Adresse AGB", ziel: "agbUrl", wert: e.rechtstexte.agbUrl, woerter: [...recht, "agb", "geschäftsbedingungen", "link", "url"] },
    { titel: "Datenschutzerklärung (Ersatztext)", ziel: "datenschutzText", wert: e.rechtstexte.datenschutzText, woerter: [...recht, "datenschutz", "dsgvo", "privacy", "text"] },
    { titel: "AGB (Ersatztext)", ziel: "agbText", wert: e.rechtstexte.agbText, woerter: [...recht, "agb", "geschäftsbedingungen", "text"] },
  ]);

  add("uebernahme", [
    { titel: "Datenübernahme", hilfe: "Kunden, Fahrzeuge und frühere Rechnungen aus CSV-Dateien", woerter: ["import", "importieren", "csv", "einlesen", "altbestand", "alte", "daten", "kunden", "pdf"] },
  ]);

  add("archiv", [
    { titel: "Archiv", hilfe: "Werkstattaufträge und Kostenvoranschläge gelöschter Termine, gelöschte Mails", woerter: ["archiv", "aufbewahrung", "gelöscht", "papierkorb", "termin gelöscht", "kostenvoranschlag", "auftrag", "mail", "wiederfinden"] },
  ]);

  add("fehler", [
    { titel: "Fehlerprotokoll", woerter: ["fehler", "log", "protokoll", "problem", "absturz", "störung", "bug", "error"] },
  ]);

  return liste;
}

/* ---------- Suchen ---------- */

/** Füllwörter einer Frage („Wo kann ich … ändern?“): tragen nichts zum Treffer bei. */
const FUELLWOERTER = new Set(
  (
    "wie wo was wann wer welche welcher welches welchen kann koennen konnte ich man wir du mein meine meinen meiner unser unsere der die das den dem des " +
    "ein eine einen einem einer und oder fuer von vom zu zum zur im in am auf mit bei nach ist sind wird werden soll sollen muss will moechte " +
    "gerne bitte hier da dort es sich mir uns neu neue neuen neues mehr ueber alle aendern aendere aenderung einstellen stelle eintragen trage " +
    "setzen setze finden finde bearbeiten bearbeite anpassen passe machen mache gibt geht steht stehen nicht wieder dann denn noch schon " +
    "einstellung einstellungen feld"
  ).split(" "),
);

/** Wörter fürs Ein- und Ausschalten: heben Häkchen hervor und gelten sonst als Füllwort. */
const SCHALTWOERTER = new Set(
  "an aus ab ein einschalten ausschalten abschalten anschalten aktivieren deaktivieren aktiv inaktiv ausblenden einblenden abstellen anstellen".split(" "),
);

/** Grobe Wortstämme: „Rechnungen“ ↔ „Rechnung“, „Bewertungen“ ↔ „Bewertung“. */
function stamm(w: string): string {
  if (w.length <= 5) return w;
  for (const endung of ["ungen", "en", "er", "es", "e", "n", "s"]) {
    if (w.endsWith(endung) && w.length - endung.length >= 4) return endung === "ungen" ? `${w.slice(0, -5)}ung` : w.slice(0, -endung.length);
  }
  return w;
}

/** Abstand zweier Wörter in Tippfehlern (Einfügen, Löschen, Ersetzen, Vertauschen). */
export function tippAbstand(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + kosten);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Wie gut ein gesuchtes Wort zu einem Wort des Eintrags passt, 0 bis 1. */
function aehnlich(q: string, w: string): number {
  if (q === w) return 1;
  const sq = stamm(q);
  const sw = stamm(w);
  if (sq === sw) return 0.95;
  if (w.startsWith(q)) return q.length >= 3 ? 0.9 : q.length === 2 ? 0.5 : 0;
  // Wortteile: „ziel“ steckt in „zahlungsziel“, „steuerberater“ in „steuerberatermail“.
  if (q.length >= 4 && w.includes(q)) return 0.75;
  if (w.length >= 5 && q.includes(w)) return 0.6;
  if (q.length < 4) return 0;
  // Tippfehler: kurze Wörter einer, lange zwei.
  const erlaubt = q.length >= 8 ? 2 : 1;
  const d = Math.min(tippAbstand(q, w), tippAbstand(sq, sw));
  if (d <= erlaubt) return 0.8 - 0.1 * d;
  // Halb getippt und vertippt: „oefnungsz“ gegen den Anfang von „oeffnungszeiten“
  if (w.length > q.length) {
    const dp = Math.min(tippAbstand(q, w.slice(0, q.length)), tippAbstand(q, w.slice(0, q.length + 1)));
    if (dp <= erlaubt) return 0.7 - 0.1 * dp;
  }
  return 0;
}

/** Wörter eines Textes in Vergleichsform. „E-Mail“ ergibt „e“, „mail“ und „email“. */
function vergleichsWoerter(text: string): string[] {
  const aus: string[] = [];
  for (const roh of text.split(/[^\p{L}\p{N}-]+/u)) {
    if (!roh) continue;
    const ganz = klein(roh);
    if (ganz) aus.push(ganz);
    if (roh.includes("-")) for (const teil of roh.split("-")) if (klein(teil)) aus.push(klein(teil));
  }
  return aus;
}

type Vorbereitet = { eintrag: SuchEintrag; woerter: [string, number][]; titel: string; wert: string };

/** Gewicht je Herkunft: Ein Treffer im Titel zählt mehr als einer in der Erklärung. */
function vorbereiten(e: SuchEintrag): Vorbereitet {
  const woerter: [string, number][] = [];
  const nimm = (text: string | undefined, gewicht: number) => {
    for (const w of vergleichsWoerter(text ?? "")) woerter.push([w, gewicht]);
  };
  nimm(e.titel, 1);
  for (const w of e.woerter ?? []) nimm(w, 0.9);
  nimm(e.abschnitt, 0.7);
  nimm(e.bereichTitel, 0.6);
  nimm(e.hilfe, 0.5);
  return { eintrag: e, woerter, titel: vergleichsWoerter(e.titel).join(""), wert: wertForm(e.wert ?? "") };
}

/** Werte vergleichen wir buchstabengetreu (nur Groß/klein und ß), damit „Siemensstr“ die Straße findet. */
function wertForm(t: string): string {
  return t.toLowerCase().replace(/ß/g, "ss").replace(/\s+/g, " ");
}

/** Ausschnitt um die Fundstelle im Wert, damit man sieht, warum das Feld passt. */
function ausschnitt(wert: string, start: number, laenge: number): string {
  const von = Math.max(0, start - 24);
  const bis = Math.min(wert.length, start + laenge + 40);
  return `${von > 0 ? "…" : ""}${wert.slice(von, bis).replace(/\s+/g, " ").trim()}${bis < wert.length ? "…" : ""}`;
}

/**
 * Sucht im Verzeichnis. Jedes sinnvolle Wort der Anfrage muss irgendwo passen (bei langen Fragen darf eines
 * fehlen); Ergebnis nach Güte, bei Gleichstand in der Reihenfolge der Seite.
 */
export function einstellungenSuchen(anfrage: string, verzeichnis: SuchEintrag[], max = 8): SuchTreffer[] {
  const roh = vergleichsWoerter(anfrage);
  if (!roh.length) return [];
  // „ein“ allein ist meist ein Teil des Verbs („stelle … ein“), „aus“ allein meint dagegen fast immer „abschalten“.
  const schalten = roh.some((w) => SCHALTWOERTER.has(w) && !["an", "ab", "ein"].includes(w));
  const worte = roh.filter((w) => !FUELLWOERTER.has(w) && !SCHALTWOERTER.has(w));
  // Nur Füll- oder Schaltwörter („wo“, „der“, „aus“): nichts Sinnvolles zu suchen, auch nicht in den Werten.
  if (!worte.length) return [];
  const satz = worte.join("");

  // Wert: wörtlich (ab 3 Zeichen) oder als Ziffernfolge (Telefon, IBAN, Steuernummer, ab 4 Ziffern).
  const wertAnfrage = wertForm(anfrage.trim());
  const ziffern = anfrage.replace(/\D/g, "");

  const mindestens = worte.length <= 2 ? worte.length : worte.length - 1;
  const treffer: (SuchTreffer & { platz: number })[] = [];

  verzeichnis.map(vorbereiten).forEach((v, platz) => {
    let summe = 0;
    let passend = 0;
    for (const q of worte) {
      let best = 0;
      for (const [w, gewicht] of v.woerter) best = Math.max(best, aehnlich(q, w) * gewicht);
      if (best >= 0.45) {
        passend++;
        summe += best;
      }
    }
    let punkte = passend >= mindestens ? summe / worte.length : 0;
    if (punkte && satz.length >= 4 && v.titel.includes(satz)) punkte += 0.3;
    if (punkte && schalten && v.eintrag.schalter) punkte += 0.15;

    let imWert: string | undefined;
    if (v.wert) {
      let stelle = wertAnfrage.length >= 3 ? v.wert.indexOf(wertAnfrage) : -1;
      let laenge = wertAnfrage.length;
      if (stelle < 0 && ziffern.length >= 4 && v.wert.replace(/\D/g, "").includes(ziffern)) {
        stelle = 0;
        laenge = 0;
      }
      if (stelle >= 0) {
        const wertPunkte = ziffern.length >= 4 ? 0.9 : 0.85;
        if (wertPunkte >= punkte) {
          punkte = wertPunkte;
          imWert = ausschnitt(v.eintrag.wert!, stelle, laenge);
        }
      }
    }
    if (punkte >= 0.45) treffer.push({ eintrag: v.eintrag, punkte, imWert, platz });
  });

  return treffer
    .sort((a, b) => b.punkte - a.punkte || a.platz - b.platz)
    .slice(0, max)
    .map(({ eintrag, punkte, imWert }) => ({ eintrag, punkte, imWert }));
}

/** Adresse eines Treffers: Reiter öffnen und das Ziel merken, zu dem gescrollt wird. */
export function trefferLink(e: SuchEintrag): string {
  return `/admin/einstellungen?bereich=${e.bereich}${e.ziel ? `&feld=${encodeURIComponent(e.ziel)}` : ""}`;
}
