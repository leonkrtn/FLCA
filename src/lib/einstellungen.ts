import "server-only";
import { cache } from "react";
import { KONFIGURIERT } from "./env";
import { db } from "./supabase/admin";

/** Zeitfenster als „HH:MM“, z. B. ["08:30", "13:00"]. */
export type Fenster = [string, string];

/** Wochentag 1 = Montag … 7 = Sonntag. */
export type Oeffnungszeiten = Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", Fenster[]>;

export type Einstellungen = {
  firma: {
    name: string;
    inhaber: string;
    titel: string;
    rechtsform: string;
    kammer: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon: string;
    whatsapp: string;
    email: string;
    instagram: string;
    hinweisAnfahrt: string;
    googleBewertungLink: string;
    googleNote: string;
    googleAnzahl: string;
    steuernummer: string;
    ustId: string;
    iban: string;
    bic: string;
    bank: string;
  };
  oeffnungszeiten: Oeffnungszeiten;
  buchung: {
    aktiv: boolean;
    /** Wie viele Fahrzeuge gleichzeitig bearbeitet werden können */
    kapazitaet: number;
    pufferMin: number;
    rasterMin: number;
    /** Mindestabstand einer Anfrage zum Termin */
    vorlaufStd: number;
    /** So weit im Voraus ist eine Anfrage möglich */
    maxTage: number;
    /** So lange hält eine unbestätigte Anfrage ihren Slot */
    haltenStd: number;
    /** Bis so kurz vorher darf der Kunde über seinen Link stornieren (AGB § 10) */
    stornoFristStd: number;
  };
  rechnung: {
    zahlungszielTage: number;
    fusstext: string;
    einleitung: string;
  };
  benachrichtigung: {
    /** Empfänger für „Neue Anfrage“, „Neue Bewerbung“; leer = Firmen-E-Mail */
    emails: string[];
  };
  automatik: {
    erinnerung: { aktiv: boolean };
    bewertung: { aktiv: boolean; stundenNach: number };
    saison: { aktiv: boolean; fruehjahr: string; herbst: string };
    datev: {
      aktiv: boolean;
      email: string;
      beraterNr: string;
      mandantNr: string;
      sachkontenlaenge: number;
      erloeskonto19: string;
      kasse: string;
      bank: string;
      debitorSammel: string;
    };
  };
  module: {
    karriere: boolean;
    galerie: boolean;
    einlagerung: boolean;
    zeiterfassung: boolean;
    bewertungen: boolean;
  };
  texte: {
    heroUnterzeile: string;
    ueberTitel: string;
    ueberText: string;
    karriereText: string;
  };
  medien: {
    heroBild: string;
    heroVideo: string;
    ueberBild: string;
  };
  rechtstexte: {
    datenschutzUrl: string;
    agbUrl: string;
    datenschutzText: string;
    agbText: string;
  };
};

export const STANDARD: Einstellungen = {
  firma: {
    name: "FLC Automotive",
    inhaber: "Flavio Ciurli",
    titel: "Kfz-Meister",
    rechtsform: "Einzelunternehmen",
    kammer: "Handwerkskammer Frankfurt-Rhein-Main",
    strasse: "Siemenstraße 15",
    plz: "63128",
    ort: "Dietzenbach",
    telefon: "+49 176 40384963",
    whatsapp: "4917640384963",
    email: "info@flc-automotive.de",
    instagram: "flcautomotive",
    hinweisAnfahrt: "Der Eingang liegt in der Karl-Benz-Straße. Fahren Sie durch das große Metalltor.",
    googleBewertungLink: "https://www.google.com/maps?cid=10779731825307987908",
    googleNote: "5,0",
    googleAnzahl: "28",
    steuernummer: "",
    ustId: "",
    iban: "",
    bic: "",
    bank: "",
  },
  oeffnungszeiten: {
    "1": [["08:30", "13:00"], ["14:00", "18:00"]],
    "2": [["08:30", "13:00"], ["14:00", "18:00"]],
    "3": [["08:30", "13:00"], ["14:00", "18:00"]],
    "4": [["08:30", "13:00"], ["14:00", "18:00"]],
    "5": [["08:30", "13:00"], ["14:00", "18:00"]],
    "6": [["09:00", "13:00"]],
    "7": [],
  },
  buchung: {
    aktiv: true,
    kapazitaet: 2,
    pufferMin: 15,
    rasterMin: 30,
    vorlaufStd: 2,
    maxTage: 42,
    haltenStd: 48,
    stornoFristStd: 24,
  },
  rechnung: {
    zahlungszielTage: 14,
    einleitung: "vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:",
    fusstext: "Alle Arbeiten unter Meisterverantwortung. Gewährleistung nach unseren AGB.",
  },
  benachrichtigung: { emails: [] },
  automatik: {
    erinnerung: { aktiv: true },
    bewertung: { aktiv: true, stundenNach: 3 },
    saison: { aktiv: true, fruehjahr: "03-15", herbst: "10-01" },
    datev: {
      aktiv: false,
      email: "",
      beraterNr: "",
      mandantNr: "",
      sachkontenlaenge: 4,
      erloeskonto19: "8400",
      kasse: "1000",
      bank: "1200",
      debitorSammel: "10000",
    },
  },
  module: { karriere: true, galerie: true, einlagerung: true, zeiterfassung: true, bewertungen: true },
  texte: {
    heroUnterzeile: "Inhabergeführt von Kfz-Meister Flavio Ciurli. Festpreise ab 40 €, Termin online wählen, Bestätigung meist am selben Tag.",
    ueberTitel: "Über die Werkstatt",
    ueberText:
      "FLC Automotive ist ein inhabergeführter Reifen- und Kfz-Servicebetrieb in Dietzenbach. Inhaber und Betriebsleiter ist Flavio Ciurli, Kfz-Meister. Er ist persönlich für alle technischen Abläufe, die Qualität und jedes Fahrzeug verantwortlich, das bei uns auf der Bühne steht.\n\nUnsere Schwerpunkte sind Reifenservice, Ölservice und Fahrzeugaufbereitung. Die Preise stehen vorher fest, und wir sagen Ihnen ehrlich, was Ihr Auto braucht und was nicht.",
    karriereText: "Kleiner Betrieb, kurze Wege, ein Meister, der selbst mit anpackt. Bewerben geht in zwei Minuten, ein Lebenslauf ist kein Muss.",
  },
  medien: { heroBild: "", heroVideo: "", ueberBild: "" },
  rechtstexte: { datenschutzUrl: "", agbUrl: "", datenschutzText: "", agbText: "" },
};

type Tief<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : Tief<T[K]>) : T[K] };

/** Gespeicherte Werte über die Standardwerte legen. Arrays (z. B. Öffnungszeiten eines Tages) ersetzen. */
export function zusammenfuehren<T>(basis: T, ueber: Tief<T> | undefined): T {
  if (!ueber || typeof ueber !== "object") return basis;
  const ergebnis: Record<string, unknown> = { ...(basis as Record<string, unknown>) };
  for (const [schluessel, wert] of Object.entries(ueber)) {
    const alt = ergebnis[schluessel];
    if (wert === undefined) continue;
    ergebnis[schluessel] =
      alt && typeof alt === "object" && !Array.isArray(alt) && wert && typeof wert === "object" && !Array.isArray(wert)
        ? zusammenfuehren(alt, wert as Tief<typeof alt>)
        : wert;
  }
  return ergebnis as T;
}

/** Einstellungen mit Standardwerten. Ohne Datenbank (lokale Vorschau) gelten nur die Standardwerte. */
export const einstellungen = cache(async (): Promise<Einstellungen> => {
  if (!KONFIGURIERT.supabaseAdmin) return STANDARD;
  const { data, error } = await db().from("einstellungen").select("daten").eq("id", 1).maybeSingle();
  if (error) {
    console.error("Einstellungen konnten nicht geladen werden", error);
    return STANDARD;
  }
  return zusammenfuehren(STANDARD, (data?.daten ?? {}) as Tief<Einstellungen>);
});

/** Speichert einen Bereich der Einstellungen (z. B. „buchung“). */
export async function einstellungenSpeichern<K extends keyof Einstellungen>(bereich: K, wert: Einstellungen[K]) {
  const { data } = await db().from("einstellungen").select("daten").eq("id", 1).single();
  const daten = { ...((data?.daten as Record<string, unknown>) ?? {}), [bereich]: wert };
  const { error } = await db().from("einstellungen").update({ daten }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;
