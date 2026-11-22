import "server-only";
import { db, DbFehler, dbRoh } from "./supabase/admin";

export type Protokolleintrag = {
  id: number;
  ort: string;
  meldung: string;
  code: string | null;
  digest: string | null;
  anzahl: number;
  zuerst_am: string;
  zuletzt_am: string;
  erledigt_am: string | null;
};

const TABELLE_FEHLT = ["42P01", "PGRST205"];

/**
 * Einträge fürs Fehlerprotokoll, offene zuerst nach letztem Auftreten. Ohne Migration gibt es die Tabelle
 * noch nicht: dann `unmigriert`, damit die Seite sagt, was zu tun ist, statt selbst umzufallen.
 */
export async function protokollLaden(erledigte: boolean): Promise<{ eintraege: Protokolleintrag[]; unmigriert: boolean }> {
  let q = dbRoh().from("fehlerprotokoll").select("*").order("zuletzt_am", { ascending: false }).limit(200);
  q = erledigte ? q.not("erledigt_am", "is", null) : q.is("erledigt_am", null);
  const { data, error } = await q;
  if (error && TABELLE_FEHLT.includes(error.code)) return { eintraege: [], unmigriert: true };
  if (error) throw new DbFehler(error, { tabelle: "fehlerprotokoll" });
  return { eintraege: (data ?? []) as Protokolleintrag[], unmigriert: false };
}

/** Offene Fehler (für Menü und Übersicht). Fehlt die Tabelle, sind es eben keine. */
export async function offeneFehlerAnzahl(): Promise<number> {
  const { count, error } = await dbRoh().from("fehlerprotokoll").select("id", { count: "exact", head: true }).is("erledigt_am", null);
  return error ? 0 : (count ?? 0);
}

export async function alsErledigt(id: number | null): Promise<void> {
  const q = db().from("fehlerprotokoll").update({ erledigt_am: new Date().toISOString() }).is("erledigt_am", null);
  await (id === null ? q : q.eq("id", id));
}

/** Alte Einträge entfernen (aus dem Takt): erledigte nach 30 Tagen, alle nach 180 Tagen ohne neues Auftreten. */
export async function protokollAufraeumen(): Promise<number> {
  const tag = 86_400_000;
  const [a, b] = await Promise.all([
    db().from("fehlerprotokoll").delete({ count: "exact" }).lt("erledigt_am", new Date(Date.now() - 30 * tag).toISOString()),
    db().from("fehlerprotokoll").delete({ count: "exact" }).lt("zuletzt_am", new Date(Date.now() - 180 * tag).toISOString()),
  ]);
  return (a.count ?? 0) + (b.count ?? 0);
}
