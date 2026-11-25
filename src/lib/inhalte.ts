import "server-only";
import { cache } from "react";
import { laufendeAngebote } from "./angebote/daten";
import { angeboteAnwenden } from "./angebote/preise";
import { KONFIGURIERT } from "./env";
import { db, DbFehler, dbRoh } from "./supabase/admin";
import type { Leistung } from "./termine";
import { berlinDatum } from "./zeit";
import { fehlerMelden, weich } from "./fehler";

/**
 * Inhalte der öffentlichen Website. Ohne Datenbank (lokale Vorschau, Build ohne Zugangsdaten) gelten die
 * Startwerte aus der ersten Migration, damit die Seite nie leer ist.
 */

const START_LEISTUNGEN: Omit<Leistung, "id">[] = [
  ["radwechsel", "Radwechsel", "Sommer auf Winter oder zurück, inkl. Auswuchten", "reifen", 4000, false, 30],
  ["reifenmontage", "Reifenmontage", "Neue Reifen auf die Felge, inkl. Ventil", "reifen", 10000, false, 60],
  ["raedereinlagerung", "Rädereinlagerung", "Ihre Räder lagern sauber bei uns", "reifen", null, false, 15],
  ["oelwechsel", "Ölwechsel inkl. Filter", "Markenöl, Ölfilter, Service zurückgesetzt", "service", 9500, true, 45],
  ["inspektion", "Inspektion", "Wartung nach Herstellervorgabe", "service", null, false, 120],
  ["reparatur", "Reparatur", "Bremsen, Fahrwerk, Auspuff und mehr", "service", null, false, 120],
  ["klimaservice", "Klimaservice", "Klimaanlage prüfen und befüllen", "service", null, false, 60],
  ["hu-vorbereitung", "HU/AU-Vorbereitung", "Ihr Auto fit für die Prüfung", "service", null, false, 90],
  ["hohlraumversiegelung", "Hohlraumversiegelung", "Langzeit-Rostschutz für Türen und Schweller", "schutz", 20000, true, 480],
  ["unterbodenschutz", "Unterbodenschutz", "Unterboden reinigen und versiegeln", "schutz", 9000, true, 180],
].map(([slug, name, kurz, kategorie, preis, ab, dauer], i) => ({
  slug: slug as string,
  name: name as string,
  kurz: kurz as string,
  beschreibung: kurz as string,
  kategorie: kategorie as string,
  preis_cent: preis as number | null,
  preis_ab: ab as boolean,
  dauer_min: dauer as number,
  online_anfragbar: true,
  sichtbar: true,
  sortierung: i,
  bild_pfad: null,
}));

export const KATEGORIEN: Record<string, string> = {
  reifen: "Reifen",
  service: "Service und Reparatur",
  aufbereitung: "Aufbereitung",
  schutz: "Rostschutz",
};

/**
 * Leistungen der Website mit laufenden Angeboten: preis_cent ist der geltende Preis, angebot nennt den
 * Listenpreis für den durchgestrichenen Betrag. Die Website zeigt also nie einen Preis, den es nicht gibt.
 */
export const oeffentlicheLeistungen = cache(async (): Promise<Leistung[]> => {
  if (!KONFIGURIERT.supabaseAdmin) return START_LEISTUNGEN.map((l) => ({ ...l, id: l.slug, angebot: null }));
  const [{ data, error }, angebote] = await Promise.all([dbRoh().from("leistungen").select("*").eq("sichtbar", true).order("sortierung"), laufendeAngebote()]);
  // Noch nicht migriert oder Datenbank kurz weg: lieber die Startdaten zeigen als eine Fehlerseite.
  if (error) {
    await fehlerMelden(new DbFehler(error, { tabelle: "leistungen" }), "Leistungen für die Website laden");
    return START_LEISTUNGEN.map((l) => ({ ...l, id: l.slug, angebot: null }));
  }
  return angeboteAnwenden(data as Leistung[], angebote, berlinDatum());
});

export type Bewertung = { id: string; name: string; text: string; sterne: number; quelle: string };

export const bewertungen = cache(async (): Promise<Bewertung[]> => {
  if (!KONFIGURIERT.supabaseAdmin) {
    return [
      { id: "1", name: "Ruan Sonnen", sterne: 5, quelle: "Google", text: "Super Service rund ums Auto, einfache unkomplizierte Terminvereinbarung und qualitativ hochwertige Arbeit. Dringend weiterzuempfehlen!" },
      { id: "2", name: "Sam Paxton", sterne: 5, quelle: "Google", text: "Sehr professionelle und kompetente Werkstatt. Die Mitarbeiter sind freundlich und wissen genau, was sie tun. Die Arbeiten wurden schnell und sauber erledigt." },
      { id: "3", name: "A. F.", sterne: 5, quelle: "Google", text: "War schon mehrfach mit meinem Auto dort und immer sehr zufrieden. Besonders der freundliche Service und die ehrliche Beratung zeichnen den Betrieb aus." },
    ];
  }
  // Website-Abschnitt: bei einem Fehler fehlt er eben, die Seite bleibt erreichbar (Fehler ins Protokoll)
  return weich(async () => {
    const { data } = await db().from("bewertungen").select("id, name, text, sterne, quelle").eq("sichtbar", true).order("sortierung").limit(6);
    return (data ?? []) as Bewertung[];
  }, [], "Bewertungen für die Website laden");
});

export type Stelle = { id: string; titel: string; umfang: string; einleitung: string; aufgaben: string; profil: string; wir_bieten: string };

export const stellen = cache(async (): Promise<Stelle[]> => {
  if (!KONFIGURIERT.supabaseAdmin) {
    return [{ id: "beispiel", titel: "Kfz-Mechatroniker (m/w/d)", umfang: "Vollzeit", einleitung: "Für unsere Werkstatt in Dietzenbach suchen wir Verstärkung.", aufgaben: "Reifenservice, Ölwechsel und Inspektionen\nReparaturen an Bremsen und Fahrwerk", profil: "Abgeschlossene Ausbildung als Kfz-Mechatroniker oder vergleichbar", wir_bieten: "Feste Arbeitszeiten, samstags nur bis 13 Uhr" }];
  }
  return weich(async () => {
    const { data } = await db().from("stellen").select("*").eq("aktiv", true).order("sortierung");
    return (data ?? []) as Stelle[];
  }, [], "Stellen für die Website laden");
});
