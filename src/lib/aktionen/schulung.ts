"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, ja, text, zahl } from "../forms";
import { sicher } from "../sicher";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { lektionLaden } from "../schulung/daten";
import { bilderIn, schlagwoerterLesen, videoErkennen } from "../schulung/inhalt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (fd: FormData, name: string) => [...new Set(fd.getAll(name).map(String))].filter((x) => UUID.test(x)).slice(0, 200);

/** Verwaltung, Team-App (Liste, Lektion) und „Anleitung“ am Auftrag lesen dieselben Daten. */
function neuAufbauen() {
  revalidatePath("/admin/schulung", "layout");
  revalidatePath("/team", "layout");
}

/** Bilder, die nicht mehr im Text stehen, aus dem Speicher nehmen. Ein Fehler hier darf das Speichern nicht kippen. */
async function bilderAufraeumen(vorher: string[], nachher: string[]) {
  const weg = vorher.filter((p) => !nachher.includes(p));
  if (weg.length) await db().storage.from("schulung").remove(weg);
}

/**
 * Speichert eine Lektion. Der Video-Link muss YouTube oder Vimeo sein, sonst sähe das Team nur einen leeren
 * Rahmen. „Siehe auch“ ohne die Lektion selbst.
 */
export async function lektionSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    const b = await benutzerMitRecht("schulung");
    const titel = text(fd, "titel", 120);
    if (!titel) return { status: "fehler", meldung: "Bitte einen Titel angeben, z. B. „Räder wechseln“." };
    const kategorie_id = text(fd, "kategorie_id", 40);
    if (!UUID.test(kategorie_id)) return { status: "fehler", meldung: "Bitte eine Kategorie wählen." };

    const video_url = text(fd, "video_url", 500);
    if (video_url && !videoErkennen(video_url)) return { status: "fehler", meldung: "Der Video-Link wird nicht erkannt. Bitte den Link eines YouTube- oder Vimeo-Videos einfügen." };

    const dauerRoh = zahl(fd, "dauer_min");
    const dauer_min = dauerRoh === null ? null : Math.round(dauerRoh);
    if (dauer_min !== null && (dauer_min < 1 || dauer_min > 600)) return { status: "fehler", meldung: "Die Dauer bitte in Minuten angeben (1 bis 600)." };

    const inhalt = text(fd, "inhalt", 50000);
    const daten = {
      titel,
      kategorie_id,
      kurz: text(fd, "kurz", 300),
      inhalt,
      video_url: video_url || null,
      dauer_min,
      schlagwoerter: schlagwoerterLesen(text(fd, "schlagwoerter", 1000)),
      werkzeug: text(fd, "werkzeug", 2000),
      sicherheit: text(fd, "sicherheit", 2000),
      leistung_ids: ids(fd, "leistung_ids"),
      siehe_auch: ids(fd, "siehe_auch").filter((x) => x !== id),
      veroeffentlicht: ja(fd, "veroeffentlicht"),
      aktualisiert_von: b.id,
    };

    if (id) {
      const alt = await lektionLaden(id);
      if (!alt) return { status: "fehler", meldung: "Diese Lektion gibt es nicht mehr." };
      await db().from("schulung_lektionen").update(daten).eq("id", id);
      await bilderAufraeumen(bilderIn(alt.inhalt), bilderIn(inhalt));
    } else {
      // Neue Lektionen ans Ende ihrer Kategorie
      const { data: letzte } = await db().from("schulung_lektionen").select("sortierung").eq("kategorie_id", kategorie_id).order("sortierung", { ascending: false }).limit(1);
      const sortierung = (letzte?.[0]?.sortierung ?? -1) + 1;
      const { data } = await db().from("schulung_lektionen").insert({ ...daten, sortierung }).select("id").single();
      ziel = `/admin/schulung/${data!.id}`;
    }
    neuAufbauen();
    return { status: "ok", meldung: daten.veroeffentlicht ? "Gespeichert. Das Team sieht die Lektion in der Team-App." : "Als Entwurf gespeichert. Das Team sieht sie erst, wenn sie veröffentlicht ist." };
  });
  if (ziel) redirect(ziel);
  return e;
}

/** Veröffentlichen oder zurück in den Entwurf, direkt aus der Liste. */
export async function lektionVeroeffentlichen(id: string, an: boolean, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("schulung");
    await db().from("schulung_lektionen").update({ veroeffentlicht: an, aktualisiert_von: b.id }).eq("id", id);
    neuAufbauen();
    return { status: "ok", meldung: an ? "Veröffentlicht." : "Zurück im Entwurf." };
  });
}

/** Archivieren nimmt die Lektion aus der Team-App, ohne etwas zu löschen. Zurückholen setzt sie wieder ein, wie sie war. */
export async function lektionArchivieren(id: string, archivieren: boolean, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("schulung");
    await db()
      .from("schulung_lektionen")
      .update({ archiviert_am: archivieren ? new Date().toISOString() : null, aktualisiert_von: b.id })
      .eq("id", id);
    neuAufbauen();
    return { status: "ok", meldung: archivieren ? "Archiviert. Das Team sieht die Lektion nicht mehr." : "Zurückgeholt." };
  });
}

/** Endgültig löschen geht nur aus dem Archiv, mit allen Bildern. Verweise anderer Lektionen fallen beim Anzeigen heraus. */
export async function lektionLoeschen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("schulung");
    const l = await lektionLaden(id);
    if (!l) return { status: "ok" };
    if (!l.archiviert_am) return { status: "fehler", meldung: "Bitte die Lektion zuerst archivieren. Endgültig löschen geht nur aus dem Archiv." };
    await db().from("schulung_lektionen").delete().eq("id", id);
    await bilderAufraeumen(bilderIn(l.inhalt), []);
    neuAufbauen();
    return { status: "ok", meldung: "Endgültig gelöscht." };
  });
  // Auch von der Lektion selbst aus: Die gibt es danach nicht mehr, also zurück ins Archiv
  if (e.status === "ok") redirect("/admin/schulung?ansicht=archiv");
  return e;
}

/**
 * Neue Reihenfolge nach Ziehen oder Pfeil. `ids` in der gewünschten Reihenfolge; nur Lektionen derselben
 * Kategorie bzw. alle Kategorien.
 */
export async function reihenfolgeSpeichern(art: "kategorien" | "lektionen", reihenfolge: string[]): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("schulung");
    const liste = reihenfolge.filter((x) => UUID.test(x)).slice(0, 500);
    const tabelle = art === "kategorien" ? "schulung_kategorien" : "schulung_lektionen";
    await Promise.all(liste.map((id, i) => db().from(tabelle).update({ sortierung: i }).eq("id", id)));
    neuAufbauen();
    return { status: "ok" };
  });
}

export async function kategorieSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("schulung");
    const name = text(fd, "name", 60);
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen angeben, z. B. „Reifen und Räder“." };
    if (id) await db().from("schulung_kategorien").update({ name }).eq("id", id);
    else {
      const { data: letzte } = await db().from("schulung_kategorien").select("sortierung").order("sortierung", { ascending: false }).limit(1);
      await db().from("schulung_kategorien").insert({ name, sortierung: (letzte?.[0]?.sortierung ?? -1) + 1 });
    }
    neuAufbauen();
    return { status: "ok", meldung: id ? "Umbenannt." : "Kategorie angelegt." };
  });
}

/** Nur leere Kategorien (auch ohne archivierte Lektionen): Die Datenbank lehnt sonst ab (on delete restrict). */
export async function kategorieLoeschen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("schulung");
    const { error } = await dbRoh().from("schulung_kategorien").delete().eq("id", id);
    if (error?.code === "23503") return { status: "fehler", meldung: "In dieser Kategorie stehen noch Lektionen (auch im Archiv). Bitte erst verschieben oder löschen." };
    if (error) throw new DbFehler(error, { tabelle: "schulung_kategorien" });
    neuAufbauen();
    return { status: "ok", meldung: "Kategorie gelöscht." };
  });
}
