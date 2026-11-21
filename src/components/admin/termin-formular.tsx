import { Formular, Senden } from "./formular";
import { LeistungenWahl } from "./leistungen-wahl";
import { Auswahl, Feld, Textfeld } from "./ui";
import type { Ergebnis } from "@/lib/forms";
import type { TerminVorgabe } from "@/lib/sprache/vorgabe";

/**
 * Termin direkt eintragen (Telefonkunde). Admin und Handy-App. `vorgabe` füllt das Formular vor (Sprechen in
 * der Werkstatt-App); gespeichert wird trotzdem erst hier.
 */
export function TerminFormular({
  aktion,
  leistungen,
  team,
  datum,
  kompakt = false,
  vorgabe,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  leistungen: { id: string; name: string; dauer_min: number }[];
  team: { id: string; name: string }[];
  datum: string;
  kompakt?: boolean;
  vorgabe?: TerminVorgabe | null;
}) {
  const v = vorgabe;
  return (
    <Formular aktion={aktion} className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
      <LeistungenWahl leistungen={leistungen} kompakt={kompakt} start={v?.leistungIds} frei={v?.leistungFrei} dauer={v?.dauer} />
      <Feld label="Datum" name="datum" typ="date" wert={v?.datum || datum} required />
      <Feld label="Uhrzeit" name="uhrzeit" typ="time" wert={v?.uhrzeit} required />
      <Feld label="Name" name="name" wert={v?.name} required autoComplete="off" />
      <Feld label="Telefon" name="telefon" typ="tel" wert={v?.telefon} inputMode="tel" />
      <Feld label="Kennzeichen" name="kennzeichen" wert={v?.kennzeichen} autoCapitalize="characters" className="uppercase-input" />
      <Feld label="E-Mail (für die Bestätigung)" name="email" typ="email" wert={v?.email} />
      {!kompakt || v?.fahrzeug ? <Feld label="Fahrzeug" name="fahrzeug" wert={v?.fahrzeug} placeholder="Marke, Modell" /> : null}
      {team.length ? <Auswahl label="Mitarbeiter" name="zugewiesen_an" wert={v?.mitarbeiter} leer="niemand" optionen={team.map((p) => [p.id, p.name])} /> : null}
      <Textfeld label="Notiz" name="notiz" wert={v?.notiz} zeilen={2} className={kompakt ? "" : "sm:col-span-2"} />
      <label className={`flex items-center gap-2 text-sm text-grau ${kompakt ? "" : "sm:col-span-2"}`}>
        <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch eintragen, wenn die Werkstatt zu der Zeit voll ist
      </label>
      <div className={kompakt ? "" : "sm:col-span-2"}>
        <Senden art="dunkel" className={kompakt ? "w-full" : ""}>Termin eintragen</Senden>
      </div>
    </Formular>
  );
}
