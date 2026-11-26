/**
 * Texte der automatischen Mails (Einstellungen → Mailtexte). Ohne Abhängigkeiten, damit Standardtexte und
 * Füllen getestet sind. Anpassbar ist das Sprachliche: Betreff, Überschrift, Text und, wo es einen gibt, der
 * Absatz am Ende. Fakten (Datum, Betrag, Nummer), Knöpfe, Anhänge und Pflichthinweise (Widerruf, AGB, Abmelden,
 * Zahlungsangaben, E-Rechnung) setzt die App selbst, damit sie nie fehlen oder falsch werden.
 */

export type MailVorlage =
  | "termin_eingang"
  | "termin_eingang_eng"
  | "termin_gegenvorschlag"
  | "termin_bestaetigt"
  | "termin_verschoben"
  | "termin_abgelehnt"
  | "termin_zeit_abgelehnt"
  | "termin_zeit_abgesagt"
  | "termin_storniert"
  | "termin_erinnerung"
  | "auftrag_freigabe"
  | "auftrag_kopie"
  | "auftrag_bestaetigung"
  | "kostenvoranschlag"
  | "rechnung"
  | "rechnung_korrektur"
  | "rechnung_storno"
  | "bewertung"
  | "radwechsel"
  | "bewerbung"
  | "datev"
  | "intern_anfrage"
  | "intern_absage"
  | "intern_vorschlag_ja"
  | "intern_vorschlag_nein"
  | "intern_bewerbung"
  | "intern_krank"
  | "intern_antrag";

/** Was sich je Mail anpassen lässt. Felder, die der Standard nicht hat, gibt es bei dieser Mail nicht. */
export type MailText = { betreff: string; ueberschrift?: string; text?: string; schluss?: string };

/** Gespeichert unter `mailTexte`: nur Abweichungen vom Standard, leer heißt Standard. */
export type MailTexteEinstellung = { gruss: string; vorlagen: Partial<Record<MailVorlage, Partial<MailText>>> };

export const MAIL_GRUPPEN = ["Termine", "Werkstattauftrag", "Belege", "Erinnerungen", "Karriere", "Steuerberater", "Hinweise ans Büro"] as const;

/** Reihenfolge, Name und Anlass je Mail, für die Einstellungen. */
export const MAIL_VORLAGEN: { schluessel: MailVorlage; titel: string; wann: string; gruppe: (typeof MAIL_GRUPPEN)[number] }[] = [
  { schluessel: "termin_eingang", titel: "Anfrage erhalten", wann: "Kunde fragt online einen Termin an, Wunschzeit frei", gruppe: "Termine" },
  { schluessel: "termin_eingang_eng", titel: "Anfrage erhalten, Zeit knapp", wann: "Kunde fragt online an, Wunschzeit ist schon belegt", gruppe: "Termine" },
  { schluessel: "termin_gegenvorschlag", titel: "Gegenvorschlag", wann: "Büro schlägt eine andere Zeit vor", gruppe: "Termine" },
  { schluessel: "termin_bestaetigt", titel: "Termin bestätigt", wann: "Anfrage angenommen oder Auftrag eingeplant (mit Kalenderdatei)", gruppe: "Termine" },
  { schluessel: "termin_verschoben", titel: "Termin verschoben", wann: "Bestätigter Termin bekommt eine neue Zeit", gruppe: "Termine" },
  { schluessel: "termin_abgelehnt", titel: "Anfrage abgelehnt", wann: "Büro lehnt eine Anfrage ab", gruppe: "Termine" },
  { schluessel: "termin_zeit_abgelehnt", titel: "Zeit abgelehnt, Auftrag bleibt", wann: "Zeit für einen erteilten Auftrag klappt nicht", gruppe: "Termine" },
  { schluessel: "termin_zeit_abgesagt", titel: "Termin abgesagt, Auftrag bleibt", wann: "Nur der Termin wird abgesagt, der Auftrag bleibt", gruppe: "Termine" },
  { schluessel: "termin_storniert", titel: "Termin abgesagt", wann: "Termin wird abgesagt", gruppe: "Termine" },
  { schluessel: "termin_erinnerung", titel: "Erinnerung am Vortag", wann: "Am Tag vor dem Termin", gruppe: "Termine" },
  { schluessel: "auftrag_freigabe", titel: "Auftrag zur Freigabe", wann: "Werkstattauftrag an den Kunden, noch nicht erteilt", gruppe: "Werkstattauftrag" },
  { schluessel: "auftrag_kopie", titel: "Auftrag (Kopie)", wann: "Erteilter Werkstattauftrag wird erneut gesendet", gruppe: "Werkstattauftrag" },
  { schluessel: "auftrag_bestaetigung", titel: "Auftragsbestätigung", wann: "Kunde hat den Auftrag erteilt", gruppe: "Werkstattauftrag" },
  { schluessel: "kostenvoranschlag", titel: "Kostenvoranschlag", wann: "Kostenvoranschlag wird gesendet", gruppe: "Belege" },
  { schluessel: "rechnung", titel: "Rechnung", wann: "Rechnung wird gesendet", gruppe: "Belege" },
  { schluessel: "rechnung_korrektur", titel: "Berichtigte Rechnung", wann: "Korrektur einer Rechnung wird gesendet", gruppe: "Belege" },
  { schluessel: "rechnung_storno", titel: "Stornorechnung", wann: "Stornorechnung wird gesendet", gruppe: "Belege" },
  { schluessel: "bewertung", titel: "Bitte um Bewertung", wann: "Nach einem erledigten Termin, nur mit Einwilligung (Einstellungen → Automatik)", gruppe: "Erinnerungen" },
  { schluessel: "radwechsel", titel: "Radwechsel", wann: "Zu Saisonbeginn an Kunden mit eingelagerten Rädern, nur mit Einwilligung", gruppe: "Erinnerungen" },
  { schluessel: "bewerbung", titel: "Bewerbung erhalten", wann: "An Bewerber nach dem Absenden", gruppe: "Karriere" },
  { schluessel: "datev", titel: "Monatsversand", wann: "Am Monatsanfang an den Steuerberater (Einstellungen → Automatik)", gruppe: "Steuerberater" },
  { schluessel: "intern_anfrage", titel: "Neue Anfrage", wann: "Kunde fragt einen Termin an", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_absage", titel: "Kunde hat abgesagt", wann: "Kunde sagt über seinen Link ab", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_vorschlag_ja", titel: "Vorschlag angenommen", wann: "Kunde nimmt den Gegenvorschlag an", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_vorschlag_nein", titel: "Vorschlag abgelehnt", wann: "Kunde lehnt den Gegenvorschlag ab", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_bewerbung", titel: "Neue Bewerbung", wann: "Bewerbung über die Website", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_krank", titel: "Krankmeldung", wann: "Mitarbeiter meldet sich in der Team-App krank", gruppe: "Hinweise ans Büro" },
  { schluessel: "intern_antrag", titel: "Urlaubsantrag", wann: "Mitarbeiter beantragt Urlaub oder frei", gruppe: "Hinweise ans Büro" },
];

export const GRUSS_STANDARD = "Viele Grüße\n{inhaber} und Team";

export const MAIL_STANDARD: Record<MailVorlage, MailText> = {
  termin_eingang: {
    betreff: "Ihre Terminanfrage: {leistung}",
    ueberschrift: "Danke, Ihre Anfrage ist da.",
    text: "Hallo {name},\nwir haben Ihre Anfrage erhalten und halten den Termin für Sie frei. Sie bekommen eine zweite Mail, sobald wir ihn bestätigt haben, meist am selben Tag.",
  },
  termin_eingang_eng: {
    betreff: "Ihre Terminanfrage: {leistung}",
    ueberschrift: "Danke, Ihre Anfrage ist da.",
    text: "Hallo {name},\nzu Ihrer Wunschzeit ist es bei uns eng. Wir schauen, ob es trotzdem klappt, und melden uns meist am selben Tag: mit einer Zusage oder einem anderen Terminvorschlag.",
  },
  termin_gegenvorschlag: {
    betreff: "Unser Vorschlag: {datum}, {uhrzeit} Uhr",
    ueberschrift: "Wie wäre es mit diesem Termin?",
    text: "Hallo {name},\n{wunschzeit} klappt es leider nicht. Wir schlagen Ihnen diesen Termin vor und halten ihn für Sie frei {frei_bis}.",
    schluss: "Oder rufen Sie uns an: {telefon}",
  },
  termin_bestaetigt: {
    betreff: "Termin bestätigt: {datum}, {uhrzeit} Uhr",
    ueberschrift: "Ihr Termin steht.",
    text: "Hallo {name},\nwir haben Ihren Termin bestätigt. Die Kalenderdatei hängt an dieser Mail.",
    schluss: "Absagen ist bis {frist} Stunden vorher kostenlos über den Link möglich.",
  },
  termin_verschoben: {
    betreff: "Neuer Termin: {datum}, {uhrzeit} Uhr",
    ueberschrift: "Ihr Termin wurde verschoben.",
    text: "Hallo {name},\nIhr Termin hat eine neue Uhrzeit. Die aktualisierte Kalenderdatei hängt an.",
  },
  termin_abgelehnt: {
    betreff: "Ihre Terminanfrage: {leistung}",
    ueberschrift: "Zu dieser Zeit klappt es leider nicht.",
    text: "Hallo {name},\nden angefragten Termin am {datum} um {uhrzeit} Uhr können wir leider nicht annehmen.",
    schluss: "Oder rufen Sie uns an: {telefon}",
  },
  termin_zeit_abgelehnt: {
    betreff: "Ihr Termin: {leistung}",
    ueberschrift: "Zu dieser Zeit klappt es leider nicht.",
    text: "Hallo {name},\nden Termin am {datum} um {uhrzeit} Uhr können wir leider nicht einrichten. Ihr Auftrag bleibt bestehen, wir melden uns mit einem neuen Termin.",
    schluss: "Oder rufen Sie uns an: {telefon}",
  },
  termin_zeit_abgesagt: {
    betreff: "Termin abgesagt: {datum}",
    ueberschrift: "Ihr Termin ist abgesagt.",
    text: "Hallo {name},\nder folgende Termin ist abgesagt. Ihr Auftrag bleibt bestehen, wir melden uns mit einem neuen Termin.",
    schluss: "Fragen? Rufen Sie uns an: {telefon}",
  },
  termin_storniert: {
    betreff: "Termin abgesagt: {datum}",
    ueberschrift: "Ihr Termin ist abgesagt.",
    text: "Hallo {name},\nder folgende Termin ist abgesagt.",
  },
  termin_erinnerung: {
    betreff: "Erinnerung: morgen {uhrzeit} Uhr bei {firma}",
    ueberschrift: "Bis morgen.",
    text: "Hallo {name},\nwir erinnern Sie an Ihren Termin.",
  },
  auftrag_freigabe: {
    betreff: "Werkstattauftrag {nummer} von {firma}",
    ueberschrift: "Bitte bestätigen: Werkstattauftrag {nummer}",
    text: "Hallo {name},\nanbei der Werkstattauftrag für Ihr Fahrzeug. Bitte prüfen Sie ihn und erteilen Sie uns den Auftrag mit einem Klick.",
    schluss: "Fragen? Rufen Sie uns an: {telefon}",
  },
  auftrag_kopie: {
    betreff: "Werkstattauftrag {nummer} von {firma}",
    ueberschrift: "Ihr Werkstattauftrag {nummer}",
    text: "Hallo {name},\nanbei Ihr Werkstattauftrag als PDF.",
    schluss: "Fragen? Rufen Sie uns an: {telefon}",
  },
  auftrag_bestaetigung: {
    betreff: "Auftragsbestätigung {nummer} von {firma}",
    ueberschrift: "Danke für Ihren Auftrag.",
    text: "Hallo {name},\nIhr Werkstattauftrag ist bei uns. Eine Kopie hängt als PDF an dieser Mail.",
  },
  kostenvoranschlag: {
    betreff: "Kostenvoranschlag {nummer} von {firma}",
    ueberschrift: "Ihr Kostenvoranschlag {nummer}",
    text: "Hallo {name},\nvielen Dank für Ihre Anfrage. Unser Kostenvoranschlag hängt als PDF an dieser Mail.",
    schluss: "Passt alles? Dann nehmen Sie den Kostenvoranschlag mit einem Klick an. {danach}",
  },
  rechnung: {
    betreff: "Rechnung {nummer} von {firma}",
    ueberschrift: "Ihre Rechnung {nummer}",
    text: "Hallo {name},\nvielen Dank für Ihren Auftrag. Ihre Rechnung hängt als PDF an dieser Mail.",
  },
  rechnung_korrektur: {
    betreff: "Berichtigte Rechnung {nummer} von {firma}",
    ueberschrift: "Ihre berichtigte Rechnung {nummer}",
    text: "Hallo {name},\nanbei die berichtigte Rechnung. {ersetzt}",
  },
  rechnung_storno: {
    betreff: "Stornorechnung {nummer} von {firma}",
    ueberschrift: "Stornorechnung {nummer}",
    text: "Hallo {name},\nanbei die Stornorechnung.",
  },
  bewertung: {
    betreff: "Wie war's bei {firma}?",
    ueberschrift: "Danke für Ihren Besuch.",
    text: "Hallo {name},\nwir hoffen, mit {leistung} ist alles in Ordnung. Wenn Sie zufrieden waren, hilft uns eine kurze Bewertung bei Google sehr. Das dauert eine Minute.",
    schluss: "Und falls etwas nicht gepasst hat: Antworten Sie einfach auf diese Mail, dann kümmern wir uns.",
  },
  radwechsel: {
    betreff: "Radwechsel bei {firma}",
    ueberschrift: "Zeit für die {reifen}.",
    text: "Hallo {name},\nIhre {raeder} {fuer_fahrzeug} liegen bei uns bereit. Suchen Sie sich einen freien Termin aus. {dauer}",
  },
  bewerbung: {
    betreff: "Ihre Bewerbung bei {firma}",
    ueberschrift: "Danke für Ihre Bewerbung.",
    text: "Hallo {name},\nwir haben Ihre Bewerbung als {stelle} erhalten und melden uns in den nächsten Tagen telefonisch bei Ihnen.",
  },
  datev: {
    betreff: "{firma}: Rechnungen {monat}",
    ueberschrift: "Rechnungen {monat}",
    text: "Guten Tag,\nanbei der DATEV-Buchungsstapel und {anzahl} Rechnungen von {firma} für {monat}.",
  },
  intern_anfrage: { betreff: "Neue Anfrage: {leistung} {belegt}" },
  intern_absage: { betreff: "Kunde hat abgesagt: {leistung}" },
  intern_vorschlag_ja: { betreff: "Vorschlag angenommen: {leistung}" },
  intern_vorschlag_nein: { betreff: "Vorschlag passt dem Kunden nicht: {leistung}" },
  intern_bewerbung: { betreff: "Neue Bewerbung: {name}", ueberschrift: "Neue Bewerbung: {stelle}" },
  intern_krank: { betreff: "{person} ist krank gemeldet" },
  intern_antrag: { betreff: "{person} beantragt {art}" },
};

/** Platzhalter für die Hilfe in den Einstellungen. Welche bei einer Mail gefüllt sind, sagt `MAIL_PLATZHALTER_JE`. */
export const MAIL_PLATZHALTER: [string, string][] = [
  ["name", "Name des Kunden (bei Hinweisen ans Büro: des Bewerbers)"],
  ["firma", "Firmenname"],
  ["inhaber", "Name des Inhabers"],
  ["telefon", "Telefon der Werkstatt"],
  ["leistung", "Leistungen des Termins"],
  ["datum", "Tag des Termins"],
  ["uhrzeit", "Uhrzeit des Termins"],
  ["wunschzeit", "„am … um … Uhr“ oder „zu Ihrer Wunschzeit“"],
  ["frei_bis", "„bis …“, solange der Vorschlag gehalten wird"],
  ["frist", "Stunden, bis zu denen kostenlos abgesagt werden kann"],
  ["nummer", "Nummer von Auftrag, Kostenvoranschlag oder Rechnung"],
  ["ersetzt", "Satz, welche Rechnung die berichtigte ersetzt (mit Storno und Grund)"],
  ["danach", "Was nach dem Annehmen passiert (Auftrag erteilt oder Termin wählen)"],
  ["reifen", "Winterreifen oder Sommerreifen"],
  ["raeder", "Winterräder oder Sommerräder"],
  ["fuer_fahrzeug", "„für“ und Kennzeichen"],
  ["dauer", "Dauer des Radwechsels laut Preisliste"],
  ["stelle", "Stelle der Bewerbung"],
  ["monat", "Monat des Versands an den Steuerberater"],
  ["anzahl", "Anzahl der Rechnungen im Monat"],
  ["belegt", "„(Wunschzeit belegt)“, wenn die Zeit schon voll ist"],
  ["person", "Name des Mitarbeiters"],
  ["art", "Urlaub oder frei"],
];

const ALLGEMEIN = ["firma", "inhaber", "telefon"];
const TERMIN = ["name", "leistung", "datum", "uhrzeit", ...ALLGEMEIN];

/** Welche Platzhalter je Mail gefüllt werden (Hilfe unter dem Feld). */
export const MAIL_PLATZHALTER_JE: Record<MailVorlage, string[]> = {
  termin_eingang: TERMIN,
  termin_eingang_eng: TERMIN,
  termin_gegenvorschlag: [...TERMIN, "wunschzeit", "frei_bis"],
  termin_bestaetigt: [...TERMIN, "frist"],
  termin_verschoben: TERMIN,
  termin_abgelehnt: TERMIN,
  termin_zeit_abgelehnt: TERMIN,
  termin_zeit_abgesagt: TERMIN,
  termin_storniert: TERMIN,
  termin_erinnerung: TERMIN,
  auftrag_freigabe: ["name", "nummer", ...ALLGEMEIN],
  auftrag_kopie: ["name", "nummer", ...ALLGEMEIN],
  auftrag_bestaetigung: ["name", "nummer", ...ALLGEMEIN],
  kostenvoranschlag: ["name", "nummer", "danach", ...ALLGEMEIN],
  rechnung: ["name", "nummer", ...ALLGEMEIN],
  rechnung_korrektur: ["name", "nummer", "ersetzt", ...ALLGEMEIN],
  rechnung_storno: ["name", "nummer", ...ALLGEMEIN],
  bewertung: ["name", "leistung", ...ALLGEMEIN],
  radwechsel: ["name", "reifen", "raeder", "fuer_fahrzeug", "dauer", ...ALLGEMEIN],
  bewerbung: ["name", "stelle", ...ALLGEMEIN],
  datev: ["monat", "anzahl", ...ALLGEMEIN],
  intern_anfrage: ["leistung", "belegt", "name", "datum", "uhrzeit", "firma"],
  intern_absage: ["leistung", "name", "datum", "uhrzeit", "firma"],
  intern_vorschlag_ja: ["leistung", "name", "datum", "uhrzeit", "firma"],
  intern_vorschlag_nein: ["leistung", "name", "datum", "uhrzeit", "firma"],
  intern_bewerbung: ["name", "stelle", "firma"],
  intern_krank: ["person", "firma"],
  intern_antrag: ["person", "art", "firma"],
};

export const MAIL_FELDER: { feld: keyof MailText; titel: string; zeilen: number }[] = [
  { feld: "betreff", titel: "Betreff", zeilen: 1 },
  { feld: "ueberschrift", titel: "Überschrift", zeilen: 1 },
  { feld: "text", titel: "Text", zeilen: 4 },
  { feld: "schluss", titel: "Absatz am Ende", zeilen: 2 },
];

/**
 * Setzt die Werte in den Text. Unbekannte oder leere Platzhalter fallen weg, damit kein „{grenze}“ beim Kunden
 * ankommt; dabei entstehende doppelte Leerzeichen werden zusammengezogen.
 */
export function platzhalterFuellen(vorlage: string, werte: Record<string, string | undefined>): string {
  return vorlage
    .replace(/\{(\w+)\}/g, (_, k: string) => werte[k]?.trim() ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?:)])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^\s+/, "");
}

export type GefuellterMailText = { betreff: string; ueberschrift: string; text: string; schluss: string; gruss: string };

/**
 * Die geltenden Texte einer Mail, gefüllt: Gespeichertes geht vor, ein leeres Feld nimmt den Standard. Ohne
 * eigene Überschrift gilt der Betreff (Hinweise ans Büro). Zeilenumbrüche im Betreff fallen weg.
 */
export function mailTexte(
  e: { mailTexte: MailTexteEinstellung; firma: { name: string; inhaber: string; telefon: string } },
  schluessel: MailVorlage,
  werte: Record<string, string | undefined>,
): GefuellterMailText {
  const standard = MAIL_STANDARD[schluessel];
  const eigen = e.mailTexte.vorlagen[schluessel] ?? {};
  const alle = { firma: e.firma.name, inhaber: e.firma.inhaber, telefon: e.firma.telefon, ...werte };
  const feld = (k: keyof MailText) => {
    const roh = standard[k] === undefined ? "" : eigen[k]?.trim() ? eigen[k]! : (standard[k] ?? "");
    return platzhalterFuellen(roh, alle).trim();
  };
  const betreff = feld("betreff").replace(/\s*\n\s*/g, " ");
  return {
    betreff,
    ueberschrift: feld("ueberschrift").replace(/\s*\n\s*/g, " ") || betreff,
    text: feld("text"),
    schluss: feld("schluss"),
    gruss: platzhalterFuellen(e.mailTexte.gruss.trim() || GRUSS_STANDARD, alle).trim(),
  };
}
