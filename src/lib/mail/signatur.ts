import "server-only";
import { einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { db } from "../supabase/admin";
import { oeffnungszeitenKurz, signaturHtml } from "./inhalt";

/**
 * Signatur einer Person für eine Absenderadresse. Aufbau gilt für alle (Einstellungen → E-Mail → Signatur),
 * Name, Jobbezeichnung und Telefon je Person pflegt der Inhaber. Auch aus dem Firmenpostfach unterschreibt
 * die Person, die schreibt (wie in Outlook mit einem freigegebenen Postfach).
 */
export async function signaturFuer(profilId: string, adresse: string): Promise<string> {
  const [{ mail, firma, oeffnungszeiten }, { data: p }] = await Promise.all([
    einstellungen(),
    db().from("profile").select("name, jobbezeichnung, signatur_telefon").eq("id", profilId).maybeSingle(),
  ]);
  const s = mail.signatur;
  const website = ENV.siteUrl.startsWith("https://") ? ENV.siteUrl : "";
  return signaturHtml({
    gruss: s.gruss,
    name: (p?.name as string) || firma.name,
    job: (p?.jobbezeichnung as string) ?? "",
    telefon: (p?.signatur_telefon as string) || firma.telefon,
    email: adresse,
    firma,
    website: s.website ? website : "",
    oeffnungszeiten: s.oeffnungszeiten ? oeffnungszeitenKurz(oeffnungszeiten) : "",
    // Bild von der eigenen Website (nur über https, sonst blenden Mailprogramme es aus)
    logoUrl: s.logo && website ? `${website}/mail/logo.png` : "",
    pflichtangaben: s.pflichtangaben,
  });
}
