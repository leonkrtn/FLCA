"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, istEmail, ja, sicher, text } from "../forms";
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

/**
 * Sammelaktionen aus der Rechnungsliste. Jede Rechnung läuft einzeln durch dieselbe Funktion wie auf
 * ihrer Detailseite (Verlauf, Ereignisse, Mail), Rechnungen, für die die Aktion nicht passt, werden
 * übersprungen und in der Meldung gezählt statt die ganze Auswahl abzubrechen.
 */
export async function sammelAktion(
  art: "bezahlt_ueberweisung" | "bezahlt_bar" | "senden" | "entwuerfe_loeschen",
  ids: string[],
): Promise<Ergebnis> {
  const b = await benutzerMitRecht("rechnungen");
  const auswahl = ids.filter((x) => typeof x === "string" && x.length <= 64).slice(0, 200);
  if (!auswahl.length) return { status: "fehler", meldung: "Keine Rechnung ausgewählt." };
  const { data } = await db().from("rechnungen").select("id, status, empfaenger").in("id", auswahl);
  const liste = (data ?? []) as { id: string; status: string; empfaenger: Empfaenger }[];
  let ok = 0;
  const fehler: string[] = [];

  if (art === "entwuerfe_loeschen") {
    const entwuerfe = liste.filter((r) => r.status === "entwurf").map((r) => r.id);
    if (entwuerfe.length) {
      const { error } = await db().from("rechnungen").delete().in("id", entwuerfe).eq("status", "entwurf");
      if (error) return { status: "fehler", meldung: error.message };
    }
    ok = entwuerfe.length;
  } else {
    for (const r of liste) {
      try {
        if (art === "senden") {
          if (r.status === "entwurf") continue;
          const an = String(r.empfaenger?.email ?? "").toLowerCase();
          if (!istEmail(an)) {
            fehler.push(`${r.empfaenger?.name || "ohne Namen"}: keine E-Mail-Adresse`);
            continue;
          }
          await versenden(r.id, an, b.id);
        } else {
          if (r.status !== "gestellt") continue;
          await alsBezahlt(r.id, art === "bezahlt_bar" ? "bar" : "ueberweisung", berlinDatum(), b.id);
        }
        ok++;
      } catch (e) {
        fehler.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  revalidatePath("/admin/rechnungen", "layout");
  revalidatePath("/app", "layout");

  const was = { bezahlt_ueberweisung: "als bezahlt markiert", bezahlt_bar: "als bar bezahlt markiert", senden: "per E-Mail gesendet", entwuerfe_loeschen: "gelöscht" }[art];
  const uebrig = auswahl.length - ok - fehler.length;
  const meldung = [
    `${ok} ${ok === 1 ? "Rechnung" : "Rechnungen"} ${was}.`,
    uebrig > 0 ? `${uebrig} übersprungen, weil die Aktion für sie nicht passt.` : "",
    fehler.length ? `Nicht geklappt: ${fehler.slice(0, 3).join("; ")}${fehler.length > 3 ? " …" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { status: fehler.length && !ok ? "fehler" : "ok", meldung };
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

export async function rechnungFuerEditor(id: string) {
  await benutzerMitRecht("rechnungen");
  return rechnungLaden(id);
}
