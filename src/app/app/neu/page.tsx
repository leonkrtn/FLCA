import { TerminFormular } from "@/components/admin/termin-formular";
import { MobilKopf } from "@/components/mobil/teile";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen, kundenWahl } from "@/lib/kunden";
import { terminVorgabeAus } from "@/lib/sprache/vorgabe";
import { db } from "@/lib/supabase/admin";
import { kvVorlage } from "@/lib/termin-daten";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Termin eintragen" };

export default async function Neu({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await benutzerMitRecht("termine");
  // Vom Sprechen: erkannte Angaben stehen in der Adresse; ?kunde=…&fz=… wählt den Kunden aus der Kartei vor
  const s = await searchParams;
  const vorgabe = terminVorgabeAus(s);
  // ?kv=… Termin zu einem Kostenvoranschlag, ?auftrag=1 Werkstattauftrag gleich mit anlegen
  const kv = await kvVorlage(s.kv);
  const mitAuftrag = s.auftrag === "1";
  const [{ data: l }, { data: team }, zuletzt, kunde] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
    kundenSuchen("", 8),
    kundenWahl(kv?.kundeId ?? s.kunde, kv?.fahrzeugId ?? s.fz),
  ]);
  return (
    <>
      <MobilKopf
        titel={mitAuftrag ? "Neuer Auftrag" : "Termin eintragen"}
        unter={vorgabe ? "Aus der Sprachaufnahme, bitte prüfen" : kv ? `Zum Kostenvoranschlag ${kv.nummer}` : mitAuftrag ? "Termin und Werkstattauftrag in einem" : "Ist sofort bestätigt"}
        zurueck={vorgabe ? "/app/sprechen" : kv ? `/app/kostenvoranschlaege/${kv.id}` : kunde ? `/app/kunden/${kunde.kunde.id}` : undefined}
      />
      <div className="bg-weiss p-4">
        <TerminFormular kompakt aktion={eintragenAktion.bind(null, "/app/termine")} leistungen={((l ?? []) as Leistung[]).filter(istTerminLeistung)} team={team ?? []} datum={berlinDatum()} vorgabe={vorgabe} kunde={kunde} zuletzt={zuletzt}
          leistungIds={kv?.leistungIds}
          versteckt={{ ...(kv && { kv: kv.id }), ...(mitAuftrag && { auftrag: "1" }) }}
          knopf={mitAuftrag ? "Termin und Auftrag anlegen" : "Termin eintragen"}
        />
      </div>
    </>
  );
}
