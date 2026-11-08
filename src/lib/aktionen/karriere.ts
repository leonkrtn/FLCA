"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { verlauf } from "../ereignisse";
import { type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { db } from "../supabase/admin";

export async function stelleSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("karriere");
    const daten = {
      titel: text(fd, "titel", 160),
      umfang: text(fd, "umfang", 60) || "Vollzeit",
      einleitung: text(fd, "einleitung", 2000),
      aufgaben: text(fd, "aufgaben", 3000),
      profil: text(fd, "profil", 3000),
      wir_bieten: text(fd, "wir_bieten", 3000),
      aktiv: ja(fd, "aktiv"),
      sortierung: Math.round(zahl(fd, "sortierung") ?? 0),
    };
    if (!daten.titel) return { status: "fehler", meldung: "Bitte einen Titel angeben." };
    if (id) {
      await db().from("stellen").update(daten).eq("id", id);
    } else {
      const { data } = await db().from("stellen").insert(daten).select("id").single();
      ziel = `/admin/karriere/stelle/${data?.id}`;
    }
    revalidatePath("/karriere", "layout");
    revalidatePath("/admin/karriere", "layout");
    revalidatePath("/", "page");
    return { status: "ok", meldung: "Gespeichert. Die Website zeigt die Änderung in wenigen Minuten." };
  });
  if (ziel) redirect(ziel);
  return e;
}

export async function bewerbungSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("karriere");
    const status = text(fd, "status");
    if (!["neu", "in_pruefung", "gespraech", "zusage", "absage"].includes(status)) return { status: "fehler", meldung: "Ungültiger Status." };
    await db().from("bewerbungen").update({ status, notiz: text(fd, "notiz", 5000) }).eq("id", id);
    await verlauf("bewerbung", id, `Status: ${status}`, b.id);
    revalidatePath("/admin/karriere", "layout");
    return { status: "ok", meldung: "Gespeichert." };
  });
}
