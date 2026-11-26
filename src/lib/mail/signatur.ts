import "server-only";
import { cache } from "react";
import { einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { standardAbsender } from "../services/email";
import { db } from "../supabase/admin";
import { oeffnungszeitenKurz, type SignaturDaten, signaturHtml, signaturText } from "./inhalt";

/**
 * Daten der Signatur. Aufbau gilt für alle (Einstellungen → E-Mail → Signatur), Name, Jobbezeichnung und
 * Telefon je Person pflegt der Inhaber. Ohne Person (kein Profil gefunden) unterschreibt der Inhaber aus den
 * Firmendaten.
 */
async function signaturDaten(profilId: string | null, adresse: string): Promise<SignaturDaten> {
  const [{ mail, firma, oeffnungszeiten }, p] = await Promise.all([
    einstellungen(),
    profilId ? db().from("profile").select("name, jobbezeichnung, signatur_telefon").eq("id", profilId).maybeSingle().then((r) => r.data) : null,
  ]);
  const s = mail.signatur;
  const website = ENV.siteUrl.startsWith("https://") ? ENV.siteUrl : "";
  return {
    gruss: s.gruss,
    name: (p?.name as string) || firma.inhaber || firma.name,
    job: p ? ((p.jobbezeichnung as string) ?? "") : firma.titel,
    telefon: (p?.signatur_telefon as string) || firma.telefon,
    email: adresse,
    firma,
    website: s.website ? website : "",
    oeffnungszeiten: s.oeffnungszeiten ? oeffnungszeitenKurz(oeffnungszeiten) : "",
    // Bild von der eigenen Website (nur über https, sonst blenden Mailprogramme es aus)
    logoUrl: s.logo && website ? `${website}/mail/logo.png` : "",
    pflichtangaben: s.pflichtangaben,
  };
}

/**
 * Signatur einer Person für eine Absenderadresse. Auch aus dem Firmenpostfach unterschreibt die Person, die
 * schreibt (wie in Outlook mit einem freigegebenen Postfach).
 */
export async function signaturFuer(profilId: string, adresse: string): Promise<string> {
  return signaturHtml(await signaturDaten(profilId, adresse));
}

/**
 * Signatur der automatischen Mails: dieselbe wie bei selbst geschriebenen, unterschrieben vom Inhaber, mit der
 * Absenderadresse der Systemmails. Einmal je Anfrage geladen.
 */
export const automatischeSignatur = cache(async (): Promise<{ html: string; text: string }> => {
  const [{ adresse }, { data }] = await Promise.all([
    standardAbsender(),
    db().from("profile").select("id").eq("rolle", "inhaber").eq("aktiv", true).order("erstellt_am").limit(1),
  ]);
  const d = await signaturDaten((data?.[0]?.id as string | undefined) ?? null, adresse);
  return { html: signaturHtml(d), text: signaturText(d) };
});
