import { createHash } from "node:crypto";
import { ENV, KONFIGURIERT } from "./env";

/**
 * Meldet einen Fehler ins Fehlerprotokoll (Einstellungen → Fehler) und ins Server-Log.
 *
 * Bewusst ohne `server-only` und ohne den Supabase-Client: `instrumentation.ts` ruft das auf, und dort gelten
 * die Regeln der Server Components nicht. Das Melden selbst darf nie werfen, sonst verdeckt es den
 * eigentlichen Fehler.
 */
export async function fehlerMelden(fehler: unknown, ort: string, digest?: string): Promise<void> {
  const meldung = fehlerText(fehler);
  console.error(`[Fehler] ${ort}${digest ? ` (${digest})` : ""}:`, fehler);
  if (!KONFIGURIERT.supabaseAdmin) return;
  const code = typeof fehler === "object" && fehler && "code" in fehler && typeof fehler.code === "string" ? fehler.code : null;
  try {
    const antwort = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/fehler_melden`, {
      method: "POST",
      headers: { apikey: ENV.supabaseSecretKey, authorization: `Bearer ${ENV.supabaseSecretKey}`, "content-type": "application/json" },
      body: JSON.stringify({ p_schluessel: schluessel(ort, meldung), p_ort: ort, p_meldung: meldung, p_code: code, p_digest: digest ?? null }),
      signal: AbortSignal.timeout(3000),
    });
    // 404: Migration „fehlerprotokoll“ fehlt noch. Dann bleibt es beim Server-Log.
    if (!antwort.ok && antwort.status !== 404) console.error("Fehlerprotokoll: konnte nicht speichern", antwort.status, await antwort.text());
  } catch (e) {
    console.error("Fehlerprotokoll: nicht erreichbar", e);
  }
}

export function fehlerText(fehler: unknown): string {
  if (fehler instanceof Error) return fehler.message || fehler.name;
  if (typeof fehler === "object" && fehler && "message" in fehler) return String(fehler.message);
  return String(fehler);
}

/**
 * Gleicher Ort und gleiche Meldung = derselbe Fehler. IDs, Nummern und Zeiten werden vorher entfernt,
 * damit „Termin 4711“ und „Termin 4712“ nicht zwei Zeilen werden.
 */
export function schluessel(ort: string, meldung: string): string {
  const ohneIds = (t: string) =>
    t
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
      .replace(/\d+/g, "<n>")
      .slice(0, 500);
  return createHash("sha256").update(`${ohneIds(ort)}\n${ohneIds(meldung)}`).digest("hex");
}

/**
 * Lohnt sich das Protokoll? Datenbank- und Programmierfehler ja. Fachliche Meldungen an den Benutzer
 * („Bitte Name angeben“, „Termin vergeben“) sind keine Fehler im System und kommen nicht hinein.
 */
export function istSystemfehler(fehler: unknown): boolean {
  if (!(fehler instanceof Error)) return true;
  if (fehler.name === "DbFehler" || fehler.name === "PostgrestError") return true;
  return fehler instanceof TypeError || fehler instanceof ReferenceError || fehler instanceof RangeError || fehler instanceof SyntaxError;
}

/**
 * Für Dinge, die eine Seite nicht umwerfen dürfen (Zähler im Menü, Angebote auf der Website): Bei einem
 * Fehler gilt `ersatz`, der Fehler landet aber im Protokoll, statt still zu verschwinden.
 */
export async function weich<T>(versuch: PromiseLike<T> | (() => PromiseLike<T>), ersatz: T, ort: string): Promise<T> {
  try {
    return await (typeof versuch === "function" ? versuch() : versuch);
  } catch (fehler) {
    await fehlerMelden(fehler, ort);
    return ersatz;
  }
}
