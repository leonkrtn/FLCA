import Link from "next/link";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { planPersonen } from "@/lib/mitarbeiter";
import { arbeitsfenster } from "@/lib/planung";
import { berlin, berlinDatum, plusTage } from "@/lib/zeit";

export const metadata = { title: "Woche" };

/** Die nächsten 7 Tage: wann arbeite ich, was habe ich auf der Bühne, wann bin ich nicht da. */
export default async function Woche() {
  const b = await benutzerMitRecht("werkstatt");
  const heute = berlinDatum();
  const ende = plusTage(heute, 7);
  const [plan, { data: termine }, { data: abw }] = await Promise.all([
    planPersonen(heute, ende, false, [b.id]).then((alle) => alle[0] ?? null),
    db().from("termine").select("id, beginn, ende, leistung_name, fahrzeug:fahrzeuge(kennzeichen)").eq("zugewiesen_an", b.id).eq("status", "bestaetigt").gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(ende).toISOString()).order("beginn"),
    db().from("abwesenheiten").select("art, von, bis, von_zeit, bis_zeit, status").eq("profil_id", b.id).lte("von", ende).gte("bis", heute).neq("status", "abgelehnt"),
  ]);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(heute, i));
  return (
    <>
      <MobilKopf titel="Deine Woche" />
      <div className="grid grid-cols-1 gap-px bg-linie">
        {tage.map((d) => {
          // Wochenplan mit Ausnahmen und genehmigten Abwesenheiten; beantragte stehen nur als Hinweis daneben
          const z = plan ? arbeitsfenster(plan, d) : [];
          const a = (abw ?? []).find((x) => x.von <= d && x.bis >= d && (!x.von_zeit || x.status === "beantragt"));
          const halb = (abw ?? []).find((x) => x.von <= d && x.bis >= d && x.von_zeit && x.status === "genehmigt");
          const t = (termine ?? []).filter((x) => berlinDatum(new Date(x.beginn)) === d) as unknown as { id: string; beginn: string; ende: string; leistung_name: string; fahrzeug: { kennzeichen: string } | null }[];
          return (
            <Karte key={d} className={d === heute ? "border-l-4 border-rot" : ""}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{datumKurzText(d)}</span>
                <span className="zahlen text-sm">
                  {a ? <span className="font-sans text-grau">{a.art === "krank" ? "krank" : a.art === "urlaub" ? "Urlaub" : "frei"}{a.status === "beantragt" ? " (beantragt)" : ""}</span> : z.length ? z.map(([x, y]) => `${x}–${y}`).join(", ") : <span className="font-sans text-grau">frei</span>}
                </span>
              </div>
              {halb ? <p className="text-sm text-grau">{halb.art === "krank" ? "krank" : halb.art === "urlaub" ? "Urlaub" : "frei"} {halb.von_zeit?.slice(0, 5)}–{halb.bis_zeit?.slice(0, 5)} Uhr</p> : null}
              {t.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {t.map((x) => (
                    <li key={x.id}>
                      <Link href={`/team/auftrag/${x.id}`} className="flex gap-3 active:bg-papier">
                        <span className="zahlen text-grau">{zeit(x.beginn)}</span>
                        <span className="min-w-0">{x.leistung_name} {x.fahrzeug ? <span className="text-grau">· {x.fahrzeug.kennzeichen}</span> : null}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Karte>
          );
        })}
      </div>
    </>
  );
}
