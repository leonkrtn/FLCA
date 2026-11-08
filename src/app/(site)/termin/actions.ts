"use server";

import { type Ergebnis, istEmail, istSpam, istTelefon, sicher, text, werteAus } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { anfrageStellen, TerminFehler } from "@/lib/termine";
import { istDatum } from "@/lib/zeit";
import { datumLangText, zeit } from "@/lib/format";

export async function anfrageSenden(_vorher: Ergebnis, formData: FormData): Promise<Ergebnis> {
  return sicher(formData, async () => {
    const eingabe = {
      leistungId: text(formData, "leistung", 40),
      datum: text(formData, "datum", 10),
      uhrzeit: text(formData, "uhrzeit", 5),
      name: text(formData, "name", 120),
      email: text(formData, "email", 160).toLowerCase(),
      telefon: text(formData, "telefon", 40),
      kennzeichen: text(formData, "kennzeichen", 16),
      fahrzeug: text(formData, "fahrzeug", 120),
      notiz: text(formData, "notiz", 1500),
    };

    const fehler: Record<string, string> = {};
    if (!eingabe.name) fehler.name = "Bitte Ihren Namen angeben.";
    if (!istTelefon(eingabe.telefon)) fehler.telefon = "Bitte eine Telefonnummer angeben, unter der wir Sie erreichen.";
    if (!istEmail(eingabe.email)) fehler.email = "Bitte eine gültige E-Mail-Adresse angeben. Dorthin schicken wir die Bestätigung.";
    // Bewusst großzügig: auch ausländische und Saisonkennzeichen sollen durchgehen.
    if (!/^[\p{L}\d][\p{L}\d -]{1,14}$/u.test(eingabe.kennzeichen) || !/\d/.test(eingabe.kennzeichen)) {
      fehler.kennzeichen = "Bitte das Kennzeichen angeben, z. B. OF-AB 123.";
    }
    if (!istDatum(eingabe.datum) || !/^\d{2}:\d{2}$/.test(eingabe.uhrzeit)) fehler.zeit = "Bitte einen Termin auswählen.";
    if (Object.keys(fehler).length) return { status: "fehler", fehler, werte: werteAus(formData), versuch: Date.now() };

    if (istSpam(formData)) return { status: "ok", daten: { spam: true } };
    const limit = await imLimit("termin");
    if (limit !== "ok") {
      return {
        status: "fehler",
        meldung: limit === "limit" ? "Zu viele Anfragen in kurzer Zeit. Bitte rufen Sie uns an." : "Die Anfrage konnte gerade nicht geprüft werden. Bitte noch einmal versuchen.",
        werte: werteAus(formData),
        versuch: Date.now(),
      };
    }

    try {
      const termin = await anfrageStellen(eingabe);
      return {
        status: "ok",
        daten: { token: termin.token, leistung: termin.leistung_name, wann: `${datumLangText(termin.beginn)}, ${zeit(termin.beginn)} Uhr`, email: eingabe.email },
      };
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message, fehler: { zeit: error.message }, werte: werteAus(formData), versuch: Date.now() };
      throw error;
    }
  });
}
