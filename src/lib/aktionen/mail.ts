"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, text } from "../forms";
import { adressListe, istAdresse } from "../mail/adressen";
import { type Anhang, gelesenSetzen, gespraechLaden, gespraechLoeschen, senden } from "../mail/postfach";
import { sicher } from "../sicher";
import { db } from "../supabase/admin";

/** Mail-Aktionen. Verwaltung, Werkstatt-App und Team-App teilen sie; welches Postfach wer sieht, prüft postfach.ts. */

type Basis = "/admin/mail" | "/app/mail" | "/team/mail";
const BASEN: Basis[] = ["/admin/mail", "/app/mail", "/team/mail"];

function neuLaden() {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
}

const MAX_DATEI = 25 * 1024 * 1024;
const MAX_GESAMT = 35 * 1024 * 1024;

/**
 * Signierte Upload-Adresse für einen Anhang: Dateien gehen direkt vom Browser in den Speicher, nicht durch
 * die Server-Funktion (Vercel begrenzt deren Anfragen auf 4,5 MB).
 */
export async function anhangVorbereiten(name: string, groesse: number): Promise<{ ok: true; pfad: string; url: string } | { ok: false; meldung: string }> {
  await benutzerMitRecht("werkstatt");
  if (groesse > MAX_DATEI) return { ok: false, meldung: "Die Datei ist zu groß (höchstens 25 MB)." };
  const sauber = name.normalize("NFD").replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(-120) || "anhang";
  const pfad = `ausgang/${randomUUID()}/${sauber}`;
  const { data, error } = await db().storage.from("mail").createSignedUploadUrl(pfad);
  if (error || !data) return { ok: false, meldung: "Upload konnte nicht vorbereitet werden." };
  return { ok: true, pfad, url: data.signedUrl };
}

function anhaengeAus(fd: FormData): Anhang[] {
  try {
    const roh = JSON.parse(text(fd, "anhaenge", 20000) || "[]") as Anhang[];
    return roh
      .filter((a) => typeof a?.pfad === "string" && a.pfad.startsWith("ausgang/"))
      .map((a) => ({ pfad: a.pfad, name: String(a.name).slice(0, 200), typ: String(a.typ || "application/octet-stream"), groesse: Number(a.groesse) || 0 }));
  } catch {
    return [];
  }
}

export async function mailSenden(basis: Basis, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    if (!BASEN.includes(basis)) throw new Error("Unbekannte Seite.");
    const b = await benutzerMitRecht("werkstatt");
    const an = adressListe(text(fd, "an", 2000));
    const cc = adressListe(text(fd, "cc", 2000));
    const betreff = text(fd, "betreff", 300);
    const inhalt = text(fd, "text", 50000);
    const falsch = [...an, ...cc].find((a) => !istAdresse(a));
    if (!an.length) return { status: "fehler", meldung: "Bitte mindestens einen Empfänger eintragen.", fehler: { an: "Pflichtfeld" } };
    if (falsch) return { status: "fehler", meldung: `„${falsch}“ ist keine gültige E-Mail-Adresse.`, fehler: { an: "Ungültig" } };
    if (!betreff && !inhalt) return { status: "fehler", meldung: "Bitte einen Betreff oder Text eingeben." };

    const anhaenge = anhaengeAus(fd);
    if (anhaenge.reduce((s, a) => s + a.groesse, 0) > MAX_GESAMT) return { status: "fehler", meldung: "Die Anhänge sind zusammen zu groß (höchstens 35 MB)." };

    // Antwort: Postfach kommt aus dem Gespräch, nicht aus dem Formular
    const antwortId = text(fd, "antwort_auf", 40);
    let antwortAuf = null;
    let postfach: string | null = text(fd, "postfach", 10) === "firma" ? null : b.id;
    if (antwortId) {
      const { data: m } = await db().from("mails").select("gespraech").eq("id", antwortId).maybeSingle();
      const verlauf = m ? await gespraechLaden(b, m.gespraech as string) : null;
      antwortAuf = verlauf?.find((x) => x.id === antwortId) ?? null;
      if (!antwortAuf) return { status: "fehler", meldung: "Die Mail, auf die Sie antworten, gibt es nicht mehr." };
      postfach = antwortAuf.postfach;
    }

    const gespraech = await senden(b, { postfach, an, cc, betreff, text: inhalt, antwortAuf, anhaenge });
    neuLaden();
    ziel = `${basis}/${gespraech}`;
    return { status: "ok", meldung: "Gesendet." };
  });
  if (ziel) redirect(ziel);
  return e;
}

/** Beim Öffnen eines Gesprächs: alles darin gilt als gelesen (die Zähler im Menü ziehen nach). */
export async function alsGelesen(gespraech: string): Promise<void> {
  const b = await benutzerMitRecht("werkstatt");
  await gelesenSetzen(b, gespraech, true);
  neuLaden();
}

export async function alsUngelesen(basis: Basis, gespraech: string, _v: Ergebnis): Promise<Ergebnis> {
  let fertig = false;
  const e = await sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    await gelesenSetzen(b, gespraech, false);
    neuLaden();
    fertig = true;
    return { status: "ok" };
  });
  if (fertig && BASEN.includes(basis)) redirect(basis);
  return e;
}

export async function gespraechEntfernen(basis: Basis, gespraech: string, _v: Ergebnis): Promise<Ergebnis> {
  let fertig = false;
  const e = await sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    await gespraechLoeschen(b, gespraech);
    neuLaden();
    fertig = true;
    return { status: "ok" };
  });
  if (fertig && BASEN.includes(basis)) redirect(basis);
  return e;
}
