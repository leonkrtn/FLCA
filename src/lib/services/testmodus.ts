import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Testmodus für alles, was nach außen geht (Mail, Push, Webhooks). Der Systemcheck führt die echten Wege aus,
 * aber `mailer()`, `pushSenden()` und `zustellen()` senden darin nichts: Sie prüfen nur Empfänger, Inhalt und
 * Anhänge und schreiben auf, was sie gesendet hätten.
 *
 * Über AsyncLocalStorage statt über einen Parameter: So gilt der Testmodus genau für diesen Aufruf und alles,
 * was er anstößt, und gleichzeitige echte Anfragen auf derselben Server-Instanz senden normal weiter.
 */
export type Versuch = { kanal: "mail" | "push" | "webhook"; an: string[]; text: string; fehler: string[] };

const speicher = new AsyncLocalStorage<Versuch[]>();

/** Läuft `fn` im Testmodus und gibt zurück, was gesendet worden wäre. */
export async function imTestmodus<T>(fn: () => Promise<T>): Promise<{ ergebnis: T; versuche: Versuch[] }> {
  const versuche: Versuch[] = [];
  const ergebnis = await speicher.run(versuche, fn);
  return { ergebnis, versuche };
}

/** Im Testmodus die Liste, in die Sendewege ihren Versuch eintragen; sonst null (dann wirklich senden). */
export function testmodus(): Versuch[] | null {
  return speicher.getStore() ?? null;
}
