import { TerminFormular } from "@/components/admin/termin-formular";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen, kundenWahl } from "@/lib/kunden";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum, istDatum } from "@/lib/zeit";

export const metadata = { title: "Termin eintragen" };

/**
 * `?datum=…&uhrzeit=…` füllt vor (Klick in den Kalender), `?kalender=<Montag>` führt „zurück“ in diese Woche,
 * `?kunde=…&fz=…` wählt den Kunden aus der Kartei vor (Kundenseite).
 */
export default async function NeuerTermin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await benutzerMitRecht("termine");
  const s = await searchParams;
  const datum = istDatum(s.datum) ? s.datum : berlinDatum();
  const uhrzeit = typeof s.uhrzeit === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.uhrzeit) ? s.uhrzeit : undefined;
  const kunde = await kundenWahl(s.kunde, s.fz);
  const zurueck = istDatum(s.kalender)
    ? { href: `/admin/kalender?woche=${s.kalender}`, text: "Kalender" }
    : kunde
      ? { href: `/admin/kunden/${kunde.kunde.id}`, text: kunde.kunde.name }
      : { href: "/admin/termine", text: "Termine" };
  const [{ data: leistungen }, { data: team }, zuletzt] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
    kundenSuchen("", 8),
  ]);
  return (
    <>
      <Kopf titel="Termin eintragen" unter="Für Kunden, die anrufen oder vorbeikommen. Der Termin ist sofort bestätigt und steht im Kalender." zurueck={zurueck} />
      <Abschnitt>
        <TerminFormular aktion={eintragenAktion.bind(null, "/admin/termine")} leistungen={((leistungen ?? []) as Leistung[]).filter(istTerminLeistung)} team={team ?? []} datum={datum} uhrzeit={uhrzeit} kunde={kunde} zuletzt={zuletzt} />
      </Abschnitt>
    </>
  );
}
