"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { centAus, type Ergebnis, istEmail, ja, sicher, text, zahl } from "../forms";
import type { Position } from "../rechnung/berechnung";
import { alsBezahlt, entwurfAnlegen, entwurfSpeichern, type Empfaenger, rechnungLaden, stellen, stornieren, versenden } from "../rechnung/rechnungen";
import { db } from "../supabase/admin";
import { berlinDatum, istDatum } from "../zeit";

type Basis = "/admin/rechnungen" | "/app/rechnungen";

function neuLaden(id: string) {
  revalidatePath("/admin/rechnungen", "layout");
  revalidatePath("/app", "layout");
  revalidatePath(`/admin/rechnungen/${id}`);
}

function positionenAus(roh: unknown): Position[] {
  if (!Array.isArray(roh)) throw new Error("Positionen fehlen.");
  return roh.slice(0, 100).map((p) => {
    const menge = Number(p.menge);
    const preis = Math.round(Number(p.einzel_brutto_cent));
    if (!String(p.text ?? "").trim()) throw new Error("Jede Position braucht eine Bezeichnung.");
    if (!Number.isFinite(menge) || menge <= 0) throw new Error(`Menge bei „${p.text}“ prüfen.`);
    if (!Number.isFinite(preis)) throw new Error(`Preis bei „${p.text}“ prüfen.`);
    return {
      text: String(p.text).slice(0, 300),
      menge: Math.round(menge * 1000) / 1000,
      einheit: String(p.einheit ?? "Stk").slice(0, 20),
      einzel_brutto_cent: preis,
      mwst_satz: [0, 7, 19].includes(Number(p.mwst_satz)) ? Number(p.mwst_satz) : 19,
      artikel_id: typeof p.artikel_id === "string" ? p.artikel_id : null,
    };
  });
}

export async function entwurfSpeichernAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("rechnungen");
    const roh = JSON.parse(String(fd.get("daten") ?? "{}"));
    const e = roh.empfaenger ?? {};
    const empfaenger: Empfaenger = Object.fromEntries(
      ["name", "firma", "strasse", "plz", "ort", "email", "ust_id", "leitweg_id"].map((k) => [k, String(e[k] ?? "").trim().slice(0, 200)]),
    ) as Empfaenger;
    await entwurfSpeichern(id, {
      empfaenger,
      fahrzeug: { kennzeichen: String(roh.fahrzeug?.kennzeichen ?? "").slice(0, 20), modell: String(roh.fahrzeug?.modell ?? "").slice(0, 120), km: roh.fahrzeug?.km ? Math.round(Number(roh.fahrzeug.km)) || null : null },
      positionen: positionenAus(roh.positionen),
      leistungsdatum: istDatum(roh.leistungsdatum) ? roh.leistungsdatum : null,
      hinweis: String(roh.hinweis ?? "").slice(0, 1000),
    });
    neuLaden(id);
    if (fd.get("weiter") === "stellen") {
      const b = await benutzerMitRecht("rechnungen");
      const nummer = await stellen(id, b.id);
      if (ja(fd, "senden") && empfaenger.email && istEmail(empfaenger.email)) {
        await versenden(id, empfaenger.email, b.id);
        neuLaden(id);
        return { status: "ok", meldung: `Rechnung ${nummer} gestellt und an ${empfaenger.email} gesendet.` };
      }
      neuLaden(id);
      return { status: "ok", meldung: `Rechnung ${nummer} gestellt.` };
    }
    return { status: "ok", meldung: "Entwurf gespeichert." };
  });
}

export async function versendenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const an = text(fd, "an", 160).toLowerCase();
    if (!istEmail(an)) return { status: "fehler", meldung: "Bitte eine gültige E-Mail-Adresse angeben." };
    await versenden(id, an, b.id);
    neuLaden(id);
    return { status: "ok", meldung: `An ${an} gesendet.` };
  });
}

export async function bezahltAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const art = fd.get("zahlungsart") === "bar" ? "bar" : "ueberweisung";
    const am = istDatum(text(fd, "am")) ? text(fd, "am") : berlinDatum();
    await alsBezahlt(id, art, am, b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Als bezahlt markiert." };
  });
}

export async function stornoAktion(id: string, basis: Basis): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const storno = await stornieren(id, b.id);
  neuLaden(id);
  redirect(`${basis}/${storno}`);
}

export async function entwurfLoeschen(id: string, basis: Basis): Promise<void> {
  await benutzerMitRecht("rechnungen");
  await db().from("rechnungen").delete().eq("id", id).eq("status", "entwurf");
  revalidatePath("/admin/rechnungen", "layout");
  redirect(basis);
}

export async function neueRechnung(kundeId: string | null): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  let empfaenger: Empfaenger = { name: "" };
  if (kundeId) {
    const { data: k } = await db().from("kunden").select("*").eq("id", kundeId).maybeSingle();
    if (k) empfaenger = { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, ust_id: k.ust_id, leitweg_id: k.leitweg_id };
  }
  const id = await entwurfAnlegen({ kunde_id: kundeId, empfaenger, positionen: [], leistungsdatum: berlinDatum() }, b.id);
  redirect(`/admin/rechnungen/${id}`);
}

export async function artikelSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("rechnungen");
    const name = text(fd, "name", 200);
    if (!name) return { status: "fehler", meldung: "Bitte eine Bezeichnung angeben." };
    const daten = {
      nummer: text(fd, "nummer", 40),
      name,
      einheit: text(fd, "einheit", 20) || "Stk",
      preis_brutto_cent: centAus(fd, "preis") ?? 0,
      mwst_satz: [0, 7, 19].includes(zahl(fd, "mwst_satz") ?? 19) ? (zahl(fd, "mwst_satz") ?? 19) : 19,
      aktiv: ja(fd, "aktiv"),
      leistung_id: text(fd, "leistung_id", 40) || null,
    };
    const { error } = id ? await db().from("artikel").update(daten).eq("id", id) : await db().from("artikel").insert(daten);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/artikel");
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function rechnungFuerEditor(id: string) {
  await benutzerMitRecht("rechnungen");
  return rechnungLaden(id);
}
