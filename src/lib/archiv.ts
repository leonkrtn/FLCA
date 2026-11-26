import "server-only";
import type { Benutzer } from "./auth";
import { darfMail, zugang } from "./mail/postfach";
import { db } from "./supabase/admin";

/**
 * Archiv (Einstellungen → Archiv): was dem Kunden schon geschickt wurde und aus dem Alltag verschwinden soll,
 * aber als Handels- und Geschäftsbrief aufbewahrt werden muss. Hinein kommt es nur von selbst: Termin löschen
 * (verschickte Kostenvoranschläge, verschickter oder erteilter Werkstattauftrag, `termin_loeschen`) und Mails, die
 * aus dem Papierkorb gelöscht werden (`aufbewahren` in `mail/postfach.ts`). Nur lesen, nichts ändern.
 */

export type ArchivKv = { id: string; nummer: string | null; status: string; empfaenger: { name?: string; firma?: string }; summe_brutto_cent: number; datum: string | null; archiviert_am: string };
export type ArchivAuftrag = {
  id: string;
  auftrag_nummer: string;
  kunde_name: string;
  kennzeichen: string;
  summe_brutto_cent: number;
  erteilt_am: string | null;
  gesendet_am: string | null;
  pdf_pfad: string | null;
  archiviert_am: string;
};
export type ArchivMail = { id: string; postfach: string | null; richtung: string; von: string; von_name: string | null; an: string[]; betreff: string; erstellt_am: string; aufbewahrt_am: string };

export async function archivLaden(b: Pick<Benutzer, "id" | "rolle">): Promise<{ kvs: ArchivKv[]; auftraege: ArchivAuftrag[]; mails: ArchivMail[] }> {
  const z = await zugang(b);
  const [{ data: kvs }, { data: auftraege }, { data: mails }] = await Promise.all([
    db().from("kostenvoranschlaege").select("id, nummer, status, empfaenger, summe_brutto_cent, datum, archiviert_am").not("archiviert_am", "is", null).order("archiviert_am", { ascending: false }).limit(300),
    db().from("archiv_auftraege").select("id, auftrag_nummer, kunde_name, kennzeichen, summe_brutto_cent, erteilt_am, gesendet_am, pdf_pfad, archiviert_am").order("archiviert_am", { ascending: false }).limit(300),
    db().from("mails").select("id, postfach, richtung, von, von_name, an, betreff, erstellt_am, aufbewahrt_am").not("aufbewahrt_am", "is", null).order("erstellt_am", { ascending: false }).limit(500),
  ]);
  return {
    kvs: (kvs ?? []) as ArchivKv[],
    auftraege: (auftraege ?? []) as ArchivAuftrag[],
    // Persönliche Postfächer bleiben privat, auch im Archiv: jeder sieht nur, was er im Postfach sehen durfte.
    mails: ((mails ?? []) as ArchivMail[]).filter((m) => darfMail(z, m)),
  };
}

/** Kurzlebiger Link zum PDF eines archivierten Werkstattauftrags. */
export async function archivAuftragLink(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().from("archiv_auftraege").select("pdf_pfad").eq("id", id).maybeSingle();
  if (!data?.pdf_pfad) return null;
  const { data: link } = await db().storage.from("archiv").createSignedUrl(data.pdf_pfad as string, 60);
  return link?.signedUrl ?? null;
}
