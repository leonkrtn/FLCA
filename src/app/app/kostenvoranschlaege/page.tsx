import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf, MobilReiter } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { kvStatusText, kvTon, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kostenvoranschläge" };

export default async function AppKostenvoranschlaege() {
  await benutzerMitRecht("rechnungen");
  // Abgelehnte und schon abgerechnete stehen nur in der Verwaltung; unterwegs zählt, was noch offen ist.
  const { data } = await db()
    .from("kostenvoranschlaege")
    .select("id, nummer, status, gueltig_bis, summe_brutto_cent, empfaenger, fahrzeug, rechnung_id, erstellt_am")
    .in("status", ["entwurf", "offen", "angenommen"])
    .is("rechnung_id", null)
    .is("archiviert_am", null)
    .order("erstellt_am", { ascending: false })
    .limit(100);
  const liste = (data ?? []) as Kostenvoranschlag[];
  const angenommen = liste.filter((k) => k.status === "angenommen").length;
  return (
    <>
      <MobilKopf titel="Kostenvoranschläge" unter={angenommen ? `${angenommen} angenommen, noch ohne Rechnung` : `${liste.length} offen`} />
      <MobilReiter aktiv="/app/kostenvoranschlaege" eintraege={[{ href: "/app/rechnungen", text: "Rechnungen" }, { href: "/app/kostenvoranschlaege", text: "Kostenvoranschläge", anzahl: angenommen }]} />
      <div className="grid grid-cols-1 gap-px bg-linie">
        {liste.map((k) => (
          <Karte key={k.id} href={`/app/kostenvoranschlaege/${k.id}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{k.empfaenger?.firma || k.empfaenger?.name || "ohne Empfänger"}</span>
                <span className="zahlen block truncate text-sm text-grau">
                  {[k.nummer ?? "Entwurf", k.fahrzeug?.kennzeichen, k.gueltig_bis && k.status === "offen" ? `bis ${datum(k.gueltig_bis)}` : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="zahlen block">{euro(k.summe_brutto_cent)}</span>
                <Marke ton={kvTon(k)}>{kvStatusText(k)}</Marke>
              </span>
            </div>
          </Karte>
        ))}
      </div>
      {!liste.length ? <p className="px-4 py-10 text-center text-grau">Keine offenen Kostenvoranschläge.</p> : null}
    </>
  );
}
