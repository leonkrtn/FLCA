import Link from "next/link";
import { Kopf, Leer, Marke, Reiter, Tabelle } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { kvStatusText, kvTon, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kostenvoranschläge" };

const ANSICHTEN = [["alle", "Alle"], ["entwurf", "Entwürfe"], ["offen", "Offen"], ["angenommen", "Angenommen"], ["abgelehnt", "Abgelehnt"]] as const;

export default async function KostenvoranschlagListe({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { status = "alle" } = await searchParams;
  // Archivierte (Termin gelöscht) stehen unter Einstellungen → Archiv, nicht im Alltag.
  let q = db().from("kostenvoranschlaege").select("*").is("archiviert_am", null).order("erstellt_am", { ascending: false }).limit(300);
  if (status !== "alle") q = q.eq("status", status);
  const { data } = await q;
  const liste = (data ?? []) as Kostenvoranschlag[];
  return (
    <>
      <Kopf titel="Kostenvoranschläge" unter="Abschließen vergibt die Nummer, der Kunde nimmt über seinen Link an. Angenommene werden per Knopf zur Rechnung.">
        <Link href="/admin/kostenvoranschlaege/neu" className="knopf knopf-dunkel">Neuer Kostenvoranschlag</Link>
      </Kopf>
      <Reiter aktiv={`/admin/kostenvoranschlaege?status=${status}`} eintraege={ANSICHTEN.map(([k, t]) => ({ href: `/admin/kostenvoranschlaege?status=${k}`, text: t }))} />
      {liste.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Nummer", "Datum", "Empfänger", "Kennzeichen", "Gültig bis", "Status", { text: "Betrag", zahl: true }]}>
            {liste.map((k) => (
              <tr key={k.id} className="hover:bg-papier">
                <td className="font-semibold tabular-nums">
                  <Link href={`/admin/kostenvoranschlaege/${k.id}`} className="hover:underline">{k.nummer ?? "Entwurf"}</Link>
                </td>
                <td className="whitespace-nowrap tabular-nums">{datum(k.datum ?? k.erstellt_am)}</td>
                <td className="max-w-[16rem] truncate">{k.empfaenger?.firma || k.empfaenger?.name}</td>
                <td className="tabular-nums">{k.fahrzeug?.kennzeichen}</td>
                <td className="whitespace-nowrap tabular-nums">{datum(k.gueltig_bis)}</td>
                <td>
                  <Marke ton={kvTon(k)}>{kvStatusText(k)}</Marke>
                  {k.rechnung_id ? <span className="ml-2 text-xs text-grau">Rechnung</span> : null}
                </td>
                <td className="zahl">{euro(k.summe_brutto_cent)}</td>
              </tr>
            ))}
          </Tabelle>
        </div>
      ) : (
        <div className="bg-weiss">
          <Leer>Keine Kostenvoranschläge.</Leer>
        </div>
      )}
    </>
  );
}
