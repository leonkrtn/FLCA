/**
 * Texte der automatischen Mails (Einstellungen → Mailtexte). Ohne Abhängigkeiten, damit Standardtexte und
 * Füllen getestet sind. Die Mails gehen als schlichte Textmail raus, wie von Hand geschrieben: Termin, Betrag,
 * Nummer und Fahrzeug stehen über Platzhalter im Fließtext. Links, Anhänge und Pflichtangaben (Widerruf, AGB,
 * Abmelden, E-Rechnung) setzt die App selbst, damit sie nie fehlen.
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
export type MailText = { betreff: string; text?: string; schluss?: string };

/** Gespeichert unter `mailTexte`: nur Abweichungen vom Standard, leer heißt Standard. */
/** Den Gruß bringt die Signatur mit (Einstellungen → E-Mail → Signatur), deshalb hier keiner. */
export type MailTexteEinstellung = { vorlagen: Partial<Record<MailVorlage, Partial<MailText>>> };

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

export const MAIL_STANDARD: Record<MailVorlage, MailText> = {
  termin_eingang: {
    betreff: "Ihre Terminanfrage für {leistung}",
    text: "Hallo {name},\n\nvielen Dank für Ihre Anfrage. Wir haben sie erhalten und halten Ihnen den Termin am {datum} um {uhrzeit} Uhr für {leistung} ({fahrzeug}) frei.\n\nSobald wir den Termin bestätigt haben, bekommen Sie eine zweite Mail von uns, meistens noch am selben Tag.",
  },
  termin_eingang_eng: {
    betreff: "Ihre Terminanfrage für {leistung}",
    text: "Hallo {name},\n\nvielen Dank für Ihre Anfrage für {leistung} am {datum} um {uhrzeit} Uhr. Zu dieser Zeit ist es bei uns leider schon eng.\n\nWir schauen, ob es trotzdem klappt, und melden uns meistens noch am selben Tag bei Ihnen, entweder mit einer Zusage oder mit einem anderen Terminvorschlag.",
  },
  termin_gegenvorschlag: {
    betreff: "Terminvorschlag: {datum}, {uhrzeit} Uhr",
    text: "Hallo {name},\n\n{wunschzeit} klappt es bei uns leider nicht. Wir können Ihnen aber {datum} um {uhrzeit} Uhr für {leistung} anbieten und halten Ihnen den Termin {frei_bis} frei.",
    schluss: "Sie können uns auch gerne anrufen: {telefon}",
  },
  termin_bestaetigt: {
    betreff: "Ihr Termin am {datum} um {uhrzeit} Uhr",
    text: "Hallo {name},\n\nIhr Termin für {leistung} ({fahrzeug}) am {datum} um {uhrzeit} Uhr ist bestätigt. Die Kalenderdatei hängt an dieser Mail.\n\nSie finden uns in der {adresse}. {anfahrt}",
    schluss: "Bis {frist} Stunden vorher können Sie kostenlos absagen.",
  },
  termin_verschoben: {
    betreff: "Ihr Termin ist verschoben: {datum}, {uhrzeit} Uhr",
    text: "Hallo {name},\n\nwir haben Ihren Termin für {leistung} verschoben. Der neue Termin ist am {datum} um {uhrzeit} Uhr. Die aktualisierte Kalenderdatei hängt an dieser Mail.",
  },
  termin_abgelehnt: {
    betreff: "Ihre Terminanfrage für {leistung}",
    text: "Hallo {name},\n\nleider können wir Ihre Anfrage für {leistung} am {datum} um {uhrzeit} Uhr nicht annehmen.",
    schluss: "Oder rufen Sie uns einfach an: {telefon}",
  },
  termin_zeit_abgelehnt: {
    betreff: "Ihr Termin für {leistung}",
    text: "Hallo {name},\n\nden Termin am {datum} um {uhrzeit} Uhr können wir leider nicht einrichten. Ihr Auftrag bleibt aber bestehen, wir melden uns mit einem neuen Termin bei Ihnen.",
    schluss: "Bei Fragen erreichen Sie uns unter {telefon}.",
  },
  termin_zeit_abgesagt: {
    betreff: "Ihr Termin am {datum} ist abgesagt",
    text: "Hallo {name},\n\nIhr Termin am {datum} um {uhrzeit} Uhr für {leistung} ist abgesagt. Ihr Auftrag bleibt aber bestehen, wir melden uns mit einem neuen Termin bei Ihnen.",
    schluss: "Bei Fragen erreichen Sie uns unter {telefon}.",
  },
  termin_storniert: {
    betreff: "Ihr Termin am {datum} ist abgesagt",
    text: "Hallo {name},\n\nIhr Termin am {datum} um {uhrzeit} Uhr für {leistung} ist abgesagt.",
  },
  termin_erinnerung: {
    betreff: "Erinnerung an Ihren Termin morgen um {uhrzeit} Uhr",
    text: "Hallo {name},\n\nwir möchten Sie kurz an Ihren Termin morgen, {datum}, um {uhrzeit} Uhr erinnern ({leistung}).\n\nSie finden uns in der {adresse}. {anfahrt}",
  },
  auftrag_freigabe: {
    betreff: "Werkstattauftrag {nummer} zur Freigabe",
    text: "Hallo {name},\n\nanbei erhalten Sie den Werkstattauftrag {nummer} {fuer_fahrzeug}. Die Arbeiten kosten voraussichtlich {betrag}. {grenze_satz} {termin_satz}\n\nBitte schauen Sie sich den Auftrag an und erteilen Sie ihn uns mit einem Klick.",
    schluss: "Bei Fragen erreichen Sie uns unter {telefon}.",
  },
  auftrag_kopie: {
    betreff: "Ihr Werkstattauftrag {nummer}",
    text: "Hallo {name},\n\nanbei erhalten Sie Ihren Werkstattauftrag {nummer} {fuer_fahrzeug} als PDF. {termin_satz}",
    schluss: "Bei Fragen erreichen Sie uns unter {telefon}.",
  },
  auftrag_bestaetigung: {
    betreff: "Auftragsbestätigung {nummer}",
    text: "Hallo {name},\n\nvielen Dank für Ihren Auftrag {nummer} {fuer_fahrzeug}. {erteilt} Eine Kopie hängt als PDF an dieser Mail.\n\nDie Arbeiten kosten voraussichtlich {betrag}. {grenze_satz} {termin_satz}",
  },
  kostenvoranschlag: {
    betreff: "Ihr Kostenvoranschlag {nummer}",
    text: "Hallo {name},\n\nvielen Dank für Ihre Anfrage. Anbei erhalten Sie unseren Kostenvoranschlag {nummer} {fuer_fahrzeug} über {betrag}. {gueltig_satz}\n\nWenn alles passt, können Sie den Kostenvoranschlag mit einem Klick annehmen. {danach}",
    schluss: "Bei Fragen erreichen Sie uns unter {telefon}.",
  },
  rechnung: {
    betreff: "Ihre Rechnung {nummer}",
    text: "Hallo {name},\n\nvielen Dank für Ihren Auftrag. Anbei erhalten Sie unsere Rechnung {nummer} über {betrag} {fuer_fahrzeug}.\n\n{zahlung}",
  },
  rechnung_korrektur: {
    betreff: "Ihre berichtigte Rechnung {nummer}",
    text: "Hallo {name},\n\nanbei erhalten Sie die berichtigte Rechnung {nummer} über {betrag}. {ersetzt}\n\n{zahlung}",
  },
  rechnung_storno: {
    betreff: "Stornorechnung {nummer}",
    text: "Hallo {name},\n\nanbei erhalten Sie die Stornorechnung {nummer}. {storniert}",
  },
  bewertung: {
    betreff: "Wie war's bei {firma}?",
    text: "Hallo {name},\n\nvielen Dank für Ihren Besuch bei uns. Wir hoffen, mit {leistung} ist alles in Ordnung.\n\nWenn Sie zufrieden waren, würden wir uns sehr über eine kurze Bewertung bei Google freuen. Das dauert nur eine Minute.",
    schluss: "Und falls etwas nicht gepasst hat, antworten Sie einfach auf diese Mail. Dann kümmern wir uns darum.",
  },
  radwechsel: {
    betreff: "Zeit für die {reifen}",
    text: "Hallo {name},\n\nbald ist es wieder Zeit für die {reifen}. Ihre {raeder} {fuer_fahrzeug} liegen bei uns bereit. {dauer}",
  },
  bewerbung: {
    betreff: "Ihre Bewerbung bei {firma}",
    text: "Hallo {name},\n\nvielen Dank für Ihre Bewerbung als {stelle}. Wir haben sie erhalten und melden uns in den nächsten Tagen telefonisch bei Ihnen.",
  },
  datev: {
    betreff: "{firma}: Rechnungen {monat}",
    text: "Guten Tag,\n\nanbei erhalten Sie den DATEV-Buchungsstapel und die {anzahl} Rechnungen von {firma} für {monat}.",
  },
  intern_anfrage: { betreff: "Neue Anfrage: {leistung} {belegt}" },
  intern_absage: { betreff: "Kunde hat abgesagt: {leistung}" },
  intern_vorschlag_ja: { betreff: "Vorschlag angenommen: {leistung}" },
  intern_vorschlag_nein: { betreff: "Vorschlag passt dem Kunden nicht: {leistung}" },
  intern_bewerbung: { betreff: "Neue Bewerbung: {name} ({stelle})" },
  intern_krank: { betreff: "{person} ist krank gemeldet" },
  intern_antrag: { betreff: "{person} beantragt {art}" },
};

/** Platzhalter für die Hilfe in den Einstellungen. Welche bei einer Mail gefüllt sind, sagt `MAIL_PLATZHALTER_JE`. */
export const MAIL_PLATZHALTER: [string, string][] = [
  ["name", "Name des Kunden (bei Hinweisen ans Büro: des Kunden oder Bewerbers)"],
  ["firma", "Firmenname"],
  ["inhaber", "Name des Inhabers"],
  ["telefon", "Telefon der Werkstatt"],
  ["adresse", "Adresse der Werkstatt"],
  ["anfahrt", "Hinweis zur Anfahrt (Einstellungen → Firma)"],
  ["leistung", "Leistungen des Termins"],
  ["datum", "Tag des Termins, z. B. „Montag, 1. Dezember“"],
  ["uhrzeit", "Uhrzeit des Termins"],
  ["fahrzeug", "Marke, Modell und Kennzeichen"],
  ["fuer_fahrzeug", "„für Ihr Fahrzeug …“ mit Marke, Modell und Kennzeichen"],
  ["wunschzeit", "„am … um … Uhr“ oder „zu Ihrer Wunschzeit“"],
  ["frei_bis", "„bis …“, solange der Vorschlag gehalten wird"],
  ["frist", "Stunden, bis zu denen kostenlos abgesagt werden kann"],
  ["nummer", "Nummer von Auftrag, Kostenvoranschlag oder Rechnung"],
  ["betrag", "Betrag von Auftrag, Kostenvoranschlag oder Rechnung"],
  ["grenze_satz", "Satz zur Kostengrenze, falls eine vereinbart ist"],
  ["termin_satz", "Satz zum Termin des Auftrags (oder dass er noch vereinbart wird)"],
  ["erteilt", "Satz, wann und wie der Auftrag erteilt wurde"],
  ["gueltig_satz", "Satz, bis wann der Kostenvoranschlag gilt"],
  ["danach", "Was nach dem Annehmen passiert (Auftrag erteilt oder Termin wählen)"],
  ["zahlung", "Zahlungsaufforderung mit Frist und Bankverbindung, bereits Bezahltes; leer, wenn nichts offen ist"],
  ["ersetzt", "Satz, welche Rechnung die berichtigte ersetzt (mit Storno und Grund)"],
  ["storniert", "Satz, welche Rechnung storniert wird"],
  ["reifen", "Winterreifen oder Sommerreifen"],
  ["raeder", "Winterräder oder Sommerräder"],
  ["dauer", "Dauer des Radwechsels laut Preisliste, als Satz"],
  ["stelle", "Stelle der Bewerbung"],
  ["monat", "Monat des Versands an den Steuerberater"],
  ["anzahl", "Anzahl der Rechnungen im Monat"],
  ["belegt", "„(Wunschzeit belegt)“, wenn die Zeit schon voll ist"],
  ["person", "Name des Mitarbeiters"],
  ["art", "Urlaub oder frei"],
];

const ALLGEMEIN = ["firma", "inhaber", "telefon", "adresse"];
const TERMIN = ["name", "leistung", "datum", "uhrzeit", "fahrzeug", "fuer_fahrzeug", "anfahrt", ...ALLGEMEIN];
const AUFTRAG = ["name", "nummer", "betrag", "fahrzeug", "fuer_fahrzeug", "grenze_satz", "termin_satz", ...ALLGEMEIN];
const BELEG = ["name", "nummer", "betrag", "fahrzeug", "fuer_fahrzeug", ...ALLGEMEIN];

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
  auftrag_freigabe: AUFTRAG,
  auftrag_kopie: AUFTRAG,
  auftrag_bestaetigung: [...AUFTRAG, "erteilt"],
  kostenvoranschlag: [...BELEG, "gueltig_satz", "danach"],
  rechnung: [...BELEG, "zahlung"],
  rechnung_korrektur: [...BELEG, "zahlung", "ersetzt"],
  rechnung_storno: [...BELEG, "storniert"],
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
  { feld: "text", titel: "Text", zeilen: 7 },
  { feld: "schluss", titel: "Satz nach dem Link", zeilen: 2 },
];

/**
 * Setzt die Werte in den Text. Unbekannte oder leere Platzhalter fallen weg, damit kein „{grenze}“ beim Kunden
 * ankommt; dabei entstehende doppelte Leerzeichen werden zusammengezogen.
 */
export function platzhalterFuellen(vorlage: string, werte: Record<string, string | undefined>): string {
  return vorlage
    .replace(/\{(\w+)\}/g, (_, k: string) => werte[k]?.trim() ?? "")
    // Klammern, deren Platzhalter leer blieb („für Ölwechsel ()“)
    .replace(/[ \t]*\([ \t]*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?:)])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^\s+/, "");
}

export type GefuellterMailText = { betreff: string; text: string; schluss: string };

/**
 * Die geltenden Texte einer Mail, gefüllt: Gespeichertes geht vor, ein leeres Feld nimmt den Standard.
 * Zeilenumbrüche im Betreff fallen weg, im Text bleiben höchstens eine Leerzeile zwischen Absätzen.
 */
export function mailTexte(
  e: { mailTexte: MailTexteEinstellung; firma: { name: string; inhaber: string; telefon: string; strasse: string; plz: string; ort: string; hinweisAnfahrt: string } },
  schluessel: MailVorlage,
  werte: Record<string, string | undefined>,
): GefuellterMailText {
  const standard = MAIL_STANDARD[schluessel];
  const eigen = e.mailTexte.vorlagen[schluessel] ?? {};
  const f = e.firma;
  const alle = { firma: f.name, inhaber: f.inhaber, telefon: f.telefon, adresse: `${f.strasse}, ${f.plz} ${f.ort}`, anfahrt: f.hinweisAnfahrt, ...werte };
  const feld = (k: keyof MailText) => {
    const roh = standard[k] === undefined ? "" : eigen[k]?.trim() ? eigen[k]! : (standard[k] ?? "");
    return platzhalterFuellen(roh, alle)
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };
  return {
    betreff: feld("betreff").replace(/\s*\n\s*/g, " "),
    text: feld("text"),
    schluss: feld("schluss"),
  };
}

type FahrzeugAngabe = { kennzeichen?: string | null; marke_modell?: string | null; marke?: string | null; modell?: string | null } | null | undefined;

/** Marke und Modell aus Termin (`marke_modell`) oder Beleg (`marke`, `modell`). */
const markeModell = (f: FahrzeugAngabe) => (f?.marke_modell ?? [f?.marke, f?.modell].filter((x) => x?.trim()).join(" ")).trim();

/** Für `{fahrzeug}`: „VW Golf, OF-AB 123“, eines von beiden oder leer (steht im Text oft schon in Klammern). */
export function fahrzeugAngabe(f: FahrzeugAngabe): string {
  return [markeModell(f), f?.kennzeichen?.trim()].filter(Boolean).join(", ");
}

/** Für `{fuer_fahrzeug}`: „für Ihr Fahrzeug VW Golf (OF-AB 123)“ oder leer. */
export function fuerFahrzeug(f: FahrzeugAngabe): string {
  const mm = markeModell(f);
  const kz = f?.kennzeichen?.trim();
  const was = mm && kz ? `${mm} (${kz})` : mm || kz;
  return was ? `für Ihr Fahrzeug ${was}` : "";
}
