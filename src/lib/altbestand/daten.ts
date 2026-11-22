import "server-only";
import { weich } from "../fehler";
import { DbFehler, dbRoh } from "../supabase/admin";
import { letzteFassungen, type MitFassungen } from "./fassungen";
import type { AltPosition } from "./lesen";

export type FruehereRechnung = {
  id: string;
  kunde_id: string | null;
  nummer: string;
  korrektur: boolean;
  rechnungsdatum: string | null;
  leistungsdatum: string | null;
  kennzeichen: string;
  km_stand: number | null;
  steuer: "19" | "kleinunternehmer";
  netto_cent: number | null;
  mwst_cent: number | null;
  brutto_cent: number | null;
  endbetrag_cent: number | null;
  regulaer_cent: number | null;
  zahlart: string;
  positionen: AltPosition[];
  datei: string;
};

const TABELLE_FEHLT = ["42P01", "PGRST205"];
const SPALTEN = "id, kunde_id, nummer, korrektur, rechnungsdatum, leistungsdatum, kennzeichen, km_stand, steuer, netto_cent, mwst_cent, brutto_cent, endbetrag_cent, regulaer_cent, zahlart, positionen, datei";

/**
 * Frühere Rechnungen eines Kunden (Datenübernahme), je Rechnung die letzte Fassung, jüngste zuerst. Ohne
 * Migration gibt es keine; ein anderer Fehler landet im Protokoll, die Kundenakte steht trotzdem.
 */
export async function fruehereRechnungen(kundeId: string): Promise<MitFassungen<FruehereRechnung>[]> {
  return weich(
    async () => {
      const { data, error } = await dbRoh().from("alt_rechnungen").select(SPALTEN).eq("kunde_id", kundeId).limit(2000);
      if (error && TABELLE_FEHLT.includes(error.code)) return [];
      if (error) throw new DbFehler(error, { tabelle: "alt_rechnungen" });
      return letzteFassungen((data ?? []) as FruehereRechnung[]);
    },
    [],
    "Frühere Rechnungen in der Kundenakte",
  );
}

export type FruehereMitKunde = FruehereRechnung & { kunde: { id: string; name: string } | null };

/** Alle früheren Rechnungen für die Rechnungsliste (Reiter „Frühere“), mit Kunde, letzte Fassungen. */
export async function alleFrueherenRechnungen(): Promise<MitFassungen<FruehereMitKunde>[]> {
  return weich(
    async () => {
      const { data, error } = await dbRoh().from("alt_rechnungen").select(`${SPALTEN}, kunde:kunden(id, name)`).limit(10000);
      if (error && TABELLE_FEHLT.includes(error.code)) return [];
      if (error) throw new DbFehler(error, { tabelle: "alt_rechnungen" });
      return letzteFassungen((data ?? []) as unknown as FruehereMitKunde[]);
    },
    [],
    "Frühere Rechnungen in der Rechnungsliste",
  );
}

/** Höchste frühere Rechnungsnummer (Grundnummer) mit Datum, als Anhalt für den Nummernkreis. */
export async function letzteFruehereNummer(): Promise<{ nummer: string; rechnungsdatum: string | null } | null> {
  const liste = await alleFrueherenRechnungen();
  const zahl = (n: string) => Number(n.split(".")[0].replace(/\D/g, "")) || 0;
  return liste.reduce<{ nummer: string; rechnungsdatum: string | null } | null>((max, r) => (!max || zahl(r.nummer) > zahl(max.nummer) ? { nummer: r.nummer.split(".")[0], rechnungsdatum: r.rechnungsdatum } : max), null);
}
