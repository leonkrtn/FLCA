"use server";

import { revalidatePath } from "next/cache";
import { alsObjekte, csvLesen, type DateiArt, dateiArt, planen } from "../altbestand/lesen";
import { uebernehmen } from "../altbestand/uebernehmen";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, ja } from "../forms";
import { sicher } from "../sicher";

const NAMEN: Record<DateiArt, string> = { kunden: "Kunden", rechnungen: "Rechnungen", positionen: "Positionen" };
// Server Actions nehmen höchstens 1 MB an; die drei Dateien aus 150 Rechnungen sind zusammen unter 100 KB.
const MAX_BYTES = 900_000;

/** Einstellungen → Datenübernahme: kunden.csv, rechnungen.csv und positionen.csv (eine, zwei oder alle drei). */
export async function altbestandUebernehmen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    const probelauf = ja(fd, "probelauf");
    const dateien = fd.getAll("dateien").filter((d): d is File => d instanceof File && d.size > 0);
    if (!dateien.length) return { status: "fehler", meldung: "Bitte mindestens eine CSV-Datei auswählen." };
    if (dateien.reduce((s, d) => s + d.size, 0) > MAX_BYTES) return { status: "fehler", meldung: "Die Dateien sind zusammen zu groß (höchstens 900 KB). Bitte einzeln einlesen." };

    const gelesen: Partial<Record<DateiArt, Record<string, string>[]>> = {};
    for (const d of dateien) {
      const zeilen = csvLesen(await d.text());
      const art = zeilen[0] ? dateiArt(zeilen[0]) : null;
      if (!art) return { status: "fehler", meldung: `${d.name}: unbekannte Spalten. Erwartet werden kunden.csv, rechnungen.csv oder positionen.csv aus der Übernahme der alten Rechnungen.` };
      if (gelesen[art]) return { status: "fehler", meldung: `Zwei Dateien mit ${NAMEN[art]} ausgewählt. Bitte nur eine je Art.` };
      gelesen[art] = alsObjekte(zeilen);
    }

    const b = await uebernehmen(planen(gelesen), probelauf);
    if (!probelauf) revalidatePath("/admin", "layout");
    const satz =
      `${probelauf ? "Probelauf, nichts gespeichert. Es würden" : "Übernommen:"} ` +
      `${b.kunden.neu} Kunden neu angelegt${b.kunden.vorhanden ? ` (${b.kunden.vorhanden} schon in der Kartei, nur ergänzt)` : ""}, ` +
      `${b.fahrzeuge.neu} Fahrzeuge neu${b.fahrzeuge.ergaenzt ? `, ${b.fahrzeuge.ergaenzt} ergänzt` : ""}, ` +
      `${b.rechnungen.neu} frühere Rechnungen mit ${b.positionen} Positionen${b.rechnungen.vorhanden ? ` (${b.rechnungen.vorhanden} waren schon da)` : ""}` +
      `${probelauf ? " übernommen." : "."}`;
    return { status: "ok", meldung: satz, daten: { hinweise: b.hinweise } };
  });
}
