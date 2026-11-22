import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { fehlerMelden, istSystemfehler } from "./fehler";
import { type Ergebnis, werteAus } from "./forms";

// Eigene Datei, weil forms.ts auch im Browser landet (LEER, FALLE) und das Melden Server-Code braucht.

/**
 * Führt eine Server Action aus und wandelt Ausnahmen in eine Meldung um, damit das Formular stehen bleibt
 * und die Eingaben behält, statt einer Fehlerseite zu weichen. Systemfehler (Datenbank, Programmfehler)
 * landen zusätzlich im Fehlerprotokoll.
 *
 * `oeffentlich`: Formular der Website. Kunden sehen bei einem Systemfehler keine technische Meldung,
 * sondern die Bitte, es noch einmal zu versuchen oder anzurufen.
 */
export async function sicher(formData: FormData | null, aktion: () => Promise<Ergebnis>, oeffentlich = false): Promise<Ergebnis> {
  try {
    return await aktion();
  } catch (error) {
    // redirect() und notFound() werfen absichtlich; die müssen durch.
    unstable_rethrow(error);
    const system = istSystemfehler(error);
    if (system) await fehlerMelden(error, `Formular auf ${await formularSeite()}`);
    else console.error(error);
    return {
      status: "fehler",
      meldung:
        oeffentlich && system
          ? "Das hat leider nicht geklappt. Bitte versuchen Sie es gleich noch einmal oder rufen Sie uns an."
          : error instanceof Error
            ? error.message
            : "Das hat nicht geklappt. Bitte noch einmal versuchen.",
      werte: formData ? werteAus(formData) : undefined,
      versuch: Date.now(),
    };
  }
}

/** Von welcher Seite das Formular kam (für das Protokoll); außerhalb einer Anfrage „unbekannt“. */
async function formularSeite(): Promise<string> {
  try {
    const referer = (await headers()).get("referer");
    return referer ? new URL(referer).pathname : "unbekannt";
  } catch {
    return "unbekannt";
  }
}
