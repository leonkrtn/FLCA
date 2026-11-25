import Link from "next/link";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, euro, telHref } from "@/lib/format";
import { auftraegeOhneTermin } from "@/lib/termine";

export const metadata = { title: "Ohne Termin" };

/**
 * Werkstattaufträge, die auf ihren Termin warten (angenommene Kostenvoranschläge ohne Termin), die ältesten
 * zuerst. Eingeplant wird auf der Seite des Auftrags.
 */
export default async function OhneTermin() {
  await benutzerMitRecht("termine");
  const liste = await auftraegeOhneTermin();
  return (
    <>
      <MobilKopf titel="Ohne Termin" unter={liste.length ? `${liste.length} ${liste.length === 1 ? "Auftrag wartet" : "Aufträge warten"}` : "Nichts offen"} zurueck="/app" />
      <div className="grid gap-2 p-2">
        {liste.map((t) => (
          <Karte key={t.id}>
            <Link href={`/app/termine/${t.id}`} className="block">
              <p className="zahlen text-sm text-grau">
                {t.auftrag_nummer ?? "Auftrag"}
                {t.auftrag_angelegt_am ? ` · seit ${datumKurzText(t.auftrag_angelegt_am)}` : ""}
              </p>
              <p className="text-lg font-semibold">{t.leistung_name}</p>
              <p className="text-sm">{[t.kunde?.name, t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
              {t.auftrag_summe_brutto_cent ? <p className="zahlen mt-1 text-sm text-grau">{euro(t.auftrag_summe_brutto_cent)}</p> : null}
            </Link>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Link href={`/app/termine/${t.id}`} className="knopf knopf-dunkel">Einplanen</Link>
              {t.kunde?.telefon ? <a href={telHref(t.kunde.telefon)} className="knopf knopf-rahmen">Anrufen</a> : null}
            </div>
          </Karte>
        ))}
      </div>
      {!liste.length ? <p className="px-4 py-10 text-center text-grau">Kein Auftrag wartet auf einen Termin.</p> : null}
    </>
  );
}
