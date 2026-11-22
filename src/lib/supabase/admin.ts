import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "../env";

let roh: SupabaseClient | null = null;
let werfend: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (!ENV.supabaseUrl || !ENV.supabaseSecretKey) {
    throw new Error("Supabase ist nicht eingerichtet (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  }
  roh ??= createClient(ENV.supabaseUrl, ENV.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return roh;
}

/**
 * Supabase-Client mit Secret Key. Alle Tabellen haben RLS ohne Richtlinien, gelesen und geschrieben wird
 * nur hierüber, und zwar erst NACH der eigenen Prüfung von Anmeldung und Rolle (src/lib/auth.ts).
 *
 * Jede Abfrage über `db()` wirft bei einem Datenbankfehler einen `DbFehler` mit Tabelle, Ursache und
 * Abhilfe. Früher lieferte ein Fehler still `data: null`, und eine kaputte Abfrage sah aus wie eine leere
 * Liste oder „nicht gefunden“ (so blieb ein mehrdeutiger Join wochenlang unbemerkt). Wer einen Fehler
 * gezielt in eine eigene Meldung übersetzt (doppeltes Kennzeichen, belegter Termin), nimmt `dbRoh()`.
 *
 * Ausnahme: `.single()` ohne Treffer bleibt `data: null`, damit „nicht gefunden“ weiter so behandelt wird.
 */
export function db(): SupabaseClient {
  werfend ??= mitFehlern(client());
  return werfend;
}

/** Wie `db()`, aber Fehler kommen als `{ error }` zurück. Nur, wenn der Aufrufer `error` selbst auswertet. */
export function dbRoh(): SupabaseClient {
  return client();
}

// ---------------------------------------------------------------------------
// Fehler verständlich machen
// ---------------------------------------------------------------------------

type PostgrestFehler = { message: string; code?: string; details?: string | null; hint?: string | null };
type Kontext = { tabelle?: string; funktion?: string; vorgang?: string };

const MIGRATION = "Wahrscheinlich ist eine Migration aus supabase/migrations noch nicht im SQL-Editor von Supabase ausgeführt.";

/** Was der Fehlercode bedeutet und was zu tun ist. */
function abhilfe(code: string | undefined): string | null {
  switch (code) {
    case "PGRST201":
      return "Mehrdeutige Verknüpfung: Die Tabelle zeigt mehrfach auf dieselbe andere Tabelle. Im Code den Fremdschlüssel angeben, z. B. profile!termine_zugewiesen_an_fkey(name).";
    case "PGRST200":
      return `Die Verknüpfung zwischen den Tabellen fehlt. ${MIGRATION}`;
    case "42703":
    case "PGRST204":
      return `Eine Spalte fehlt in der Datenbank. ${MIGRATION}`;
    case "42P01":
    case "PGRST205":
      return `Eine Tabelle fehlt in der Datenbank. ${MIGRATION}`;
    case "42883":
    case "PGRST202":
      return `Eine Datenbankfunktion fehlt oder hat andere Parameter. ${MIGRATION}`;
    case "23505":
      return "Diesen Eintrag gibt es schon (doppelter Wert in einer eindeutigen Spalte).";
    case "23503":
      return "Der Eintrag verweist auf etwas, das es nicht (mehr) gibt, oder wird noch von etwas anderem gebraucht.";
    case "23502":
      return "Ein Pflichtfeld ist leer.";
    case "23514":
      return "Ein Wert ist nicht erlaubt (Prüfregel der Datenbank).";
    case "22P02":
      return "Ein Wert hat das falsche Format (z. B. keine gültige ID).";
    case "PGRST116":
      return "Es wurde genau ein Eintrag erwartet, gefunden wurden mehrere.";
    case "PGRST301":
    case "PGRST302":
      return "Der Zugang zu Supabase stimmt nicht (SUPABASE_SECRET_KEY prüfen).";
    default:
      return null;
  }
}

/** Datenbankfehler mit Ort und Abhilfe. `code` bleibt erhalten, damit Aufrufer darauf prüfen können. */
export class DbFehler extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
  tabelle?: string;

  constructor(fehler: PostgrestFehler, kontext: Kontext = {}) {
    const ort = kontext.funktion ? `Funktion „${kontext.funktion}“` : kontext.tabelle ? `„${kontext.tabelle}“` : "Datenbank";
    const vorgang = kontext.vorgang ? ` (${kontext.vorgang})` : "";
    // Netzwerkfehler kommen von postgrest-js ohne Code als „TypeError: fetch failed“
    const netz = !fehler.code && /fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(fehler.message);
    const teile = [
      `Datenbankfehler bei ${ort}${vorgang}: ${fehler.message}`,
      netz ? "Supabase ist nicht erreichbar." : abhilfe(fehler.code),
      fehler.details ? `Details: ${fehler.details}` : null,
      fehler.hint ? `Hinweis von Supabase: ${fehler.hint}` : null,
      fehler.code ? `[${fehler.code}]` : null,
    ];
    super(teile.filter(Boolean).join(" "));
    this.name = "DbFehler";
    this.code = fehler.code;
    this.details = fehler.details;
    this.hint = fehler.hint;
    this.tabelle = kontext.tabelle ?? kontext.funktion;
  }
}

/** `.single()` ohne Treffer: kein Fehler, sondern „nicht gefunden“ (data bleibt null). */
function keinTreffer(f: PostgrestFehler): boolean {
  return f.code === "PGRST116" && /\b0 rows\b/.test(`${f.details ?? ""} ${f.message}`);
}

const VORGANG: Record<string, string> = { select: "lesen", insert: "anlegen", upsert: "speichern", update: "ändern", delete: "löschen" };

/**
 * Umhüllt den Client so, dass jede Abfrage aus `from()` und `rpc()` beim Auswerten (await) wirft.
 * Die Hülle reicht sich durch die ganze Kette (.select().eq().order() …), auch wenn eine Abfrage erst in
 * einer Variablen gebaut und später ergänzt wird.
 */
export function mitFehlern(c: SupabaseClient): SupabaseClient {
  const huelle = <T extends object>(ziel: T, kontext: Kontext): T => {
    const proxy: T = new Proxy(ziel, {
      get(t, name, empfaenger) {
        const wert = Reflect.get(t, name, empfaenger === proxy ? t : empfaenger);
        if (name === "then" && typeof wert === "function") {
          return (erfuellt?: (v: unknown) => unknown, abgelehnt?: (e: unknown) => unknown) =>
            (wert as (a: (v: unknown) => unknown) => Promise<unknown>)
              .call(t, (antwort: unknown) => {
                const f = (antwort as { error?: PostgrestFehler | null })?.error;
                if (f && !keinTreffer(f)) throw new DbFehler(f, kontext);
                return antwort;
              })
              .then(erfuellt, abgelehnt);
        }
        if (typeof wert !== "function") return wert;
        return (...args: unknown[]) => {
          const ergebnis = (wert as (...a: unknown[]) => unknown).apply(t, args);
          if (ergebnis === t) return proxy;
          if (ergebnis && typeof ergebnis === "object" && typeof (ergebnis as { then?: unknown }).then === "function") {
            const vorgang = typeof name === "string" && VORGANG[name] ? VORGANG[name] : kontext.vorgang;
            return huelle(ergebnis as object, { ...kontext, vorgang });
          }
          return ergebnis;
        };
      },
    });
    return proxy;
  };

  return new Proxy(c, {
    get(t, name) {
      if (name === "from") return (tabelle: string) => huelle(t.from(tabelle), { tabelle });
      if (name === "rpc") return (...args: Parameters<SupabaseClient["rpc"]>) => huelle(t.rpc(...args), { funktion: args[0] });
      return Reflect.get(t, name, t);
    },
  });
}

// ---------------------------------------------------------------------------

// Ohne generierte Datenbanktypen ist eine Zeile ein offenes Objekt; die Seiten geben ihr selbst einen Typ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Zeile = Record<string, any>;

/** Wirft den Fehler einer Supabase-Antwort weiter, damit kein Fehler stillschweigend als „leer“ durchgeht. */
export function pruefe<T = Zeile>(antwort: { data: unknown; error: PostgrestFehler | null }): T {
  if (antwort.error) throw new DbFehler(antwort.error);
  return antwort.data as T;
}

/** Öffentliche URL einer Datei im Speicher „website“. */
export function websiteDatei(pfad: string | null | undefined): string | null {
  if (!pfad) return null;
  if (/^https?:\/\//.test(pfad)) return pfad;
  return `${ENV.supabaseUrl}/storage/v1/object/public/website/${pfad}`;
}
