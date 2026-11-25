import "server-only";
import { belegungenMitPerson, planPersonen } from "./mitarbeiter";
import { konflikte } from "./planung";
import { db, dbRoh, DbFehler } from "./supabase/admin";
import { type GeplanterTermin, leistungIdsVon, TERMIN_FELDER } from "./termine";
import { berlin, berlinDatum, plusTage } from "./zeit";

/**
 * Was in der Werkstatt am Auftrag passiert: Arbeitszeit je Auftrag (Start/Stopp), Meldungen an das Büro
 * (Befund, Teil anfordern) und freie Aufträge, die sich jemand selbst nehmen kann. Die Tabellen kommen mit der
 * Migration „team_werkstatt“; Lesen in Seiten läuft über weich(), damit vorher nichts umfällt.
 */

export type AuftragZeit = { id: string; termin_id: string; profil_id: string; beginn: string; ende: string | null; profil?: { name: string } | null };
export type Meldung = {
  id: string;
  termin_id: string;
  profil_id: string | null;
  art: "befund" | "teil";
  text: string;
  menge: number;
  dringend: boolean;
  status: "offen" | "bestellt" | "erledigt";
  erstellt_am: string;
  erledigt_am: string | null;
  profil?: { name: string } | null;
  termin?: { id: string; beginn: string | null; leistung_name: string; fahrzeug: { kennzeichen: string } | null } | null;
};

export const MELDUNG_TEXT: Record<Meldung["art"], string> = { befund: "Befund", teil: "Teil" };
export const MELDUNG_STATUS: Record<Meldung["status"], string> = { offen: "offen", bestellt: "bestellt", erledigt: "erledigt" };

/** Läuft bei der Person gerade eine Auftragszeit? */
export async function laufendeZeit(profil: string): Promise<AuftragZeit | null> {
  const { data, error } = await dbRoh().from("auftrag_zeiten").select("*").eq("profil_id", profil).is("ende", null).maybeSingle();
  if (error) throw new DbFehler(error, { tabelle: "auftrag_zeiten" });
  return (data as AuftragZeit | null) ?? null;
}

/** Zeit am Auftrag starten. Ein anderer laufender Auftrag derselben Person wird vorher gestoppt. */
export async function zeitStarten(terminId: string, profil: string): Promise<void> {
  const laufend = await laufendeZeit(profil);
  if (laufend?.termin_id === terminId) return;
  if (laufend) await zeitStoppen(profil);
  await db().from("auftrag_zeiten").insert({ termin_id: terminId, profil_id: profil });
}

/** Laufende Auftragszeit der Person stoppen (optional nur, wenn sie zu diesem Termin gehört). */
export async function zeitStoppen(profil: string, terminId?: string): Promise<void> {
  let q = db().from("auftrag_zeiten").update({ ende: new Date().toISOString() }).eq("profil_id", profil).is("ende", null);
  if (terminId) q = q.eq("termin_id", terminId);
  await q;
}

/** Alle Zeiten eines oder mehrerer Aufträge (mit Namen). */
export async function auftragZeiten(terminIds: string[]): Promise<AuftragZeit[]> {
  if (!terminIds.length) return [];
  const { data } = await db().from("auftrag_zeiten").select("*, profil:profile(name)").in("termin_id", terminIds).order("beginn");
  return (data ?? []) as unknown as AuftragZeit[];
}

/** Meldungen zu einem Termin, neueste zuerst. */
export async function meldungenZumTermin(terminId: string): Promise<Meldung[]> {
  const { data } = await db().from("auftrag_meldungen").select("*, profil:profile!auftrag_meldungen_profil_id_fkey(name)").eq("termin_id", terminId).order("erstellt_am", { ascending: false });
  return (data ?? []) as unknown as Meldung[];
}

/** Offene Meldungen aller Aufträge (Büro): erst dringende, dann die ältesten. */
export async function offeneMeldungen(): Promise<Meldung[]> {
  const { data } = await db()
    .from("auftrag_meldungen")
    .select("*, profil:profile!auftrag_meldungen_profil_id_fkey(name), termin:termine(id, beginn, leistung_name, fahrzeug:fahrzeuge(kennzeichen))")
    .neq("status", "erledigt")
    .order("dringend", { ascending: false })
    .order("erstellt_am")
    .limit(200);
  return (data ?? []) as unknown as Meldung[];
}

/**
 * Freie Aufträge, die diese Person übernehmen kann: bestätigt, noch niemandem zugeteilt, ab jetzt bis
 * einschließlich `tage` Tage voraus, und die Person darf alle Leistungen, arbeitet zu der Zeit und hat keinen
 * anderen Termin (dieselbe Prüfung wie beim Zuteilen in der Verwaltung).
 */
export async function freieAuftraege(profil: string, tage = 2): Promise<GeplanterTermin[]> {
  const heute = berlinDatum();
  const bis = plusTage(heute, tage);
  const [{ data }, [person], belegungen] = await Promise.all([
    db().from("termine").select(TERMIN_FELDER).eq("status", "bestaetigt").is("zugewiesen_an", null).gte("beginn", new Date().toISOString()).lt("beginn", berlin(plusTage(bis, 1)).toISOString()).order("beginn").limit(40),
    planPersonen(heute, bis, true, [profil]),
    belegungenMitPerson(berlin(heute), berlin(plusTage(bis, 1))),
  ]);
  if (!person) return [];
  // Nach Zeitraum gefragt: Jeder Treffer hat eine Zeit.
  return ((data ?? []) as GeplanterTermin[]).filter((t) => !konflikte(person, { beginn: new Date(t.beginn), ende: new Date(t.ende), bis: new Date(t.belegt_bis), leistungIds: leistungIdsVon(t), id: t.id }, belegungen).length);
}

export type FahrzeugAkte = {
  fahrzeug: { kennzeichen: string; marke_modell: string; fin: string; km_stand: number | null; erstzulassung?: string } | null;
  frueher: { id: string; beginn: string; leistung_name: string; km_stand: number | null }[];
};

/** Fahrzeugdaten und frühere erledigte Arbeiten am selben Fahrzeug (Team-App, Auftrag). */
export async function fahrzeugAkte(fahrzeugId: string | null, ohne: string): Promise<FahrzeugAkte> {
  if (!fahrzeugId) return { fahrzeug: null, frueher: [] };
  const [{ data: f }, { data: t }] = await Promise.all([
    db().from("fahrzeuge").select("*").eq("id", fahrzeugId).maybeSingle(),
    db().from("termine").select("id, beginn, leistung_name, km_stand").eq("fahrzeug_id", fahrzeugId).eq("status", "erledigt").neq("id", ohne).order("beginn", { ascending: false }).limit(10),
  ]);
  return { fahrzeug: (f as FahrzeugAkte["fahrzeug"]) ?? null, frueher: (t ?? []) as FahrzeugAkte["frueher"] };
}
