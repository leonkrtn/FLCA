"use server";

import { revalidatePath } from "next/cache";
import { type Ergebnis, sicher } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { kvBeantworten, kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";

export async function kundeAntwortet(token: string, antwort: "angenommen" | "abgelehnt", _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("kostenvoranschlag")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    const k = await kvPerToken(token);
    if (!k) return { status: "fehler", meldung: "Kostenvoranschlag nicht gefunden." };
    try {
      await kvBeantworten(k.id, antwort === "abgelehnt" ? "abgelehnt" : "angenommen", { kunde: true });
    } catch (error) {
      return { status: "fehler", meldung: error instanceof Error ? error.message : "Das hat nicht geklappt." };
    }
    revalidatePath(`/k/${token}`);
    revalidatePath("/admin/kostenvoranschlaege", "layout");
    revalidatePath("/app", "layout");
    return {
      status: "ok",
      meldung: antwort === "abgelehnt" ? "Danke für Ihre Rückmeldung. Wir haben den Kostenvoranschlag als abgelehnt vermerkt." : "Vielen Dank! Wir melden uns bei Ihnen, um einen Termin auszumachen.",
    };
  });
}
