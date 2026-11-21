import "server-only";
import { einstellungen } from "../einstellungen";
import { fahrzeugTypen } from "../kunden";
import { notizTeam } from "../notizen-seiten";
import { preislisteFuerBelege } from "../rechnung/rechnungen";
import { db } from "../supabase/admin";
import { istTerminLeistung, type Leistung } from "../termine";
import type { Leistungswahl } from "./verstehen";

/**
 * Was die Spracheingabe kennen muss, bei jedem Aufruf frisch aus der Datenbank: Leistungen und Preisliste
 * mit ihren weiteren Namen, Stundensätze, Team, Marken und Modelle aus der Kartei. Neue Angebote und
 * Umbenennungen gelten damit sofort, ohne Änderung am Code.
 */

export async function leistungenFuerSprache(): Promise<Leistungswahl[]> {
  const { data } = await db().from("leistungen").select("*").order("sortierung");
  return ((data ?? []) as Leistung[]).filter(istTerminLeistung).map((l) => ({ id: l.id, name: l.name, sprachnamen: l.sprachnamen ?? [] }));
}

export async function sprachGrundlagen() {
  const [leistungen, team, preisliste, e, typen] = await Promise.all([leistungenFuerSprache(), notizTeam(), preislisteFuerBelege(), einstellungen(), fahrzeugTypen()]);
  return {
    leistungen,
    team,
    typen,
    preisliste,
    stundensaetze: e.rechnung.stundensaetze,
    aufschlagProzent: e.rechnung.aufschlagProzent,
  };
}
