"use server";

import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { einstellungen, einstellungenSpeichern } from "../einstellungen";
import { type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { db } from "../supabase/admin";

function websiteNeu() {
  revalidatePath("/", "layout");
}

export async function galerieSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("website");
    const daten = {
      titel: text(fd, "titel", 120),
      beschreibung: text(fd, "beschreibung", 400),
      vorher_pfad: text(fd, "vorher_pfad", 200),
      nachher_pfad: text(fd, "nachher_pfad", 200),
      sichtbar: ja(fd, "sichtbar"),
      sortierung: Math.round(zahl(fd, "sortierung") ?? 0),
    };
    if (!daten.vorher_pfad || !daten.nachher_pfad) return { status: "fehler", meldung: "Bitte beide Bilder hochladen." };
    const { error } = id ? await db().from("galerie").update(daten).eq("id", id) : await db().from("galerie").insert(daten);
    if (error) throw new Error(error.message);
    websiteNeu();
    revalidatePath("/admin/website");
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function bewertungSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("website");
    const daten = {
      name: text(fd, "name", 80),
      text: text(fd, "text", 1200),
      sterne: Math.min(Math.max(Math.round(zahl(fd, "sterne") ?? 5), 1), 5),
      quelle: text(fd, "quelle", 40) || "Google",
      sichtbar: ja(fd, "sichtbar"),
      sortierung: Math.round(zahl(fd, "sortierung") ?? 0),
    };
    if (!daten.name || !daten.text) return { status: "fehler", meldung: "Name und Text bitte." };
    const { error } = id ? await db().from("bewertungen").update(daten).eq("id", id) : await db().from("bewertungen").insert(daten);
    if (error) throw new Error(error.message);
    websiteNeu();
    revalidatePath("/admin/website");
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function eintragLoeschen(tabelle: "galerie" | "bewertungen", id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("website");
    await db().from(tabelle).delete().eq("id", id);
    websiteNeu();
    revalidatePath("/admin/website");
    return { status: "ok", meldung: "Gelöscht." };
  });
}

export async function texteSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("website");
    const e = await einstellungen();
    await einstellungenSpeichern("texte", {
      heroUnterzeile: text(fd, "heroUnterzeile", 300),
      ueberTitel: text(fd, "ueberTitel", 120),
      ueberText: text(fd, "ueberText", 4000),
      karriereText: text(fd, "karriereText", 1000),
    });
    await einstellungenSpeichern("medien", {
      ...e.medien,
      heroBild: text(fd, "heroBild", 200),
      heroVideo: text(fd, "heroVideo", 200),
      ueberBild: text(fd, "ueberBild", 200),
    });
    websiteNeu();
    return { status: "ok", meldung: "Gespeichert. Die Website zeigt es in wenigen Minuten." };
  });
}
