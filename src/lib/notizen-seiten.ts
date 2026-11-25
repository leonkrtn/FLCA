import "server-only";
import type { NotizBezug } from "@/components/admin/notizen";
import { datumZeit } from "./format";
import type { Notiz } from "./notizen";
import { db } from "./supabase/admin";

/** Wer Erinnerungen bekommen kann: alle aktiven Konten mit Rolle. */
export async function notizTeam(): Promise<{ id: string; name: string }[]> {
  const { data } = await db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name");
  return (data ?? []) as { id: string; name: string }[];
}

/** Bezug fürs Formular: bei einer neuen Notiz aus ?kunde= / ?termin=, sonst aus der Notiz selbst. */
export async function notizBezug(notiz: Notiz | null, such: { kunde?: string; termin?: string }): Promise<NotizBezug> {
  const terminText = (t: { nummer: number; leistung_name: string; beginn: string | null }) => `Nr. ${t.nummer}, ${t.leistung_name}, ${t.beginn ? datumZeit(t.beginn) : "ohne Termin"}`;
  if (notiz) {
    return {
      kunde: notiz.kunde,
      termin: notiz.termin ? { id: notiz.termin.id, text: terminText(notiz.termin) } : null,
    };
  }
  const uuid = /^[0-9a-f-]{36}$/i;
  const [k, t] = await Promise.all([
    such.kunde && uuid.test(such.kunde) ? db().from("kunden").select("id, name").eq("id", such.kunde).maybeSingle() : { data: null },
    such.termin && uuid.test(such.termin)
      ? db().from("termine").select("id, nummer, leistung_name, beginn, kunde:kunden(id, name)").eq("id", such.termin).maybeSingle()
      : { data: null },
  ]);
  const termin = t.data as unknown as { id: string; nummer: number; leistung_name: string; beginn: string | null; kunde: { id: string; name: string } | null } | null;
  // Notiz zu einem Termin hängt automatisch auch am Kunden des Termins
  return {
    kunde: (k.data as { id: string; name: string } | null) ?? termin?.kunde ?? null,
    termin: termin ? { id: termin.id, text: terminText(termin) } : null,
  };
}
