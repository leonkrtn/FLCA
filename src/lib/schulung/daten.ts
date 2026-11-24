import "server-only";
import { db, DbFehler, dbRoh, type Zeile } from "../supabase/admin";
import { bilderIn } from "./inhalt";

/** Tabelle fehlt (Migration „schulung“ noch nicht ausgeführt) */
const TABELLE_FEHLT = ["42P01", "PGRST205"];

export type Kategorie = { id: string; name: string; sortierung: number };

export type Lektion = {
  id: string;
  kategorie_id: string;
  titel: string;
  kurz: string;
  inhalt: string;
  video_url: string | null;
  dauer_min: number | null;
  schlagwoerter: string[];
  werkzeug: string;
  sicherheit: string;
  leistung_ids: string[];
  siehe_auch: string[];
  veroeffentlicht: boolean;
  archiviert_am: string | null;
  sortierung: number;
  aktualisiert_am: string;
};

const liste = (x: unknown): string[] => (Array.isArray(x) ? (x as string[]) : []);

function alsLektion(z: Zeile): Lektion {
  return {
    ...(z as Lektion),
    kurz: z.kurz ?? "",
    inhalt: z.inhalt ?? "",
    werkzeug: z.werkzeug ?? "",
    sicherheit: z.sicherheit ?? "",
    schlagwoerter: liste(z.schlagwoerter),
    leistung_ids: liste(z.leistung_ids),
    siehe_auch: liste(z.siehe_auch),
  };
}

/** Für die Team-App: nur, was veröffentlicht und nicht archiviert ist. */
export const sichtbar = (l: Lektion) => l.veroeffentlicht && !l.archiviert_am;

/**
 * Alle Kategorien und Lektionen, in ihrer Reihenfolge. `unmigriert`: Die Tabellen gibt es noch nicht, dann zeigt
 * die Verwaltung einen Hinweis und die Team-App eine leere Schulung, statt umzufallen.
 */
export async function schulungLaden(): Promise<{ kategorien: Kategorie[]; lektionen: Lektion[]; unmigriert: boolean }> {
  const [k, l] = await Promise.all([
    dbRoh().from("schulung_kategorien").select("id, name, sortierung").order("sortierung").order("erstellt_am"),
    dbRoh().from("schulung_lektionen").select("*").order("sortierung").order("erstellt_am"),
  ]);
  const fehler = k.error ?? l.error;
  if (fehler && TABELLE_FEHLT.includes(fehler.code)) return { kategorien: [], lektionen: [], unmigriert: true };
  if (k.error) throw new DbFehler(k.error, { tabelle: "schulung_kategorien" });
  if (l.error) throw new DbFehler(l.error, { tabelle: "schulung_lektionen" });
  return { kategorien: (k.data ?? []) as Kategorie[], lektionen: (l.data ?? []).map(alsLektion), unmigriert: false };
}

export async function lektionLaden(id: string): Promise<Lektion | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().from("schulung_lektionen").select("*").eq("id", id).maybeSingle();
  return data ? alsLektion(data) : null;
}

/** Veröffentlichte Lektionen zu den Leistungen eines Auftrags (für „Anleitung“ am Auftrag in der Team-App). */
export async function lektionenZuLeistungen(leistungIds: string[]): Promise<Pick<Lektion, "id" | "titel" | "dauer_min" | "video_url">[]> {
  if (!leistungIds.length) return [];
  const { data, error } = await dbRoh()
    .from("schulung_lektionen")
    .select("id, titel, dauer_min, video_url, sortierung")
    .overlaps("leistung_ids", leistungIds)
    .eq("veroeffentlicht", true)
    .is("archiviert_am", null)
    .order("sortierung");
  if (error && TABELLE_FEHLT.includes(error.code)) return [];
  if (error) throw new DbFehler(error, { tabelle: "schulung_lektionen" });
  return (data ?? []) as Pick<Lektion, "id" | "titel" | "dauer_min" | "video_url">[];
}

/**
 * Signierte Adressen für die Bilder eines Textes (privater Speicher). Eine Stunde gültig, das reicht weit über
 * die 30 s hinaus, die der Router eine Seite hält.
 */
export async function bildAdressen(inhalt: string): Promise<Record<string, string>> {
  const pfade = bilderIn(inhalt);
  if (!pfade.length) return {};
  const { data } = await db().storage.from("schulung").createSignedUrls(pfade, 3600);
  const aus: Record<string, string> = {};
  for (const s of data ?? []) if (s.path && s.signedUrl) aus[s.path] = s.signedUrl;
  return aus;
}
