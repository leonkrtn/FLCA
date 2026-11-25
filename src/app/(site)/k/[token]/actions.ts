"use server";

import { revalidatePath } from "next/cache";
import { type Ergebnis } from "@/lib/forms";
import { istSystemfehler } from "@/lib/fehler";
import { sicher } from "@/lib/sicher";
import { imLimit } from "@/lib/limit";
import { kvBeantworten, kvMitTerminVerknuepfen, kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";
import { db } from "@/lib/supabase/admin";
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
      // Systemfehler an sicher() weitergeben: ins Protokoll und ohne technische Meldung an den Kunden
      if (istSystemfehler(error)) throw error;
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
            : "Vielen Dank! Ihr Auftrag ist erteilt. Wählen Sie jetzt einen Termin, oder wir melden uns bei Ihnen.",
    };
  }, true);
}

/**
 * Nach der Annahme wählt der Kunde gleich einen Termin. Der Auftrag wartet dann schon ohne Termin und bekommt
 * die Zeit als Anfrage; das Büro bestätigt sie wie jede andere. (Vor der Migration „auftrag_ohne_termin“
 * angenommen: eine neue Anfrage, verknüpft mit dem Kostenvoranschlag und damit ein erteilter Auftrag.)
 */
export async function kvTerminAnfragen(token: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    if ((await imLimit("termin")) !== "ok") return { status: "fehler", meldung: "Bitte versuchen Sie es später noch einmal oder rufen Sie an." };
    const k = await kvPerToken(token);
    if (!k || k.status !== "angenommen") return { status: "fehler", meldung: "Bitte nehmen Sie den Kostenvoranschlag zuerst an." };
    const { data: amTermin } = k.termin_id ? await db().from("termine").select("id, status").eq("id", k.termin_id).maybeSingle() : { data: null };
    const wartend = amTermin?.status === "ungeplant" ? amTermin.id : undefined;
    if (amTermin && !wartend) return { status: "fehler", meldung: "Zu diesem Kostenvoranschlag gibt es schon einen Termin." };
    const datum = String(fd.get("datum") ?? "");
    const uhrzeit = String(fd.get("uhrzeit") ?? "");
    if (!istDatum(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Tag und Uhrzeit wählen." };
    let terminToken = "";
    try {
      const t = await anfrageAusKv(k, datum, uhrzeit, wartend);
      if (!wartend) await kvMitTerminVerknuepfen(k.id, t.id, null);
      terminToken = t.token;
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath(`/k/${token}`);
    revalidatePath("/admin", "layout");
    revalidatePath("/app", "layout");
    return { status: "ok", meldung: "Ihre Terminanfrage ist da. Wir bestätigen sie per E-Mail, meist am selben Tag.", daten: { token: terminToken } };
  }, true);
}
