import { TerminFormular } from "@/components/admin/termin-formular";
import { MobilKopf } from "@/components/mobil/teile";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { terminVorgabeAus } from "@/lib/sprache/vorgabe";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Termin eintragen" };

export default async function Neu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await benutzerMitRecht("termine");
  // Vom Sprechen: erkannte Angaben stehen in der Adresse
  const vorgabe = terminVorgabeAus(await searchParams);
  const [{ data: l }, { data: team }] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
  ]);
  return (
    <>
      <MobilKopf titel="Termin eintragen" unter={vorgabe ? "Aus der Sprachaufnahme, bitte prüfen" : "Ist sofort bestätigt"} zurueck={vorgabe ? "/app/sprechen" : undefined} />
      <div className="bg-weiss p-4">
        <TerminFormular kompakt aktion={eintragenAktion.bind(null, "/app/termine")} leistungen={((l ?? []) as Leistung[]).filter(istTerminLeistung)} team={team ?? []} datum={berlinDatum()} vorgabe={vorgabe} />
      </div>
    </>
  );
}
