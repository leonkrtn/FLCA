"use server";

import { revalidatePath } from "next/cache";
import { auftragErteilen } from "@/lib/auftrag";
import { type Ergebnis, ja, sicher, text } from "@/lib/forms";
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

/** Der Kunde erteilt den Werkstattauftrag über seinen Terminlink (Name und Häkchen statt Unterschrift). */
export async function auftragOnlineErteilen(token: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    if ((await imLimit("storno")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    const t = await terminPerToken(token);
    if (!t?.auftrag_nummer) return { status: "fehler", meldung: "Zu diesem Termin gibt es keinen Auftrag." };
    const name = text(fd, "name", 120);
    if (!name) return { status: "fehler", meldung: "Bitte Ihren Namen eintragen." };
    if (!ja(fd, "einverstanden")) return { status: "fehler", meldung: "Bitte bestätigen Sie, dass Sie den Auftrag erteilen." };
    try {
      await auftragErteilen(t.id, "online", { name });
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath(`/t/${token}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/app", "layout");
    return { status: "ok", meldung: "Danke, Ihr Auftrag ist bei uns. Eine Bestätigung mit dem PDF kommt per E-Mail." };
  });
}
