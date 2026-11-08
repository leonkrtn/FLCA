"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, sicher, text, zahl } from "../forms";
import { kennzeichen } from "../format";
import { db } from "../supabase/admin";

const KUNDENFELDER = ["name", "firma", "email", "telefon", "strasse", "plz", "ort", "ust_id", "leitweg_id", "notiz"] as const;

export async function kundeSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let neu = "";
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("kunden");
    const daten = Object.fromEntries(KUNDENFELDER.map((f) => [f, text(fd, f, f === "notiz" ? 3000 : 200)]));
    if (!daten.name) return { status: "fehler", meldung: "Bitte einen Namen angeben." };
    daten.email = daten.email.toLowerCase();
    if (id) {
      const { error } = await db().from("kunden").update(daten).eq("id", id);
      if (error) throw new Error(error.message);
      revalidatePath(`/admin/kunden/${id}`);
      return { status: "ok", meldung: "Gespeichert." };
    }
    const { data, error } = await db().from("kunden").insert(daten).select("id").single();
    if (error) throw new Error(error.message);
    neu = data.id;
    return { status: "ok" };
  });
  if (neu) redirect(`/admin/kunden/${neu}`);
  return e;
}

export async function fahrzeugSpeichern(kundeId: string, fahrzeugId: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("kunden");
    const kz = kennzeichen(text(fd, "kennzeichen", 16));
    if (!kz) return { status: "fehler", meldung: "Bitte ein Kennzeichen angeben." };
    const km = zahl(fd, "km_stand");
    const daten = {
      kunde_id: kundeId,
      kennzeichen: kz,
      marke_modell: text(fd, "marke_modell", 120),
      hsn: text(fd, "hsn", 8),
      tsn: text(fd, "tsn", 8),
      fin: text(fd, "fin", 20).toUpperCase(),
      reifengroesse: text(fd, "reifengroesse", 40),
      km_stand: km === null ? null : Math.round(km),
    };
    const { error } = fahrzeugId ? await db().from("fahrzeuge").update(daten).eq("id", fahrzeugId) : await db().from("fahrzeuge").insert(daten);
    if (error) return { status: "fehler", meldung: error.code === "23505" ? "Dieses Kennzeichen gibt es schon bei einem anderen Kunden." : error.message };
    revalidatePath(`/admin/kunden/${kundeId}`);
    return { status: "ok", meldung: "Gespeichert." };
  });
}
