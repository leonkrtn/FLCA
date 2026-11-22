"use server";

import { revalidatePath } from "next/cache";
import { type Ergebnis, sicher } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { kvBeantworten, kvMitTerminVerknuepfen, kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";
import { anfrageAusKv, TerminFehler } from "@/lib/termine";
import { istDatum } from "@/lib/zeit";

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
      meldung:
        antwort === "abgelehnt"
          ? "Danke für Ihre Rückmeldung. Wir haben den Kostenvoranschlag als abgelehnt vermerkt."
          : k.termin_id
            ? "Vielen Dank! Damit ist der Auftrag für Ihren Termin erteilt."
            : "Vielen Dank! Wählen Sie jetzt einen Termin, oder wir melden uns bei Ihnen.",
    };
  });
}

/**
 * Nach der Annahme wählt der Kunde gleich einen Termin: Es entsteht eine Anfrage, verknüpft mit dem
 * Kostenvoranschlag und damit ein erteilter Werkstattauftrag. Das Büro bestätigt die Anfrage wie jede andere.
 */
export async function kvTerminAnfragen(token: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("termin")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    const k = await kvPerToken(token);
    if (!k || k.status !== "angenommen") return { status: "fehler", meldung: "Bitte nehmen Sie den Kostenvoranschlag zuerst an." };
    if (k.termin_id) return { status: "fehler", meldung: "Zu diesem Kostenvoranschlag gibt es schon einen Termin." };
    const datum = String(fd.get("datum") ?? "");
    const uhrzeit = String(fd.get("uhrzeit") ?? "");
    if (!istDatum(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Tag und Uhrzeit wählen." };
    let terminToken = "";
    try {
      const t = await anfrageAusKv(k, datum, uhrzeit);
      await kvMitTerminVerknuepfen(k.id, t.id, null);
      terminToken = t.token;
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath(`/k/${token}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/app", "layout");
    return { status: "ok", meldung: "Ihre Terminanfrage ist da. Wir bestätigen sie per E-Mail, meist am selben Tag.", daten: { token: terminToken } };
  });
}
