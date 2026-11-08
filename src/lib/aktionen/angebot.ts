"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { centAus, type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { darf } from "../rollen";
import { db } from "../supabase/admin";

function adresse(roh: string): string {
  return roh
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Speichert eine Position des Angebots (Tabelle leistungen). Preis, Nummer, Einheit und MwSt. darf, wer
 * Rechnungen schreibt. Was die Website zeigt (Texte, Bild, sichtbar, buchbar), nur, wer die Website
 * pflegen darf; für alle anderen bleiben diese Felder wie sie sind.
 *
 * Regeln, damit nichts Widersprüchliches gespeichert wird: Eine Position (Teil, Material) ist nie auf der
 * Website. Ausgeblendet heißt überall weg. Online buchbar geht nur, was auch auf der Website steht.
 */
export async function angebotSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const website = darf(b.rolle, "website");
    const name = text(fd, "name", 120);
    if (!name) return { status: "fehler", meldung: "Bitte eine Bezeichnung angeben." };
    const art = fd.get("art") === "position" ? "position" : "leistung";
    const aktiv = ja(fd, "aktiv");
    const satz = zahl(fd, "mwst_satz") ?? 19;

    const daten: Record<string, unknown> = {
      name,
      nummer: text(fd, "nummer", 40),
      einheit: text(fd, "einheit", 20) || "Pauschal",
      preis_cent: centAus(fd, "preis"),
      mwst_satz: [0, 7, 19].includes(satz) ? satz : 19,
      art,
      aktiv,
    };
    // Die Dauer steht im Bereich „Termin und Website“, der ohne Website-Recht gesperrt ist und dann nicht mitgeschickt wird.
    if (fd.has("dauer_min")) daten.dauer_min = Math.min(Math.max(Math.round(zahl(fd, "dauer_min") ?? 60), 5), 720);
    if (website) {
      const sichtbar = aktiv && art === "leistung" && ja(fd, "sichtbar");
      Object.assign(daten, {
        preis_ab: ja(fd, "preis_ab"),
        sichtbar,
        online_anfragbar: sichtbar && ja(fd, "online_anfragbar"),
        kategorie: text(fd, "kategorie", 20) || "service",
        kurz: text(fd, "kurz", 160),
        beschreibung: text(fd, "beschreibung", 4000),
        bild_pfad: text(fd, "bild_pfad", 200) || null,
        sortierung: Math.round(zahl(fd, "sortierung") ?? 0),
      });
    } else if (!aktiv || art === "position") {
      // Auch ohne Website-Recht darf eine ausgeblendete Position nicht online stehen bleiben.
      Object.assign(daten, { sichtbar: false, online_anfragbar: false });
    }

    // Die Adresse (Slug) braucht jede Zeile. Für Positionen ohne Website wird sie still erzeugt.
    const gewuenscht = website ? adresse(text(fd, "slug", 80) || name) : "";
    if (!id) daten.slug = (art === "position" ? `position-${adresse(name)}` : gewuenscht || adresse(name)) || `position-${randomBytes(4).toString("hex")}`;
    else if (website && art === "leistung" && gewuenscht) daten.slug = gewuenscht;

    let antwort = id ? await db().from("leistungen").update(daten).eq("id", id).select("id").single() : await db().from("leistungen").insert(daten).select("id").single();
    if (antwort.error?.code === "23505" && art === "position") {
      daten.slug = `${daten.slug ?? `position-${adresse(name)}`}-${randomBytes(2).toString("hex")}`;
      antwort = id ? await db().from("leistungen").update(daten).eq("id", id).select("id").single() : await db().from("leistungen").insert(daten).select("id").single();
    }
    if (antwort.error) return { status: "fehler", meldung: antwort.error.code === "23505" ? "Diese Webadresse (Slug) gibt es schon." : antwort.error.message };
    if (!id) ziel = `/admin/angebot/${antwort.data.id}`;
    revalidatePath("/", "layout");
    return { status: "ok", meldung: website ? "Gespeichert. Die Website zeigt es in wenigen Minuten." : "Gespeichert." };
  });
  if (ziel) redirect(ziel);
  return e;
}
