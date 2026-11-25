"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, istEmail, ja, text } from "../forms";
import { sicher } from "../sicher";
import { belegAus } from "../rechnung/eingabe";
import { kvAbschliessen, kvBeantworten, kvKopieren, kvSpeichern, kvVersenden, kvZumAuftrag } from "../rechnung/kostenvoranschlaege";
import { db } from "../supabase/admin";
import type { Ort } from "./belege";

function neuLaden(id: string) {
  revalidatePath("/admin/kostenvoranschlaege", "layout");
  revalidatePath("/app", "layout");
  revalidatePath(`/admin/kostenvoranschlaege/${id}`);
}

export async function kvEntwurfSpeichernAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const { datumOderNull, ...beleg } = belegAus(JSON.parse(String(fd.get("daten") ?? "{}")));
    await kvSpeichern(id, { ...beleg, gueltig_bis: datumOderNull("gueltig_bis") });
    neuLaden(id);
    if (fd.get("weiter") !== "stellen") return { status: "ok", meldung: "Entwurf gespeichert." };
    const nummer = await kvAbschliessen(id, b.id);
    const an = beleg.empfaenger.email;
    if (ja(fd, "senden") && an && istEmail(an)) {
      await kvVersenden(id, an, b.id);
      neuLaden(id);
      return { status: "ok", meldung: `Kostenvoranschlag ${nummer} abgeschlossen und an ${an} gesendet.` };
    }
    neuLaden(id);
    return { status: "ok", meldung: `Kostenvoranschlag ${nummer} abgeschlossen.` };
  });
}

export async function kvVersendenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const an = text(fd, "an", 160).toLowerCase();
    if (!istEmail(an)) return { status: "fehler", meldung: "Bitte eine gültige E-Mail-Adresse angeben." };
    await kvVersenden(id, an, b.id);
    neuLaden(id);
    return { status: "ok", meldung: `An ${an} gesendet.` };
  });
}

/** Der Kunde hat angerufen oder in der Werkstatt zugesagt: Antwort von Hand vermerken. */
export async function kvAntwortAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const antwort = fd.get("antwort") === "abgelehnt" ? "abgelehnt" : "angenommen";
    await kvBeantworten(id, antwort, { benutzer: b.id });
    neuLaden(id);
    return { status: "ok", meldung: antwort === "angenommen" ? "Als angenommen vermerkt." : "Als abgelehnt vermerkt." };
  });
}

/**
 * Der Kunde hat zugesagt: Der Kostenvoranschlag wird zum erteilten Werkstattauftrag (am Termin oder ohne Termin)
 * und die Seite des Auftrags öffnet sich. Von da an läuft alles über den Auftrag, auch die Rechnung.
 */
export async function kvZumAuftragAktion(id: string, ort: Ort, _v: Ergebnis): Promise<Ergebnis> {
  let ziel = "";
  const ergebnis = await sicher(null, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const terminId = await kvZumAuftrag(id, b.id);
    neuLaden(id);
    revalidatePath("/admin", "layout");
    ziel = `/${ort}/termine/${terminId}`;
    return { status: "ok", meldung: "Werkstattauftrag erteilt." };
  });
  if (ziel) redirect(ziel);
  return ergebnis;
}

export async function kvKopierenAktion(id: string, ort: Ort): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const neu = await kvKopieren(id, b.id);
  neuLaden(id);
  redirect(`/${ort}/kostenvoranschlaege/${neu}`);
}

export async function kvEntwurfLoeschen(id: string, ort: Ort): Promise<void> {
  await benutzerMitRecht("rechnungen");
  await db().from("kostenvoranschlaege").delete().eq("id", id).eq("status", "entwurf");
  revalidatePath("/admin/kostenvoranschlaege", "layout");
  redirect(`/${ort}/kostenvoranschlaege`);
}
