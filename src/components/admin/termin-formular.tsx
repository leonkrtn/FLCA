import { Formular, Senden } from "./formular";
import type { KundenWahl } from "./kunden-suche";
import { LeistungenWahl } from "./leistungen-wahl";
import { TerminKunde } from "./termin-kunde";
import { Auswahl, Feld, Textfeld } from "./ui";
import type { Ergebnis } from "@/lib/forms";
import type { KundenTreffer } from "@/lib/kunden";
import type { TerminVorgabe } from "@/lib/sprache/vorgabe";

/**
 * Termin direkt eintragen (Telefonkunde). Admin und Handy-App. `vorgabe` füllt das Formular vor (Sprechen in
 * der Werkstatt-App); gespeichert wird trotzdem erst hier. Der Kunde lässt sich aus der Kartei wählen
 * (`kunde` wählt ihn vorab, z. B. von der Kundenseite), `zuletzt` sind die Vorschläge der Suche.
 */
export function TerminFormular({
  aktion,
  leistungen,
  team,
  datum,
  uhrzeit,
  kompakt = false,
  vorgabe,
  kunde,
  zuletzt = [],
  mitarbeiter,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  leistungen: { id: string; name: string; dauer_min: number }[];
  team: { id: string; name: string }[];
  datum: string;
  /** Vorgabe für die Uhrzeit (Klick in den Kalender) */
  uhrzeit?: string;
  kompakt?: boolean;
  vorgabe?: TerminVorgabe | null;
  kunde?: KundenWahl | null;
  zuletzt?: KundenTreffer[];
  /** Vorauswahl Mitarbeiter (Klick in eine Spalte der Tagesansicht) */
  mitarbeiter?: string;
}) {
  const v = vorgabe;
  return (
    <Formular aktion={aktion} className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
      <LeistungenWahl leistungen={leistungen} kompakt={kompakt} start={v?.leistungIds} frei={v?.leistungFrei} dauer={v?.dauer} />
      <Feld label="Datum" name="datum" typ="date" wert={v?.datum || datum} required />
      <Feld label="Uhrzeit" name="uhrzeit" typ="time" wert={v?.uhrzeit || uhrzeit} required />
      <TerminKunde
        start={kunde}
        zuletzt={zuletzt}
        kompakt={kompakt}
        werte={{ name: v?.name, telefon: v?.telefon, email: v?.email, kennzeichen: v?.kennzeichen, fahrzeug: v?.fahrzeug }}
      />
      {team.length ? (
        <Auswahl label="Mitarbeiter" name="zugewiesen_an" wert={v?.mitarbeiter || mitarbeiter} leer="automatisch (wer frei ist)" optionen={[...team.map((p): [string, string] => [p.id, p.name || "ohne Namen"]), ["-", "niemand"]]} />
      ) : null}
      <Textfeld label="Notiz" name="notiz" wert={v?.notiz} zeilen={2} className={kompakt ? "" : "sm:col-span-2"} />
      <label className={`flex items-center gap-2 text-sm text-grau ${kompakt ? "" : "sm:col-span-2"}`}>
        <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> trotzdem eintragen, auch wenn die Werkstatt voll ist oder der Mitarbeiter nicht kann
      </label>
      <div className={kompakt ? "" : "sm:col-span-2"}>
        <Senden art="dunkel" className={kompakt ? "w-full" : ""}>Termin eintragen</Senden>
      </div>
    </Formular>
  );
}
