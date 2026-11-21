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

/**
 * Rechnungen, die sich an einen Termin hängen lassen: noch ohne Termin, keine Stornorechnung, nicht
 * storniert. Vom Kunden des Termins; hat der Termin keinen Kunden, die jüngsten.
 */
export async function freieRechnungen(kundeId: string | null) {
  let q = db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, erstellt_am, empfaenger").is("termin_id", null).is("storno_zu", null).neq("status", "storniert");
  if (kundeId) q = q.eq("kunde_id", kundeId);
  const { data } = await q.order("erstellt_am", { ascending: false }).limit(30);
  return (data ?? []) as { id: string; nummer: string | null; status: string; summe_brutto_cent: number; erstellt_am: string; empfaenger: { name?: string; firma?: string } | null }[];
}
