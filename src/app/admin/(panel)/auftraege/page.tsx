import Link from "next/link";
import { Kopf, Leer, Marke, Reiter, Tabelle } from "@/components/admin/ui";
import { AUFTRAG_STAND_TEXT, AUFTRAG_STAND_TON, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, euro } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, TERMIN_FELDER, type Termin } from "@/lib/termine";

export const metadata = { title: "Werkstattaufträge" };

const ANSICHTEN = { offen: "Offen", fertig: "Abgeschlossen", alle: "Alle" } as const;

/**
 * Alle Werkstattaufträge auf einen Blick. Ein Auftrag hängt immer an einem Termin (Spalten `auftrag_*`),
 * deshalb führt jede Zeile auf die Terminseite, wo er bearbeitet, erteilt und abgerechnet wird.
 */
export default async function AuftragListe({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  await benutzerMitRecht("termine");
  const { ansicht: a = "offen", q = "" } = await searchParams;
  const ansicht = (a in ANSICHTEN ? a : "offen") as keyof typeof ANSICHTEN;

  let abfrage = db().from("termine").select(TERMIN_FELDER).not("auftrag_nummer", "is", null).limit(300);
  if (ansicht === "offen") abfrage = abfrage.in("status", ["angefragt", "bestaetigt"]).order("beginn");
  else abfrage = abfrage.order("auftrag_angelegt_am", { ascending: false });
  if (ansicht === "fertig") abfrage = abfrage.eq("status", "erledigt");
  const { data } = await abfrage;
  let auftraege = (data ?? []) as Termin[];
  if (q) {
    const s = q.toLowerCase();
    auftraege = auftraege.filter((t) => [t.auftrag_nummer, t.kunde?.name, t.kunde?.telefon, t.fahrzeug?.kennzeichen, t.leistung_name].some((x) => x?.toLowerCase().includes(s)));
  }

  return (
    <>
      <Kopf titel="Werkstattaufträge" unter="Jeder Auftrag gehört zu einem Termin. Ein Klick öffnet ihn mit Positionen, Unterschrift und Rechnung.">
        <Link href="/admin/auftraege/neu" className="knopf knopf-dunkel">Neuer Werkstattauftrag</Link>
      </Kopf>
      <Reiter aktiv={`/admin/auftraege?ansicht=${ansicht}`} eintraege={Object.entries(ANSICHTEN).map(([k, t]) => ({ href: `/admin/auftraege?ansicht=${k}`, text: t }))} />
      <form className="mb-4 max-w-sm">
        <input type="hidden" name="ansicht" value={ansicht} />
        <input name="q" defaultValue={q} placeholder="Suche: Nr., Name, Kennzeichen, Telefon" className="feld" aria-label="Suche" />
      </form>
      {auftraege.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Auftrag", "Termin", "Kunde", "Kennzeichen", "Leistung", "Stand", "Termin-Status", { text: "Summe", zahl: true }]}>
            {auftraege.map((t) => {
              const stand = auftragStand(t);
              return (
                <tr key={t.id} className="hover:bg-papier">
                  <td className="zahlen whitespace-nowrap">
                    <Link href={`/admin/termine/${t.id}`} className="font-semibold hover:underline">{t.auftrag_nummer}</Link>
                  </td>
                  <td className="zahlen whitespace-nowrap">{datumKurzText(t.beginn)}</td>
                  <td>{t.kunde?.name}</td>
                  <td className="zahlen whitespace-nowrap">{t.fahrzeug?.kennzeichen}</td>
                  <td>{t.leistung_name}</td>
                  <td><Marke ton={AUFTRAG_STAND_TON[stand]}>{AUFTRAG_STAND_TEXT[stand]}</Marke></td>
                  <td><Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke></td>
                  <td className="zahl">{euro(t.auftrag_summe_brutto_cent ?? 0)}</td>
                </tr>
              );
            })}
          </Tabelle>
        </div>
      ) : (
        <Leer>{q ? "Nichts passt zur Suche." : ansicht === "offen" ? "Keine offenen Werkstattaufträge." : "Keine Werkstattaufträge."}</Leer>
      )}
    </>
  );
}
