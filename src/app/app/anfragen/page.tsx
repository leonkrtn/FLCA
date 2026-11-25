import { Ausblenden, Formular, Senden } from "@/components/admin/formular";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { bestaetigenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, telHref, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { type GeplanterTermin, TERMIN_FELDER } from "@/lib/termine";
import Link from "next/link";

export const metadata = { title: "Anfragen" };

/** Anfragen mit einem Tipp annehmen. Ablehnen (mit Nachricht) geht über die Detailseite. */
export default async function Anfragen() {
  await benutzerMitRecht("termine");
  const { data } = await db().from("termine").select(TERMIN_FELDER).eq("status", "angefragt").order("beginn");
  // Anfragen haben immer eine Zeit.
  const liste = (data ?? []) as GeplanterTermin[];
  return (
    <>
      <MobilKopf titel="Anfragen" unter={liste.length ? `${liste.length} offen` : "Alles beantwortet"} />
      <div className="grid gap-2 p-2">
        {/* Annehmen blendet die Anfrage sofort aus; bei einem Fehler (Zeit inzwischen belegt) steht sie mit Grund wieder da. */}
        {liste.map((t) => (
          <Ausblenden key={t.id}>
            <Karte>
              <Link href={`/app/termine/${t.id}`} className="block">
                <p className="zahlen text-sm text-grau">{datumKurzText(t.beginn)} · {zeit(t.beginn)} Uhr</p>
                <p className="text-lg font-semibold">{t.leistung_name}</p>
                <p className="text-sm">{[t.kunde?.name, t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
                {t.notiz_kunde ? <p className="mt-1 line-clamp-2 text-sm text-grau">„{t.notiz_kunde}“</p> : null}
              </Link>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <Formular aktion={bestaetigenAktion.bind(null, t.id)} ausblenden>
                  <Senden className="w-full" vorab="Angenommen">Annehmen</Senden>
                </Formular>
                {t.kunde?.telefon ? <a href={telHref(t.kunde.telefon)} className="knopf knopf-rahmen">Anrufen</a> : null}
                <Link href={`/app/termine/${t.id}`} className="knopf knopf-rahmen">Mehr</Link>
              </div>
            </Karte>
          </Ausblenden>
        ))}
      </div>
    </>
  );
}
