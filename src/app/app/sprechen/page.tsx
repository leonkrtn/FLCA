import { MobilKopf } from "@/components/mobil/teile";
import { SprachEingabe } from "@/components/mobil/sprach-eingabe";
import { spracheUebernehmen } from "@/lib/aktionen/sprache";
import { benutzerMitRecht } from "@/lib/auth";
import { sprachGrundlagen } from "@/lib/sprache/daten";

export const metadata = { title: "Sprechen" };

/**
 * Notiz, Termin oder Rechnung per Sprache. Erkennung mit festen Regeln im Code (`src/lib/sprache/`), die
 * Begriffe (Preisliste, Team, Fahrzeuge) kommen bei jedem Aufruf aus der Datenbank.
 */
export default async function Sprechen() {
  await benutzerMitRecht("termine");
  const { leistungen, team, typen, ...grundlagen } = await sprachGrundlagen();
  return (
    <>
      <MobilKopf titel="Sprechen" unter="Notiz, Termin oder Rechnung" />
      <SprachEingabe aktion={spracheUebernehmen} leistungen={leistungen} team={team} typen={typen} grundlagen={grundlagen} />
    </>
  );
}
