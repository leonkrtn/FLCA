import "server-only";
import { einstellungen, type Fenster } from "./einstellungen";
import type { PersonBelegung, PlanAbwesenheit, PlanPerson, Woche } from "./planung";
import { db, pruefe } from "./supabase/admin";
import { berlin, plusTage } from "./zeit";

/**
 * Daten der Mitarbeiterplanung aus der Datenbank. Gerechnet wird in planung.ts (ohne Datenbank, getestet).
 */

type Profil = { id: string; name: string; email: string; nimmt_auftraege: boolean; aktiv: boolean; erstellt_am: string };

/**
 * Personen für die Planung im Datumsbereich [von, bis]. `nurAuftraege`: nur wer Aufträge annimmt (Website,
 * automatische Zuteilung). Die Farbe hängt an der Reihenfolge der Anlage, damit sie sich nicht verschiebt,
 * wenn jemand umbenannt wird.
 */
export async function planPersonen(von: string, bis: string, nurAuftraege = true): Promise<PlanPerson[]> {
  let q = db().from("profile").select("id, name, email, nimmt_auftraege, aktiv, erstellt_am").eq("aktiv", true).not("rolle", "is", null).order("erstellt_am");
  if (nurAuftraege) q = q.eq("nimmt_auftraege", true);
  const profile = pruefe<Profil[]>(await q);
  if (!profile.length) return [];
  const ids = profile.map((p) => p.id);
  const [zeiten, ausnahmen, abw, sperren, reihenfolge, { oeffnungszeiten }] = await Promise.all([
    db().from("arbeitszeiten").select("profil_id, wochentag, beginn, ende, woche").in("profil_id", ids),
    db().from("arbeitszeit_ausnahmen").select("profil_id, datum, fenster").in("profil_id", ids).gte("datum", von).lte("datum", bis),
    db().from("abwesenheiten").select("profil_id, art, von, bis, von_zeit, bis_zeit").in("profil_id", ids).eq("status", "genehmigt").lte("von", bis).gte("bis", von),
    db().from("leistung_sperren").select("profil_id, leistung_id").in("profil_id", ids),
    farbReihenfolge(),
    einstellungen(),
  ]);
  // Wer noch keinen eigenen Plan hat, arbeitet zu den Öffnungszeiten. Sonst nähme das Häkchen „nimmt Aufträge
  // an“ ohne eingetragene Zeiten der Website alle freien Termine weg.
  const ausOeffnung = Object.entries(oeffnungszeiten).flatMap(([tag, fenster]) => fenster.map(([beginn, ende]) => ({ wochentag: Number(tag), beginn, ende, woche: "jede" as Woche })));
  return profile.map((p) => {
    const eigen = (zeiten.data ?? [])
      .filter((z) => z.profil_id === p.id)
      .map((z) => ({ wochentag: z.wochentag as number, beginn: z.beginn as string, ende: z.ende as string, woche: (z.woche as Woche | undefined) ?? "jede" }));
    return {
      id: p.id,
      name: p.name || p.email,
      farbe: reihenfolge.indexOf(p.id),
      nimmtAuftraege: p.nimmt_auftraege,
      planAusOeffnung: !eigen.length,
      wochenplan: eigen.length ? eigen : ausOeffnung,
      ausnahmen: Object.fromEntries((ausnahmen.data ?? []).filter((a) => a.profil_id === p.id).map((a) => [a.datum as string, a.fenster as Fenster[]])),
      abwesenheiten: (abw.data ?? []).filter((a) => a.profil_id === p.id) as unknown as PlanAbwesenheit[],
      gesperrt: (sperren.data ?? []).filter((s) => s.profil_id === p.id).map((s) => s.leistung_id as string),
    };
  });
}

/** Reihenfolge für die Farben: alle, die Aufträge annehmen, nach Anlage. */
async function farbReihenfolge(): Promise<string[]> {
  const { data } = await db().from("profile").select("id").eq("nimmt_auftraege", true).order("erstellt_am");
  return (data ?? []).map((p) => p.id as string);
}

/** Nimmt überhaupt jemand Aufträge an? Sonst gilt wie früher nur die Zahl der Arbeitsplätze. */
export async function planungAktiv(): Promise<boolean> {
  const { count } = await db().from("profile").select("id", { count: "exact", head: true }).eq("nimmt_auftraege", true).eq("aktiv", true);
  return (count ?? 0) > 0;
}

/**
 * Belegte Zeiten mit Person: bestätigte Termine und Anfragen, deren Haltezeit noch läuft (wie belegung_max und
 * person_belegt in der Datenbank).
 */
export async function belegungenMitPerson(von: Date, bis: Date): Promise<(PersonBelegung & { id: string; titel: string })[]> {
  const termine = await db()
    .from("termine")
    .select("id, beginn, belegt_bis, status, halten_bis, zugewiesen_an, leistung_name")
    .in("status", ["angefragt", "bestaetigt"])
    .lt("beginn", bis.toISOString())
    .gt("belegt_bis", von.toISOString());
  const jetzt = Date.now();
  type Zeile = { id: string; beginn: string; belegt_bis: string; status: string; halten_bis: string | null; zugewiesen_an: string | null; leistung_name: string };
  return pruefe<Zeile[]>(termine)
    .filter((t) => t.status === "bestaetigt" || !t.halten_bis || new Date(t.halten_bis).getTime() > jetzt)
    .map((t) => ({ id: t.id, beginn: new Date(t.beginn).getTime(), bis: new Date(t.belegt_bis).getTime(), gewicht: 1, profil: t.zugewiesen_an, titel: t.leistung_name }));
}

/** Belegungen eines ganzen Tages (Berliner Datum). */
export const belegungenAm = (datum: string) => belegungenMitPerson(berlin(datum), berlin(plusTage(datum, 1)));

/** Namen der Leistungen nach ID (für lesbare Warnungen). */
export async function leistungNamen(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await db().from("leistungen").select("id, name").in("id", ids);
  return Object.fromEntries((data ?? []).map((l) => [l.id as string, l.name as string]));
}

/**
 * Bestätigte künftige Termine ohne Mitarbeiter (Zähler „Kalender“ in der Verwaltung). Nur, wenn die Planung läuft:
 * Sonst hätte jeder Termin keinen und der Zähler wäre nur Lärm.
 */
export async function ohneMitarbeiterAnzahl(): Promise<number> {
  try {
    if (!(await planungAktiv())) return 0;
    const { count } = await db()
      .from("termine")
      .select("id", { count: "exact", head: true })
      .is("zugewiesen_an", null)
      // Nur bestätigte: Anfragen bekommen beim Annehmen automatisch jemanden und zählen schon unter „Termine“.
      .eq("status", "bestaetigt")
      .gte("beginn", new Date().toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}
