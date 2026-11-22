import "server-only";
import { cache } from "react";
import { KONFIGURIERT } from "../env";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import type { Leistung } from "../termine";
import { berlinDatum } from "../zeit";
import { type Angebot, type GebuchterAngebotsPreis, mitAngebot } from "./preise";
import { fehlerMelden } from "../fehler";

/** Tabelle fehlt (Migration „angebote“ noch nicht ausgeführt): Dann gibt es eben keine Angebote. */
const TABELLE_FEHLT = ["42P01", "PGRST205"];

function alsAngebot(z: Record<string, unknown>): Angebot {
  return {
    ...(z as unknown as Angebot),
    wert: Number(z.wert),
    kategorien: Array.isArray(z.kategorien) ? (z.kategorien as string[]) : [],
    leistung_ids: Array.isArray(z.leistung_ids) ? (z.leistung_ids as string[]) : [],
  };
}

/** Alle Angebote für die Verwaltung, neueste Laufzeit zuerst. */
export async function alleAngebote(): Promise<{ angebote: Angebot[]; unmigriert: boolean }> {
  const { data, error } = await dbRoh().from("angebote").select("*").order("von", { ascending: false });
  if (error && TABELLE_FEHLT.includes(error.code)) return { angebote: [], unmigriert: true };
  if (error) throw new DbFehler(error);
  return { angebote: (data ?? []).map(alsAngebot), unmigriert: false };
}

export async function angebotLaden(id: string): Promise<Angebot | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().from("angebote").select("*").eq("id", id).maybeSingle();
  return data ? alsAngebot(data) : null;
}

/**
 * Was heute läuft. Ein Fehler darf die Website nie umwerfen: Dann gelten eben die Listenpreise.
 */
export const laufendeAngebote = cache(async (): Promise<Angebot[]> => {
  if (!KONFIGURIERT.supabaseAdmin) return [];
  const heute = berlinDatum();
  const { data, error } = await dbRoh().from("angebote").select("*").eq("aktiv", true).lte("von", heute).or(`bis.is.null,bis.gte.${heute}`).order("von");
  if (error) {
    if (!TABELLE_FEHLT.includes(error.code)) await fehlerMelden(new DbFehler(error, { tabelle: "angebote" }), "Laufende Angebote laden (Website zeigt Listenpreise)");
    return [];
  }
  return (data ?? []).map(alsAngebot);
});

/**
 * Hält am Termin fest, welche Leistungen zum Angebotspreis angefragt wurden. Stichtag ist der Tag der Anfrage:
 * Die Rechnung zum Termin nimmt diesen Preis, auch wenn das Angebot bis dahin abgelaufen ist.
 */
export async function angebotsPreiseFesthalten(terminId: string, leistungen: Leistung[]): Promise<void> {
  const angebote = await laufendeAngebote();
  if (!angebote.length) return;
  const heute = berlinDatum();
  const preise: Record<string, GebuchterAngebotsPreis> = {};
  for (const l of leistungen) {
    const p = mitAngebot(l, angebote, heute);
    if (p.angebot) preise[l.id] = { angebot_id: p.angebot.id, titel: p.angebot.titel, rabatt: p.angebot.rabatt, cent: p.preis_cent, listen_cent: p.angebot.listen_cent };
  }
  if (!Object.keys(preise).length) return;
  const { error } = await dbRoh().from("termine").update({ angebot_preise: preise }).eq("id", terminId);
  if (error) await fehlerMelden(new DbFehler(error, { tabelle: "termine" }), "Angebotspreise am Termin festhalten");
}
