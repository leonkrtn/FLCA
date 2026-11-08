import { Formular, Senden } from "./formular";
import { Auswahl, Feld, Textfeld } from "./ui";
import type { Ergebnis } from "@/lib/forms";

/** Termin direkt eintragen (Telefonkunde). Admin und Handy-App. */
export function TerminFormular({
  aktion,
  leistungen,
  team,
  datum,
  kompakt = false,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  leistungen: { id: string; name: string; dauer_min: number }[];
  team: { id: string; name: string }[];
  datum: string;
  kompakt?: boolean;
}) {
  return (
    <Formular aktion={aktion} className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
      <Auswahl label="Leistung" name="leistung" leer="Andere (unten eintragen)" optionen={leistungen.map((l) => [l.id, `${l.name} (${l.dauer_min} min)`])} className={kompakt ? "" : "sm:col-span-2"} />
      <Feld label="Andere Leistung" name="leistung_frei" placeholder="z. B. Bremsen vorne" />
      <Feld label="Dauer in Minuten (nur bei anderer Leistung)" name="dauer" inputMode="numeric" placeholder="60" />
      <Feld label="Datum" name="datum" typ="date" wert={datum} required />
      <Feld label="Uhrzeit" name="uhrzeit" typ="time" step={900} required />
      <Feld label="Name" name="name" required autoComplete="off" />
      <Feld label="Telefon" name="telefon" typ="tel" inputMode="tel" />
      <Feld label="Kennzeichen" name="kennzeichen" autoCapitalize="characters" className="uppercase-input" />
      <Feld label="E-Mail (für die Bestätigung)" name="email" typ="email" />
      {!kompakt ? <Feld label="Fahrzeug" name="fahrzeug" placeholder="Marke, Modell" /> : null}
      {team.length ? <Auswahl label="Mitarbeiter" name="zugewiesen_an" leer="niemand" optionen={team.map((p) => [p.id, p.name])} /> : null}
      <Textfeld label="Notiz" name="notiz" zeilen={2} className={kompakt ? "" : "sm:col-span-2"} />
      <label className={`flex items-center gap-2 text-sm text-grau ${kompakt ? "" : "sm:col-span-2"}`}>
        <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch eintragen, wenn die Werkstatt zu der Zeit voll ist
      </label>
      <div className={kompakt ? "" : "sm:col-span-2"}>
        <Senden art="dunkel" className={kompakt ? "w-full" : ""}>Termin eintragen</Senden>
      </div>
    </Formular>
  );
}
