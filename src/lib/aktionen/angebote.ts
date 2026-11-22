"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, ja, text, zahl } from "../forms";
import { sicher } from "../sicher";
import { KATEGORIEN } from "../inhalte";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { istDatum } from "../zeit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Website, Terminbuchung und Belege lesen die Angebote beim Anzeigen; alles neu aufbauen. */
function ueberallNeu() {
  revalidatePath("/", "layout");
}

/**
 * Speichert ein Angebot. Der Wert heißt je nach Art etwas anderes: Prozent (ganze Zahl), Euro weniger oder
 * Festpreis (beides brutto, in Cent gespeichert). Ohne Kategorie und ohne einzelne Position wirkt es nirgends.
 */
export async function angebotSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("angebote");
    const titel = text(fd, "titel", 80);
    if (!titel) return { status: "fehler", meldung: "Bitte einen Titel angeben, z. B. Reifensaison." };

    const art = (["prozent", "euro", "festpreis"] as const).find((x) => x === fd.get("art")) ?? "prozent";
    const roh = zahl(fd, "wert");
    if (roh === null || roh < 0) return { status: "fehler", meldung: "Bitte den Rabatt bzw. Festpreis als Zahl angeben." };
    const wert = art === "prozent" ? Math.round(roh) : Math.round(roh * 100);
    if (art === "prozent" && (wert < 1 || wert > 100)) return { status: "fehler", meldung: "Prozent bitte zwischen 1 und 100." };
    if (art === "euro" && wert < 1) return { status: "fehler", meldung: "Bitte einen Betrag über 0 € angeben." };

    const von = text(fd, "von", 10);
    const bis = text(fd, "bis", 10);
    if (!istDatum(von)) return { status: "fehler", meldung: "Bitte angeben, ab wann das Angebot gilt." };
    if (bis && !istDatum(bis)) return { status: "fehler", meldung: "Das Enddatum ist ungültig." };
    if (bis && bis < von) return { status: "fehler", meldung: "Das Ende liegt vor dem Beginn." };

    const kategorien = [...new Set(fd.getAll("kategorien").map(String))].filter((k) => k in KATEGORIEN);
    const leistung_ids = [...new Set(fd.getAll("leistung_ids").map(String))].filter((x) => UUID.test(x)).slice(0, 200);
    if (!kategorien.length && !leistung_ids.length) return { status: "fehler", meldung: "Bitte mindestens eine Kategorie oder Leistung wählen." };

    const daten = {
      titel,
      kurztext: text(fd, "kurztext", 600),
      bedingungen: text(fd, "bedingungen", 600),
      bild_pfad: text(fd, "bild_pfad", 200) || null,
      art,
      wert,
      kategorien,
      leistung_ids,
      von,
      bis: bis || null,
      aktiv: ja(fd, "aktiv"),
    };
    const antwort = id ? await dbRoh().from("angebote").update(daten).eq("id", id).select("id").single() : await dbRoh().from("angebote").insert(daten).select("id").single();
    if (antwort.error) return { status: "fehler", meldung: antwort.error.message };
    ueberallNeu();
    if (!id) ziel = `/admin/angebote/${antwort.data.id}`;
    return { status: "ok", meldung: "Gespeichert. Website und Belege rechnen ab sofort damit, die Website zeigt es in wenigen Minuten." };
  });
  if (ziel) redirect(ziel);
  return e;
}

/** An- und Ausschalten aus der Liste, ohne das Formular zu öffnen. */
export async function angebotSchalten(id: string, an: boolean, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("angebote");
    const { error } = await db().from("angebote").update({ aktiv: an }).eq("id", id);
    if (error) throw new DbFehler(error);
    ueberallNeu();
    revalidatePath("/admin/angebote");
    return { status: "ok", meldung: an ? "Eingeschaltet." : "Ausgeschaltet." };
  });
}

/** Löschen ändert nichts an Terminen und Belegen: Die haben ihren Angebotspreis selbst gespeichert. */
export async function angebotLoeschen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("angebote");
    const { error } = await db().from("angebote").delete().eq("id", id);
    if (error) throw new DbFehler(error);
    ueberallNeu();
    return { status: "ok" };
  });
  if (e.status === "ok") redirect("/admin/angebote");
  return e;
}
