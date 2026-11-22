import { TerminFormular } from "@/components/admin/termin-formular";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen, kundenWahl } from "@/lib/kunden";
import { db } from "@/lib/supabase/admin";
import { kvVorlage } from "@/lib/termin-daten";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum, istDatum } from "@/lib/zeit";

export const metadata = { title: "Termin eintragen" };

/**
 * `?datum=…&uhrzeit=…` füllt vor (Klick in den Kalender), `?kalender=<Montag>` führt „zurück“ in diese Woche,
 * `?kunde=…&fz=…` wählt den Kunden aus der Kartei vor (Kundenseite), `?an=<Person>` den Mitarbeiter und
 * `?tag=<Datum>` führt zurück in die Tagesansicht des Kalenders. `?auftrag=1` legt gleich den Werkstattauftrag
 * an (neuer Auftrag ohne Anfrage), `?kv=…` verknüpft den Termin mit einem Kostenvoranschlag.
 */
export default async function NeuerTermin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await benutzerMitRecht("termine");
  const s = await searchParams;
  const datum = istDatum(s.datum) ? s.datum : berlinDatum();
  const uhrzeit = typeof s.uhrzeit === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.uhrzeit) ? s.uhrzeit : undefined;
  const kv = await kvVorlage(s.kv);
  const kunde = await kundenWahl(kv?.kundeId ?? s.kunde, kv?.fahrzeugId ?? s.fz);
  const mitAuftrag = s.auftrag === "1";
  const mitarbeiter = typeof s.an === "string" && /^[0-9a-f-]{36}$/.test(s.an) ? s.an : undefined;
  const zurueck = kv
    ? { href: `/admin/kostenvoranschlaege/${kv.id}`, text: `Kostenvoranschlag ${kv.nummer}` }
    : istDatum(s.tag)
    ? { href: `/admin/kalender?tag=${s.tag}`, text: "Kalender" }
    : istDatum(s.kalender)
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
      <Kopf
        titel={mitAuftrag ? "Neuer Werkstattauftrag" : "Termin eintragen"}
        unter={
          kv
            ? `Termin zum Kostenvoranschlag ${kv.nummer}. Ist er angenommen, ist der Werkstattauftrag damit erteilt.`
            : mitAuftrag
              ? "Termin und Werkstattauftrag in einem. Danach unterschreibt der Kunde am Gerät oder bekommt den Auftrag per E-Mail."
              : "Für Kunden, die anrufen oder vorbeikommen. Der Termin ist sofort bestätigt und steht im Kalender."
        }
        zurueck={zurueck}
      />
      <Abschnitt>
        <TerminFormular aktion={eintragenAktion.bind(null, "/admin/termine")} leistungen={((leistungen ?? []) as Leistung[]).filter(istTerminLeistung)} team={team ?? []} datum={datum} uhrzeit={uhrzeit} kunde={kunde} zuletzt={zuletzt} mitarbeiter={mitarbeiter}
          leistungIds={kv?.leistungIds}
          versteckt={{ ...(kv && { kv: kv.id }), ...(mitAuftrag && { auftrag: "1" }) }}
          knopf={mitAuftrag ? "Termin und Auftrag anlegen" : "Termin eintragen"}
        />
      </Abschnitt>
    </>
  );
}
