"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { melden } from "../ereignisse";
import { type Ergebnis, ja, sicher, text } from "../forms";
import { notizEreignis, notizLaden } from "../notizen";
import { darf } from "../rollen";
import { db } from "../supabase/admin";
import { berlin, berlinDatum, istDatum, plusTage, type Wiederholung } from "../zeit";

/** Notiz-Aktionen. Verwaltung und Werkstatt-App teilen sie; die Team-App nutzt nur erledigt und später. */

type Basis = "/admin/notizen" | "/app/notizen";

function neuLaden() {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
}

/** Zeitpunkte vergleichen, unabhängig von der Schreibweise („…+00:00“ aus der Datenbank, „…Z“ aus JS). */
const zeitpunkt = (wert: string | null) => (wert ? new Date(wert).getTime() : null);

const WIEDERHOLUNGEN: Wiederholung[] = ["keine", "taeglich", "woechentlich", "monatlich"];

export async function notizSpeichern(basis: Basis, id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    const b = await benutzerMitRecht("notizen");
    const alt = id ? await notizLaden(b, id) : null;
    if (id && !alt) return { status: "fehler", meldung: "Diese Notiz gibt es nicht mehr." };

    const titel = text(fd, "titel", 200);
    const inhalt = text(fd, "text", 5000);
    if (!titel && !inhalt) return { status: "fehler", meldung: "Bitte einen Titel oder Text eingeben." };

    // Erinnerung: Datum genügt (dann 8 Uhr), ohne Datum keine Erinnerung und keine Wiederholung.
    const datum = text(fd, "datum", 10);
    const uhr = /^\d{2}:\d{2}$/.test(text(fd, "uhrzeit", 5)) ? text(fd, "uhrzeit", 5) : "08:00";
    const erinnernAm = istDatum(datum) ? berlin(datum, uhr).toISOString() : null;
    const w = text(fd, "wiederholung", 20) as Wiederholung;
    const wiederholung = erinnernAm && WIEDERHOLUNGEN.includes(w) ? w : "keine";

    let erinnernAn: string | null = text(fd, "erinnern_an", 40) || null;
    if (erinnernAn) {
      const { data: p } = await db().from("profile").select("id").eq("id", erinnernAn).eq("aktiv", true).maybeSingle();
      if (!p) erinnernAn = null;
    }
    const loesen = ja(fd, "loesen");
    const daten = {
      titel,
      text: inhalt,
      sichtbar: text(fd, "sichtbar", 10) === "buero" ? "buero" : "privat",
      erinnern_am: erinnernAm,
      wiederholung,
      // Wer sich selbst erinnert, steht nicht extra als Empfänger drin
      erinnern_an: erinnernAn === (alt?.erstellt_von ?? b.id) ? null : erinnernAn,
      kunde_id: loesen ? null : text(fd, "kunde_id", 40) || null,
      termin_id: loesen ? null : text(fd, "termin_id", 40) || null,
      // Neuer Zeitpunkt: wieder offen für den nächsten Push
      ...(alt && zeitpunkt(alt.erinnern_am) !== zeitpunkt(erinnernAm) ? { erinnert_am: null } : {}),
    };

    if (alt) {
      const { error } = await db().from("notizen").update(daten).eq("id", alt.id);
      if (error) throw new Error(error.message);
      neuLaden();
      return { status: "ok", meldung: "Gespeichert." };
    }
    const { data, error } = await db().from("notizen").insert({ ...daten, erstellt_von: b.id }).select("*").single();
    if (error) throw new Error(error.message);
    await melden("notiz.angelegt", notizEreignis(data));
    neuLaden();
    ziel = basis;
    return { status: "ok", meldung: "Angelegt." };
  });
  if (ziel) redirect(ziel);
  return e;
}

/** Erledigt abhaken oder wieder öffnen. Darf auch ein Mitarbeiter, an den die Erinnerung geht. */
export async function notizErledigt(id: string, erledigt: boolean, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const n = await notizLaden(b, id);
    if (!n) return { status: "fehler", meldung: "Diese Notiz gibt es nicht mehr." };
    if (!darf(b.rolle, "notizen") && n.erinnern_an !== b.id && n.erstellt_von !== b.id) return { status: "fehler", meldung: "Dafür fehlt Ihnen die Berechtigung." };
    await db().from("notizen").update({ erledigt_am: erledigt ? new Date().toISOString() : null }).eq("id", id);
    if (erledigt) await melden("notiz.erledigt", notizEreignis(n));
    neuLaden();
    return { status: "ok", meldung: erledigt ? "Erledigt." : "Wieder offen." };
  });
}

/** Einmalige Erinnerung verschieben: in einer Stunde oder morgen um 8 Uhr. */
export async function notizSpaeter(id: string, wann: "stunde" | "morgen", _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const n = await notizLaden(b, id);
    if (!n) return { status: "fehler", meldung: "Diese Notiz gibt es nicht mehr." };
    if (!darf(b.rolle, "notizen") && n.erinnern_an !== b.id && n.erstellt_von !== b.id) return { status: "fehler", meldung: "Dafür fehlt Ihnen die Berechtigung." };
    const am = wann === "stunde" ? new Date(Date.now() + 3600000) : berlin(plusTage(berlinDatum(), 1), "08:00");
    await db().from("notizen").update({ erinnern_am: am.toISOString(), erinnert_am: null, erledigt_am: null }).eq("id", id);
    neuLaden();
    return { status: "ok", meldung: wann === "stunde" ? "Erinnert in einer Stunde wieder." : "Erinnert morgen um 8 Uhr wieder." };
  });
}

export async function notizLoeschen(basis: Basis, id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("notizen");
    const n = await notizLaden(b, id);
    if (n) await db().from("notizen").delete().eq("id", n.id);
    neuLaden();
    redirect(basis);
  });
}
