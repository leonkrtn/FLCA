"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { melden } from "../ereignisse";
import { type Ergebnis, istEmail, sicher, text, werteAus, zahl } from "../forms";
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
    const { data, error } = await db().from("kunden").insert(daten).select("id, nummer").single();
    if (error) throw new Error(error.message);
    neu = data.id;
    await melden("kunde.angelegt", { kunde_id: data.id, nummer: data.nummer, name: daten.name });
    return { status: "ok" };
  });
  if (neu) redirect(`/admin/kunden/${neu}`);
  return e;
}

/** Marke und Modell aus zwei Feldern; marke_modell wird für alle Anzeigen zusammengesetzt mitgeschrieben. */
function markeModellAus(fd: FormData) {
  const marke = text(fd, "marke", 60);
  const modell = text(fd, "modell", 60);
  return { marke, modell, marke_modell: [marke, modell].filter(Boolean).join(" ") };
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
      ...markeModellAus(fd),
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

/**
 * Kunde mit erstem Fahrzeug in einem Schritt (Handy-App: „+“ → Kunde). Das Kennzeichen wird vorher
 * geprüft, damit bei einem doppelten Kennzeichen kein halber Kunde ohne Auto zurückbleibt.
 */
export async function kundeAnlegenAktion(ort: "admin" | "app", _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let neu = "";
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("kunden");
    const daten = Object.fromEntries(KUNDENFELDER.map((f) => [f, text(fd, f, f === "notiz" ? 3000 : 200)]));
    // Bei einem Fehler bleiben alle Eingaben stehen (werte + versuch, siehe components/mobil/kunde-neu.tsx).
    const zurueck = (meldung: string): Ergebnis => ({ status: "fehler", meldung, werte: werteAus(fd), versuch: Date.now() });
    if (!daten.name) return zurueck("Bitte einen Namen angeben.");
    daten.email = daten.email.toLowerCase();
    if (daten.email && !istEmail(daten.email)) return zurueck("Die E-Mail-Adresse sieht nicht richtig aus.");
    const kz = kennzeichen(text(fd, "kennzeichen", 16));
    if (kz) {
      const norm = kz.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
      const { data: vorhanden } = await db().from("fahrzeuge").select("kunde_id, kunden(name)").eq("kennzeichen_norm", norm).maybeSingle();
      if (vorhanden) {
        const name = (vorhanden.kunden as unknown as { name: string } | null)?.name;
        return zurueck(`Das Kennzeichen ${kz} gehört schon${name ? ` zu ${name}` : " einem anderen Kunden"}. Bitte dort ergänzen.`);
      }
    }
    const { data, error } = await db().from("kunden").insert(daten).select("id, nummer").single();
    if (error) throw new Error(error.message);
    neu = data.id;
    if (kz) {
      const km = zahl(fd, "km_stand");
      const { error: f } = await db()
        .from("fahrzeuge")
        .insert({ kunde_id: data.id, kennzeichen: kz, ...markeModellAus(fd), km_stand: km === null ? null : Math.round(km) });
      if (f) console.error("Fahrzeug zum neuen Kunden nicht gespeichert", f.message);
    }
    await melden("kunde.angelegt", { kunde_id: data.id, nummer: data.nummer, name: daten.name });
    revalidatePath("/admin/kunden");
    return { status: "ok" };
  });
  if (neu) redirect(`/${ort}/kunden/${neu}`);
  return e;
}
