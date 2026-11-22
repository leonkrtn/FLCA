import { TerminFormular } from "@/components/admin/termin-formular";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { eintragenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen, kundenWahl } from "@/lib/kunden";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

export const metadata = { title: "Neuer Werkstattauftrag" };

/**
 * Werkstattauftrag von Hand, z. B. wenn der Kunde mit dem Auto vor der Tür steht. Der Auftrag hängt wie
 * immer an einem Termin, damit Kalender, Mails, Ereignisse und die Rechnung zum Termin unverändert greifen;
 * vorbelegt ist deshalb heute, jetzt. Danach geht es direkt in die Positionen (`weiter=auftrag`).
 * `?kunde=…&fz=…` wählt den Kunden aus der Kartei vor.
 */
export default async function NeuerAuftrag({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await benutzerMitRecht("termine");
  const s = await searchParams;
  const kunde = await kundenWahl(s.kunde, s.fz);
  // Auf die Viertelstunde abgerundet, wie man es auch von Hand eintragen würde
  const [h, m] = berlinUhrzeit(new Date()).split(":").map(Number);
  const uhrzeit = `${String(h).padStart(2, "0")}:${String(m - (m % 15)).padStart(2, "0")}`;
  const [{ data: leistungen }, { data: team }, zuletzt] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    db().from("profile").select("id, name").eq("aktiv", true).not("rolle", "is", null).order("name"),
    kundenSuchen("", 8),
  ]);
  return (
    <>
      <Kopf
        titel="Neuer Werkstattauftrag"
        unter="Kunde und Fahrzeug wählen, danach die Positionen eintragen. Leistungen sind freiwillig; Datum und Uhrzeit bestimmen, wann das Auto im Kalender steht."
        zurueck={kunde ? { href: `/admin/kunden/${kunde.kunde.id}`, text: kunde.kunde.name } : { href: "/admin/auftraege", text: "Werkstattaufträge" }}
      />
      <Abschnitt>
        <TerminFormular
          aktion={eintragenAktion.bind(null, "/admin/termine")}
          leistungen={((leistungen ?? []) as Leistung[]).filter(istTerminLeistung)}
          team={team ?? []}
          datum={berlinDatum()}
          uhrzeit={uhrzeit}
          kunde={kunde}
          zuletzt={zuletzt}
          versteckt={{ auftrag: "1", weiter: "auftrag" }}
          knopf="Auftrag anlegen und Positionen eintragen"
        />
      </Abschnitt>
    </>
  );
}
