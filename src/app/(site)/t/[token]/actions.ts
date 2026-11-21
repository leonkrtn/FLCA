"use server";

import { revalidatePath } from "next/cache";
import { type Ergebnis, sicher } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { stornieren, terminPerToken, TerminFehler, vorschlagAntworten } from "@/lib/termine";

export async function kundeStorniert(token: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("storno")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    const t = await terminPerToken(token);
    if (!t) return { status: "fehler", meldung: "Termin nicht gefunden." };
    try {
      await stornieren(t.id, { kunde: true });
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath(`/t/${token}`);
    return { status: "ok", meldung: "Ihr Termin ist abgesagt. Sie bekommen eine Bestätigung per E-Mail." };
  });
}

/** Antwort auf einen Gegenvorschlag: „Passt“ bestätigt den Termin, „Passt nicht“ zieht die Anfrage zurück. */
export async function vorschlagBeantworten(token: string, annehmen: boolean, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("storno")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    try {
      await vorschlagAntworten(token, annehmen);
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath(`/t/${token}`);
    return {
      status: "ok",
      meldung: annehmen ? "Danke, Ihr Termin steht. Die Bestätigung kommt per E-Mail." : "Schade. Ihre Anfrage ist zurückgezogen, gern können Sie einen anderen Termin wählen.",
    };
  });
}
