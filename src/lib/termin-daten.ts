import "server-only";
import { db } from "./supabase/admin";

/** Zusatzdaten zur Detailansicht eines Termins: Fotos (signierte Links), Rechnungen, Verlauf, Mitarbeiter. */
export async function terminZusatz(id: string) {
  const [fotos, rechnungen, verlauf, team] = await Promise.all([
    // „*“: die Spalte art (Arbeit oder Vorschaden) gibt es erst seit der Migration „werkstattauftrag“
    db().from("termin_fotos").select("*").eq("termin_id", id).order("erstellt_am"),
    db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, storno_zu").eq("termin_id", id).order("erstellt_am"),
    db().from("verlauf").select("text, erstellt_am, profil:profile(name)").eq("bezug_typ", "termin").eq("bezug_id", id).order("erstellt_am", { ascending: false }).limit(30),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
  ]);
  const pfade = (fotos.data ?? []).map((f) => f.pfad as string);
  const signiert = pfade.length ? (await db().storage.from("auftragsfotos").createSignedUrls(pfade, 3600)).data ?? [] : [];
  return {
    fotos: (fotos.data ?? []).map((f, i) => ({ id: f.id as string, url: signiert[i]?.signedUrl ?? "", notiz: f.notiz as string, art: (f.art as string | undefined) ?? "arbeit" })),
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

export type KvAmTermin = { id: string; nummer: string | null; status: string; summe_brutto_cent: number; gueltig_bis: string | null; erstellt_am: string; termin_id: string | null };

/**
 * Kostenvoranschläge rund um einen Termin: die verknüpften und die des Kunden, die sich noch verknüpfen lassen
 * (ohne Termin, nicht abgelehnt).
 */
export async function kvsZumTermin(terminId: string, kundeId: string | null): Promise<{ verknuepft: KvAmTermin[]; frei: KvAmTermin[] }> {
  const felder = "id, nummer, status, summe_brutto_cent, gueltig_bis, erstellt_am, termin_id";
  const [verknuepft, frei] = await Promise.all([
    db().from("kostenvoranschlaege").select(felder).eq("termin_id", terminId).order("erstellt_am"),
    kundeId
      ? db().from("kostenvoranschlaege").select(felder).eq("kunde_id", kundeId).is("termin_id", null).neq("status", "abgelehnt").order("erstellt_am", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  return { verknuepft: (verknuepft.data ?? []) as KvAmTermin[], frei: (frei.data ?? []) as KvAmTermin[] };
}

/** Offene Termine eines Kunden, an die sich ein Kostenvoranschlag hängen lässt (neueste zuerst). */
export async function termineFuerKv(kundeId: string | null) {
  if (!kundeId) return [];
  const { data } = await db()
    .from("termine")
    .select("id, nummer, beginn, leistung_name, status")
    .eq("kunde_id", kundeId)
    .in("status", ["angefragt", "bestaetigt", "erledigt"])
    .order("beginn", { ascending: false })
    .limit(20);
  return (data ?? []) as { id: string; nummer: number; beginn: string; leistung_name: string; status: string }[];
}

/**
 * Termin eintragen zu einem Kostenvoranschlag (?kv=…): Kunde, Fahrzeug und die Leistungen aus seinen Positionen
 * sind vorgewählt; nach dem Eintragen wird verknüpft. null, wenn er schon einen Termin hat.
 */
export async function kvVorlage(kvId: unknown) {
  if (typeof kvId !== "string" || !/^[0-9a-f-]{36}$/.test(kvId)) return null;
  const { data: k } = await db().from("kostenvoranschlaege").select("id, nummer, kunde_id, fahrzeug, positionen, termin_id").eq("id", kvId).maybeSingle();
  if (!k || k.termin_id) return null;
  const kennzeichen = String((k.fahrzeug as { kennzeichen?: string } | null)?.kennzeichen ?? "").replace(/[^A-Za-z0-9ÄÖÜäöü]/g, "").toUpperCase();
  const { data: fz } = k.kunde_id && kennzeichen ? await db().from("fahrzeuge").select("id").eq("kunde_id", k.kunde_id).eq("kennzeichen_norm", kennzeichen).maybeSingle() : { data: null };
  const ids = ((k.positionen ?? []) as { artikel_id?: string | null }[]).map((p) => p.artikel_id).filter((x): x is string => Boolean(x));
  return { id: k.id as string, nummer: (k.nummer as string | null) ?? "Entwurf", kundeId: k.kunde_id as string | null, fahrzeugId: (fz?.id as string | undefined) ?? null, leistungIds: ids };
}
