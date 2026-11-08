import { TerminFormular } from "@/components/admin/termin-formular";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Termin eintragen" };

export default async function NeuerTermin() {
  await benutzerMitRecht("termine");
  const [{ data: leistungen }, { data: team }] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
  ]);
  return (
    <>
      <Kopf titel="Termin eintragen" unter="Für Kunden, die anrufen oder vorbeikommen. Der Termin ist sofort bestätigt und steht im Kalender." zurueck={{ href: "/admin/termine", text: "Termine" }} />
      <Abschnitt>
        <TerminFormular aktion={eintragenAktion.bind(null, "/admin/termine")} leistungen={((leistungen ?? []) as Leistung[]).filter(istTerminLeistung)} team={team ?? []} datum={berlinDatum()} />
      </Abschnitt>
    </>
  );
}
