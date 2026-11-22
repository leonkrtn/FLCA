import "server-only";
import { weich } from "../fehler";
import { DbFehler, dbRoh } from "../supabase/admin";
import type { AltPosition } from "./lesen";

export type FruehereRechnung = {
  id: string;
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

/**
 * Frühere Rechnungen eines Kunden (Datenübernahme), jüngste zuerst. Ohne Migration gibt es keine; ein
 * anderer Fehler landet im Protokoll, die Kundenakte steht trotzdem.
 */
export async function fruehereRechnungen(kundeId: string): Promise<FruehereRechnung[]> {
  return weich(
    async () => {
      const { data, error } = await dbRoh()
        .from("alt_rechnungen")
        .select("id, nummer, korrektur, rechnungsdatum, leistungsdatum, kennzeichen, km_stand, steuer, netto_cent, mwst_cent, brutto_cent, endbetrag_cent, regulaer_cent, zahlart, positionen, datei")
        .eq("kunde_id", kundeId)
        .order("rechnungsdatum", { ascending: false })
        .order("nummer", { ascending: false });
      if (error && TABELLE_FEHLT.includes(error.code)) return [];
      if (error) throw new DbFehler(error, { tabelle: "alt_rechnungen" });
      return (data ?? []) as FruehereRechnung[];
    },
    [],
    "Frühere Rechnungen in der Kundenakte",
  );
}
