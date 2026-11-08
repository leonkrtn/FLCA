import Link from "next/link";
import { Kopf, Leer, Marke, Reiter, Tabelle } from "@/components/admin/ui";
import { neueRechnung } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { RECHNUNG_STATUS, type Rechnung } from "@/lib/rechnung/rechnungen";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Rechnungen" };

export default async function RechnungsListe({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { status = "alle" } = await searchParams;
  let q = db().from("rechnungen").select("*").order("erstellt_am", { ascending: false }).limit(300);
  if (status !== "alle") q = q.eq("status", status);
  const { data } = await q;
  const liste = (data ?? []) as Rechnung[];
  const heute = berlinDatum();
  const monat = heute.slice(0, 7);
  const vormonat = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const summe = liste.filter((r) => r.status !== "entwurf").reduce((s, r) => s + Number(r.summe_brutto_cent), 0);
  return (
    <>
      <Kopf titel="Rechnungen">
        <a href={`/admin/rechnungen/export?monat=${vormonat}`} className="knopf knopf-rahmen knopf-klein">DATEV-Export {vormonat.slice(5)}/{vormonat.slice(0, 4)}</a>
        <form action={neueRechnung.bind(null, null)}>
          <button className="knopf knopf-dunkel knopf-klein">Neue Rechnung</button>
        </form>
      </Kopf>
      <Reiter
        aktiv={`/admin/rechnungen?status=${status}`}
        eintraege={[["alle", "Alle"], ["entwurf", "Entwürfe"], ["gestellt", "Offen"], ["bezahlt", "Bezahlt"], ["storniert", "Storniert"]].map(([k, t]) => ({ href: `/admin/rechnungen?status=${k}`, text: t }))}
      />
      {liste.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Nummer", "Datum", "Empfänger", "Kennzeichen", "Status", { text: "Betrag", zahl: true }]}>
            {liste.map((r) => {
              const ueberfaellig = r.status === "gestellt" && r.faellig_am && r.faellig_am < heute;
              return (
                <tr key={r.id} className="hover:bg-papier">
                  <td className="zahlen font-semibold"><Link href={`/admin/rechnungen/${r.id}`} className="hover:underline">{r.nummer ?? "Entwurf"}</Link></td>
                  <td className="zahlen whitespace-nowrap">{datum(r.rechnungsdatum ?? r.erstellt_am)}</td>
                  <td>{r.empfaenger?.firma || r.empfaenger?.name}</td>
                  <td className="zahlen">{r.fahrzeug?.kennzeichen}</td>
                  <td>
                    <Marke ton={r.status === "bezahlt" ? "ok" : r.status === "gestellt" ? (ueberfaellig ? "rot" : "warnung") : "hell"}>
                      {ueberfaellig ? "Überfällig" : r.storno_zu ? "Storno" : RECHNUNG_STATUS[r.status]}
                    </Marke>
                  </td>
                  <td className="zahl">{euro(r.summe_brutto_cent)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="text-right font-semibold">Summe (ohne Entwürfe)</td>
              <td className="zahl font-semibold">{euro(summe)}</td>
            </tr>
          </Tabelle>
        </div>
      ) : (
        <Leer>Keine Rechnungen.</Leer>
      )}
    </>
  );
}
