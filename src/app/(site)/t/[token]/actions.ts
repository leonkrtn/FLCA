"use server";

import { revalidatePath } from "next/cache";
import { type Ergebnis, sicher } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { stornieren, terminPerToken, TerminFehler } from "@/lib/termine";

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
