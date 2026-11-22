import "server-only";
import { db } from "./supabase/admin";
import { berlin, plusTage } from "./zeit";

export type Zeiteintrag = { id: string; beginn: string; ende: string | null; notiz: string; pause_minuten?: number; pause_seit?: string | null };

/**
 * Gearbeitete Minuten eines Eintrags: von Kommt bis Geht (laufend: bis jetzt) ohne Pausen. Eine laufende Pause
 * zählt bis jetzt mit. pause_* gibt es erst seit der Migration „team_werkstatt“, vorher ohne Pausen.
 */
export function nettoMinuten(e: Zeiteintrag, jetzt = Date.now()): number {
  const ende = e.ende ? new Date(e.ende).getTime() : jetzt;
  const laufend = e.pause_seit && !e.ende ? Math.max(0, jetzt - new Date(e.pause_seit).getTime()) / 60000 : 0;
  return Math.max(0, (ende - new Date(e.beginn).getTime()) / 60000 - (e.pause_minuten ?? 0) - laufend);
}

/** Einträge eines Monats („JJJJ-MM“) mit Summe in Minuten (ohne Pausen). Laufende Einträge zählen bis jetzt. */
export async function monatszeiten(profilId: string, monat: string) {
  const von = berlin(`${monat}-01`);
  const [j, m] = monat.split("-").map(Number);
  const bis = berlin(plusTage(`${new Date(Date.UTC(j, m, 1)).toISOString().slice(0, 10)}`, 0));
  // „*“: pause_minuten und pause_seit gibt es erst nach der Migration „team_werkstatt“
  const { data } = await db().from("zeiteintraege").select("*").eq("profil_id", profilId).gte("beginn", von.toISOString()).lt("beginn", bis.toISOString()).order("beginn");
  const eintraege = (data ?? []) as Zeiteintrag[];
  const minuten = eintraege.reduce((s, e) => s + nettoMinuten(e), 0);
  return { eintraege, minuten: Math.round(minuten) };
}

/** Stunden als „7:30 h“; negative Werte (Saldo) mit Minus. */
export const stunden = (min: number) => {
  const m = Math.round(Math.abs(min));
  return `${min < 0 && m ? "−" : ""}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
};

/** Saldo mit Vorzeichen: „+2:15 h“, „−0:30 h“. */
export const saldo = (min: number) => (Math.round(min) > 0 ? `+${stunden(min)}` : stunden(min));
