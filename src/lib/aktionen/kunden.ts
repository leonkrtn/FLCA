"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { melden } from "../ereignisse";
import { type Ergebnis, istEmail, text, werteAus, zahl } from "../forms";
import { sicher } from "../sicher";
import { kennzeichen } from "../format";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { fehlerMelden } from "../fehler";

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
      if (error) throw new DbFehler(error);
      revalidatePath(`/admin/kunden/${id}`);
      return { status: "ok", meldung: "Gespeichert." };
    }
    const { data, error } = await db().from("kunden").insert(daten).select("id, nummer").single();
    if (error) throw new DbFehler(error);
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
    const { error } = fahrzeugId ? await dbRoh().from("fahrzeuge").update(daten).eq("id", fahrzeugId) : await dbRoh().from("fahrzeuge").insert(daten);
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
    if (error) throw new DbFehler(error);
    neu = data.id;
    if (kz) {
      const km = zahl(fd, "km_stand");
      const { error: f } = await dbRoh()
        .from("fahrzeuge")
        .insert({ kunde_id: data.id, kennzeichen: kz, ...markeModellAus(fd), km_stand: km === null ? null : Math.round(km) });
      if (f) await fehlerMelden(new DbFehler(f, { tabelle: "fahrzeuge" }), "Fahrzeug zum neuen Kunden speichern");
    }
    await melden("kunde.angelegt", { kunde_id: data.id, nummer: data.nummer, name: daten.name });
    revalidatePath("/admin/kunden");
    return { status: "ok" };
  });
  if (neu) redirect(`/${ort}/kunden/${neu}`);
  return e;
}

/**
 * Kunde löschen, nach Bestätigung im Dialog der Kundenakte. Prüfen und Löschen macht die Datenbank in
 * einem Schritt (`kunde_loeschen`): Fahrzeuge und frühere Rechnungen gehen mit, gestellte Rechnungen,
 * vergangene Termine und Notizen bleiben ohne Verknüpfung. Gemeldet wird ohne Namen, denn wer gelöscht
 * werden will, soll nicht im Ereignisprotokoll und bei Webhooks weiterleben.
 */
export async function kundeLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  let fertig = false;
  const e = await sicher(null, async () => {
    await benutzerMitRecht("kunden");
    const { data, error } = await dbRoh().rpc("kunde_loeschen", { p_id: id });
    if (error) {
      if (error.message.includes("KUNDE_HAT_TERMINE")) return { status: "fehler", meldung: "Nicht gelöscht: Der Kunde hat noch einen kommenden Termin oder einen Auftrag in Arbeit. Erst absagen oder abschließen." };
      if (error.message.includes("KUNDE_HAT_EINLAGERUNG")) return { status: "fehler", meldung: "Nicht gelöscht: Es sind noch Räder des Kunden eingelagert. Erst auslagern." };
      if (error.message.includes("NICHT_GEFUNDEN")) return { status: "fehler", meldung: "Den Kunden gibt es nicht mehr." };
      if (error.code === "PGRST202" || error.code === "42883") return { status: "fehler", meldung: "Löschen ist noch nicht eingerichtet. Bitte die Migration 20261125120000_kunde_loeschen.sql im SQL-Editor von Supabase ausführen." };
      throw new DbFehler(error, { funktion: "kunde_loeschen" });
    }
    const r = data as { nummer: number; fahrzeuge: number; fruehere_rechnungen: number };
    await melden("kunde.geloescht", { kunde_id: id, nummer: r.nummer, fahrzeuge: r.fahrzeuge, fruehere_rechnungen: r.fruehere_rechnungen });
    fertig = true;
    return { status: "ok" };
  });
  if (fertig) {
    revalidatePath("/admin", "layout");
    redirect("/admin/kunden?geloescht=1");
  }
  return e;
}
