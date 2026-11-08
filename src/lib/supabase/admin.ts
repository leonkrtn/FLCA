import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "../env";

let client: SupabaseClient | null = null;

/**
 * Supabase-Client mit Secret Key. Alle Tabellen haben RLS ohne Richtlinien, gelesen und geschrieben wird
 * nur hierüber, und zwar erst NACH der eigenen Prüfung von Anmeldung und Rolle (src/lib/auth.ts).
 */
export function db(): SupabaseClient {
  if (!ENV.supabaseUrl || !ENV.supabaseSecretKey) {
    throw new Error("Supabase ist nicht eingerichtet (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  }
  client ??= createClient(ENV.supabaseUrl, ENV.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Wirft den Fehler einer Supabase-Antwort weiter, damit kein Fehler stillschweigend als „leer“ durchgeht. */
// Ohne generierte Datenbanktypen ist eine Zeile ein offenes Objekt; die Seiten geben ihr selbst einen Typ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Zeile = Record<string, any>;

export function pruefe<T = Zeile>(antwort: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (antwort.error) {
    const fehler = new Error(antwort.error.message) as Error & { code?: string };
    fehler.code = antwort.error.code;
    throw fehler;
  }
  return antwort.data as T;
}

/** Öffentliche URL einer Datei im Speicher „website“. */
export function websiteDatei(pfad: string | null | undefined): string | null {
  if (!pfad) return null;
  if (/^https?:\/\//.test(pfad)) return pfad;
  return `${ENV.supabaseUrl}/storage/v1/object/public/website/${pfad}`;
}
