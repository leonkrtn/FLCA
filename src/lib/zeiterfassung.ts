import "server-only";
import { db } from "./supabase/admin";
import { berlin, plusTage } from "./zeit";

export type Zeiteintrag = { id: string; beginn: string; ende: string | null; notiz: string };

/** Einträge eines Monats („JJJJ-MM“) mit Summe in Minuten. Laufende Einträge zählen bis jetzt. */
export async function monatszeiten(profilId: string, monat: string) {
  const von = berlin(`${monat}-01`);
  const [j, m] = monat.split("-").map(Number);
  const bis = berlin(plusTage(`${new Date(Date.UTC(j, m, 1)).toISOString().slice(0, 10)}`, 0));
  const { data } = await db()
    .from("zeiteintraege")
    .select("id, beginn, ende, notiz")
    .eq("profil_id", profilId)
    .gte("beginn", von.toISOString())
    .lt("beginn", bis.toISOString())
    .order("beginn");
  const eintraege = (data ?? []) as Zeiteintrag[];
  const minuten = eintraege.reduce((s, e) => s + ((e.ende ? new Date(e.ende).getTime() : Date.now()) - new Date(e.beginn).getTime()) / 60000, 0);
  return { eintraege, minuten: Math.round(minuten) };
}

export const stunden = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")} h`;
