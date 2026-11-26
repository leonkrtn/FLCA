import { platzhalterFuellen } from "./email/texte";
import { auftragStand, type AuftragFelder, ueberKostengrenze } from "./auftrag-regeln";
import { offenerBetrag } from "./rechnung/korrektur";
import { berlinDatum, plusTage } from "./zeit";

/**
 * Vorausgefüllte WhatsApp-Nachrichten an Kunden (Link `wa.me/…?text=…`, gesendet wird von Hand am Handy).
 * Ohne Datenbank, damit Auswahl und Füllen getestet sind; die Texte selbst kommen aus den Einstellungen.
 */

export type WhatsappVorlage =
  | "anfrage"
  | "einplanen"
  | "gegenvorschlag"
  | "bestaetigt"
  | "erinnerung"
  | "freigabe"
  | "kostengrenze"
  | "rueckfrage"
  | "fertig"
  | "bewertung"
  | "neuer_termin"
  | "kostenvoranschlag"
  | "rechnung"
  | "rechnung_bezahlt";

/** Reihenfolge, Name und Anlass je Vorlage, für die Einstellungen und den Verlauf. */
export const WHATSAPP_VORLAGEN: { schluessel: WhatsappVorlage; titel: string; wann: string }[] = [
  { schluessel: "anfrage", titel: "Rückfrage zur Anfrage", wann: "Termin angefragt" },
  { schluessel: "einplanen", titel: "Termin vereinbaren", wann: "Werkstattauftrag ohne Termin" },
  { schluessel: "gegenvorschlag", titel: "Gegenvorschlag", wann: "Anfrage mit offenem Gegenvorschlag" },
  { schluessel: "bestaetigt", titel: "Termin bestätigt", wann: "Bestätigter Termin, ab übermorgen" },
  { schluessel: "erinnerung", titel: "Erinnerung", wann: "Bestätigter Termin morgen oder heute, noch nicht begonnen" },
  { schluessel: "freigabe", titel: "Auftrag freigeben", wann: "Werkstattauftrag zur Freigabe beim Kunden" },
  { schluessel: "kostengrenze", titel: "Kostengrenze überschritten", wann: "Auftrag liegt über der Kostengrenze" },
  { schluessel: "rueckfrage", titel: "Rückfrage zum Fahrzeug", wann: "Auto steht in der Werkstatt" },
  { schluessel: "fertig", titel: "Auto fertig", wann: "Auftrag fertig gemeldet oder am Tag des Termins erledigt" },
  { schluessel: "bewertung", titel: "Bitte um Bewertung", wann: "Erledigt, ab dem Tag nach dem Termin" },
  { schluessel: "neuer_termin", titel: "Neuer Termin", wann: "Abgelehnt, abgesagt oder nicht erschienen" },
  { schluessel: "kostenvoranschlag", titel: "Kostenvoranschlag", wann: "Abgeschlossener Kostenvoranschlag, noch ohne Antwort" },
  { schluessel: "rechnung", titel: "Rechnung", wann: "Gestellte Rechnung mit offenem Betrag" },
  { schluessel: "rechnung_bezahlt", titel: "Rechnung (bezahlt)", wann: "Rechnung ohne offenen Betrag" },
];

export const WHATSAPP_STANDARD: Record<WhatsappVorlage, string> = {
  anfrage: "Hallo {name}, danke für Ihre Anfrage zu {leistung} am {datum} um {uhrzeit} Uhr. Kurze Rückfrage: ",
  einplanen: "Hallo {name}, Ihr Auftrag für Ihr Fahrzeug {fahrzeug} liegt bei uns bereit. Wann können Sie das Auto bringen? Antworten Sie einfach hier oder rufen Sie an: {telefon}",
  gegenvorschlag:
    "Hallo {name}, zu Ihrer Wunschzeit ist bei uns leider schon alles belegt. Passt Ihnen {datum} um {uhrzeit} Uhr? Hier können Sie mit einem Tipp zusagen: {link}",
  bestaetigt: "Hallo {name}, Ihr Termin für {leistung} am {datum} um {uhrzeit} Uhr ist bestätigt. Sie finden uns in der {adresse}. Alle Angaben: {link}\n\nViele Grüße\n{firma}",
  erinnerung: "Hallo {name}, eine kurze Erinnerung an Ihren Termin {datum} um {uhrzeit} Uhr ({leistung}). Sie finden uns in der {adresse}. Bis dann!\n{firma}",
  freigabe: "Hallo {name}, der Werkstattauftrag für Ihr Fahrzeug {fahrzeug} ist vorbereitet. Bitte geben Sie ihn hier frei, dann legen wir los: {link}",
  kostengrenze:
    "Hallo {name}, an Ihrem Fahrzeug {fahrzeug} ist mehr zu tun als gedacht. Damit läge der Auftrag bei {betrag}, über der vereinbarten Grenze von {grenze}. Sollen wir das machen? Bei Fragen erreichen Sie uns unter {telefon}.",
  rueckfrage: "Hallo {name}, kurze Rückfrage zu Ihrem Fahrzeug {fahrzeug}: ",
  fertig: "Hallo {name}, Ihr Fahrzeug {fahrzeug} ist fertig und kann abgeholt werden.\n\nViele Grüße\n{firma}",
  bewertung: "Hallo {name}, danke für Ihren Besuch! Wenn Sie zufrieden waren, freuen wir uns sehr über eine kurze Bewertung: {bewertung}",
  neuer_termin: "Hallo {name}, gern finden wir einen neuen Termin für Sie. Freie Zeiten sehen Sie hier: {buchen}",
  kostenvoranschlag: "Hallo {name}, hier ist Ihr Kostenvoranschlag {nummer} für Ihr Fahrzeug {fahrzeug} über {betrag}. Ansehen und annehmen: {link}",
  rechnung: "Hallo {name}, hier ist Ihre Rechnung {nummer} über {betrag}, zahlbar bis {bis}: {link}\n\nVielen Dank für Ihren Auftrag!\n{firma}",
  rechnung_bezahlt: "Hallo {name}, hier ist Ihre Rechnung {nummer} zum Herunterladen: {link}\n\nVielen Dank für Ihren Auftrag!\n{firma}",
};

/** Platzhalter, die in den Texten erlaubt sind (Hilfe in den Einstellungen). */
export const WHATSAPP_PLATZHALTER: [string, string][] = [
  ["name", "Name des Kunden"],
  ["fahrzeug", "Marke, Modell und Kennzeichen"],
  ["leistung", "Leistungen des Termins"],
  ["datum", "Tag des Termins"],
  ["uhrzeit", "Uhrzeit des Termins"],
  ["link", "Terminseite, Kostenvoranschlag oder Rechnung"],
  ["nummer", "Nummer von Kostenvoranschlag oder Rechnung"],
  ["betrag", "Betrag (Auftrag, Kostenvoranschlag, offener Rechnungsbetrag)"],
  ["grenze", "Kostengrenze des Auftrags"],
  ["bis", "Zahlbar bis"],
  ["adresse", "Adresse der Werkstatt"],
  ["telefon", "Telefon der Werkstatt"],
  ["firma", "Firmenname"],
  ["bewertung", "Link zu den Google-Bewertungen"],
  ["buchen", "Seite für die Terminanfrage"],
];

/** Setzt die Werte in den Text (dieselben Regeln wie bei den Mailtexten). */
export const whatsappText = platzhalterFuellen;

/** „VW Golf (OF-AB 123)“, nur eines von beiden oder leer. */
export function fahrzeugText(f: { kennzeichen?: string | null; marke_modell?: string | null } | null | undefined): string {
  const mm = f?.marke_modell?.trim();
  const kz = f?.kennzeichen?.trim();
  return mm && kz ? `${mm} (${kz})` : mm || kz || "";
}

type TerminFuerVorlage = Pick<AuftragFelder, "auftrag_nummer" | "auftrag_erteilt_am" | "auftrag_gesendet_am" | "auftrag_kostengrenze_cent" | "auftrag_summe_brutto_cent"> & {
  status: "ungeplant" | "angefragt" | "bestaetigt" | "abgelehnt" | "storniert" | "erledigt" | "nicht_erschienen";
  /** Leer nur beim Auftrag ohne Termin */
  beginn: string | null;
  auftrag_status: "offen" | "in_arbeit" | "fertig";
  vorschlag_am?: string | null;
};

/**
 * Die eine Nachricht, die zum Stand des Termins passt. Beim bestätigten Termin geht vor, worauf die Werkstatt
 * am dringendsten eine Antwort braucht: fertig vor Kostengrenze vor Freigabe vor Terminhinweis.
 */
export function terminVorlage(t: TerminFuerVorlage, jetzt: Date = new Date()): WhatsappVorlage {
  const heute = berlinDatum(jetzt);
  // Ohne Termin zählt der Tag als vorbei (für „erledigt“ heißt das: um eine Bewertung bitten).
  const tag = t.beginn ? berlinDatum(new Date(t.beginn)) : "";
  switch (t.status) {
    case "ungeplant":
      return auftragStand(t) === "beim_kunden" ? "freigabe" : "einplanen";
    case "angefragt":
      return t.vorschlag_am ? "gegenvorschlag" : "anfrage";
    case "erledigt":
      return tag >= heute ? "fertig" : "bewertung";
    case "abgelehnt":
    case "storniert":
    case "nicht_erschienen":
      return "neuer_termin";
    case "bestaetigt":
      if (t.auftrag_status === "fertig") return "fertig";
      if (ueberKostengrenze(t)) return "kostengrenze";
      if (auftragStand(t) === "beim_kunden") return "freigabe";
      if (t.beginn && new Date(t.beginn).getTime() > jetzt.getTime() && t.auftrag_status === "offen") {
        return tag <= plusTage(heute, 1) ? "erinnerung" : "bestaetigt";
      }
      return "rueckfrage";
  }
}

/** Kostenvoranschlag: nur ein abgeschlossener, auf den der Kunde noch nicht geantwortet hat. */
export function kvVorlage(k: { status: "entwurf" | "offen" | "angenommen" | "abgelehnt" }): WhatsappVorlage | null {
  return k.status === "offen" ? "kostenvoranschlag" : null;
}

/**
 * Rechnung: positiv aus dem Status entschieden (Fehlerbuch „Zahlung anfordern“). Entwurf, Storno und
 * Stornorechnung bekommen keine Nachricht.
 */
export function rechnungVorlage(r: {
  status: "entwurf" | "gestellt" | "bezahlt" | "storniert";
  storno_zu?: string | null;
  summe_brutto_cent: number;
  bereits_bezahlt_cent?: number | null;
}): WhatsappVorlage | null {
  if (r.storno_zu) return null;
  if (r.status === "gestellt") return offenerBetrag(r) > 0 ? "rechnung" : "rechnung_bezahlt";
  if (r.status === "bezahlt") return "rechnung_bezahlt";
  return null;
}
