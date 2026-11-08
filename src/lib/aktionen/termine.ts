"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { verlauf } from "../ereignisse";
import { type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { entwurfAusTermin } from "../rechnung/rechnungen";
import { db } from "../supabase/admin";
import { ablehnen, bestaetigen, erledigen, stornieren, terminEintragen, TerminFehler, verschieben } from "../termine";
import { istDatum } from "../zeit";

/** Termin-Aktionen. Admin am Rechner und Handy-App teilen sich diese Funktionen. */

function neuLaden(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
  if (id) revalidatePath(`/admin/termine/${id}`);
}

async function mitFehlertext(fd: FormData | null, fn: () => Promise<Ergebnis>): Promise<Ergebnis> {
  return sicher(fd, async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
  });
}

export async function bestaetigenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await bestaetigen(id, b.id, ja(fd, "ueberbuchen"));
    neuLaden(id);
    return { status: "ok", meldung: "Bestätigt. Der Kunde bekommt eine Mail, der Termin steht im Kalender." };
  });
}

export async function ablehnenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await ablehnen(id, text(fd, "grund", 500), b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Abgelehnt. Der Kunde wurde informiert." };
  });
}

export async function absagenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await stornieren(id, { benutzer: b.id }, text(fd, "grund", 500));
    neuLaden(id);
    return { status: "ok", meldung: "Abgesagt." };
  });
}

export async function verschiebenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const datum = text(fd, "datum", 10);
    const uhrzeit = text(fd, "uhrzeit", 5);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Datum und Uhrzeit angeben." };
    await verschieben(id, datum, uhrzeit, b.id, ja(fd, "ueberbuchen"));
    neuLaden(id);
    return { status: "ok", meldung: "Verschoben." };
  });
}

export async function erledigtAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await erledigen(id, b.id, fd.get("art") === "nicht_erschienen" ? "nicht_erschienen" : "erledigt");
    neuLaden(id);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function detailsSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const mitarbeiter = text(fd, "zugewiesen_an", 40);
    const km = zahl(fd, "km_stand");
    await db()
      .from("termine")
      .update({ notiz_intern: text(fd, "notiz_intern", 3000), zugewiesen_an: mitarbeiter || null, km_stand: km === null ? null : Math.round(km) })
      .eq("id", id);
    if (km !== null) {
      const { data } = await db().from("termine").select("fahrzeug_id").eq("id", id).single();
      if (data?.fahrzeug_id) await db().from("fahrzeuge").update({ km_stand: Math.round(km) }).eq("id", data.fahrzeug_id);
    }
    await verlauf("termin", id, "Details geändert", b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function eintragenAktion(basis: "/admin/termine" | "/app/termine", _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const ergebnis = await mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const datum = text(fd, "datum", 10);
    const uhrzeit = text(fd, "uhrzeit", 5);
    const name = text(fd, "name", 120);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Datum und Uhrzeit angeben." };
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen angeben." };
    const dauer = zahl(fd, "dauer");
    const t = await terminEintragen(
      {
        leistungId: text(fd, "leistung", 40) || null,
        leistungName: text(fd, "leistung_frei", 120) || undefined,
        dauerMin: dauer ? Math.round(dauer) : undefined,
        datum,
        uhrzeit,
        name,
        telefon: text(fd, "telefon", 40),
        email: text(fd, "email", 160).toLowerCase(),
        kennzeichen: text(fd, "kennzeichen", 16),
        fahrzeug: text(fd, "fahrzeug", 120),
        notiz: text(fd, "notiz", 1500),
        ueberbuchen: ja(fd, "ueberbuchen"),
        mitarbeiter: text(fd, "zugewiesen_an", 40) || null,
      },
      b.id,
    );
    neuLaden();
    ziel = `${basis}/${t.id}`;
    return { status: "ok" };
  });
  if (ziel) redirect(ziel);
  return ergebnis;
}

export async function rechnungAusTermin(id: string, basis: "/admin/rechnungen" | "/app/rechnungen"): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const rechnungId = await entwurfAusTermin(id, b.id);
  redirect(`${basis}/${rechnungId}`);
}
