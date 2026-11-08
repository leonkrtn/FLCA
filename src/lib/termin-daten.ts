import "server-only";
import { db } from "./supabase/admin";

/** Zusatzdaten zur Detailansicht eines Termins: Fotos (signierte Links), Rechnungen, Verlauf, Mitarbeiter. */
export async function terminZusatz(id: string) {
  const [fotos, rechnungen, verlauf, team] = await Promise.all([
    db().from("termin_fotos").select("id, pfad, notiz, erstellt_am").eq("termin_id", id).order("erstellt_am"),
    db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, storno_zu").eq("termin_id", id).order("erstellt_am"),
    db().from("verlauf").select("text, erstellt_am, profil:profile(name)").eq("bezug_typ", "termin").eq("bezug_id", id).order("erstellt_am", { ascending: false }).limit(30),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
  ]);
  const pfade = (fotos.data ?? []).map((f) => f.pfad as string);
  const signiert = pfade.length ? (await db().storage.from("auftragsfotos").createSignedUrls(pfade, 3600)).data ?? [] : [];
  return {
    fotos: (fotos.data ?? []).map((f, i) => ({ id: f.id as string, url: signiert[i]?.signedUrl ?? "", notiz: f.notiz as string })),
    rechnungen: (rechnungen.data ?? []) as { id: string; nummer: string | null; status: string; summe_brutto_cent: number; storno_zu: string | null }[],
    verlauf: (verlauf.data ?? []) as unknown as { text: string; erstellt_am: string; profil: { name: string } | null }[],
    team: (team.data ?? []) as { id: string; name: string }[],
  };
}
