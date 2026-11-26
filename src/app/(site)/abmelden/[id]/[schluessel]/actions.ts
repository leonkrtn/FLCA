"use server";

import { abmeldeSchluesselPruefen, einwilligungSetzen } from "@/lib/einwilligung";
import { type Ergebnis } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { sicher } from "@/lib/sicher";

/** Abmelden aus Erinnerungs- und Bewertungsmails: nimmt die Einwilligung zurück, ohne Anmeldung. */
export async function abmelden(id: string, schluessel: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("storno")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder schreiben Sie uns kurz." };
    if (!abmeldeSchluesselPruefen(id, schluessel)) return { status: "fehler", meldung: "Dieser Link ist ungültig. Schreiben Sie uns kurz, dann tragen wir Sie aus." };
    await einwilligungSetzen(id, "erinnerung", false, { wie: "Abmeldelink in einer Mail" });
    return { status: "ok", meldung: "Sie sind abgemeldet und bekommen keine Erinnerungen und Bewertungsbitten mehr. Mails zu Ihren Terminen und Rechnungen kommen weiter." };
  }, true);
}
