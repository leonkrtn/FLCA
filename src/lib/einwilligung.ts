import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { melden, verlauf } from "./ereignisse";
import { db, DbFehler } from "./supabase/admin";

/**
 * Einwilligungen des Kunden (Spalten an `kunden`, mit Zeitpunkt; null = nicht erteilt oder widerrufen):
 * - `whatsapp_ok_am`: Die Werkstatt darf ihn per WhatsApp anschreiben.
 * - `erinnerung_mail_ok_am`: Erinnerungen (HU, Reifenwechsel) und die Bitte um eine Bewertung. Beides ist Werbung
 *   (BGH VI ZR 225/17 zur Bewertungsbitte) und geht ohne diese Einwilligung nicht raus (§ 7 Abs. 2 Nr. 2 UWG).
 * Erteilt am Kundenbildschirm oder von der Werkstatt in der Kundenakte eingetragen (z. B. am Telefon gefragt),
 * widerrufen dort oder über den Abmeldelink in jeder solchen Mail.
 */
export type Einwilligung = "whatsapp" | "erinnerung";

const SPALTE: Record<Einwilligung, "whatsapp_ok_am" | "erinnerung_mail_ok_am"> = { whatsapp: "whatsapp_ok_am", erinnerung: "erinnerung_mail_ok_am" };
const NAME: Record<Einwilligung, string> = { whatsapp: "WhatsApp", erinnerung: "Erinnerungen und Bitte um Bewertung" };

export async function einwilligungSetzen(kundeId: string, art: Einwilligung, erteilt: boolean, wer: { benutzer?: string | null; wie: string }): Promise<void> {
  const { data, error } = await db()
    .from("kunden")
    .update({ [SPALTE[art]]: erteilt ? new Date().toISOString() : null })
    .eq("id", kundeId)
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) return;
  await verlauf("kunde", kundeId, `Einwilligung „${NAME[art]}“ ${erteilt ? "erteilt" : "widerrufen"} (${wer.wie})`, wer.benutzer ?? null);
  await melden("kunde.geaendert", { kunde_id: kundeId, einwilligung: art, erteilt });
}

/** Schlüssel für den Abmeldelink: ohne eigene Spalte, aus der Kundennummer und dem geheimen Schlüssel des Servers. */
function abmeldeSchluessel(kundeId: string): string {
  return createHmac("sha256", ENV.supabaseSecretKey || ENV.cronSecret).update(`abmelden:${kundeId}`).digest("hex").slice(0, 32);
}

export function abmeldeLink(kundeId: string): string {
  return `${ENV.siteUrl}/abmelden/${kundeId}/${abmeldeSchluessel(kundeId)}`;
}

export function abmeldeSchluesselPruefen(kundeId: string, schluessel: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(kundeId) || !/^[0-9a-f]{32}$/.test(schluessel)) return false;
  return timingSafeEqual(Buffer.from(abmeldeSchluessel(kundeId)), Buffer.from(schluessel));
}
