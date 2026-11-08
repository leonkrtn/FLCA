import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { berlin, berlinDatum, plusTage, wochentag } from "@/lib/zeit";

export const metadata = { title: "Woche" };

/** Die nächsten 7 Tage: wann arbeite ich, was habe ich auf der Bühne, wann bin ich nicht da. */
export default async function Woche() {
  const b = await benutzerMitRecht("werkstatt");
  const heute = berlinDatum();
  const ende = plusTage(heute, 7);
  const [{ data: zeiten }, { data: termine }, { data: abw }] = await Promise.all([
    db().from("arbeitszeiten").select("wochentag, beginn, ende").eq("profil_id", b.id).order("beginn"),
    db().from("termine").select("id, beginn, ende, leistung_name, fahrzeug:fahrzeuge(kennzeichen)").eq("zugewiesen_an", b.id).eq("status", "bestaetigt").gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(ende).toISOString()).order("beginn"),
    db().from("abwesenheiten").select("art, von, bis, status").eq("profil_id", b.id).lte("von", ende).gte("bis", heute).neq("status", "abgelehnt"),
  ]);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(heute, i));
  return (
    <>
      <MobilKopf titel="Deine Woche" />
      <div className="grid gap-px bg-linie">
        {tage.map((d) => {
          const z = (zeiten ?? []).filter((x) => x.wochentag === wochentag(d));
          const a = (abw ?? []).find((x) => x.von <= d && x.bis >= d);
          const t = (termine ?? []).filter((x) => berlinDatum(new Date(x.beginn)) === d) as unknown as { id: string; beginn: string; ende: string; leistung_name: string; fahrzeug: { kennzeichen: string } | null }[];
          return (
            <Karte key={d} className={d === heute ? "border-l-4 border-rot" : ""}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{datumKurzText(d)}</span>
                <span className="zahlen text-sm">
                  {a ? <span className="font-sans text-grau">{a.art === "krank" ? "krank" : a.art === "urlaub" ? "Urlaub" : "frei"}{a.status === "beantragt" ? " (beantragt)" : ""}</span> : z.length ? z.map((x) => `${x.beginn.slice(0, 5)}–${x.ende.slice(0, 5)}`).join(", ") : <span className="font-sans text-grau">frei</span>}
                </span>
              </div>
              {t.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {t.map((x) => (
                    <li key={x.id} className="flex gap-3">
                      <span className="zahlen text-grau">{zeit(x.beginn)}</span>
                      <span>{x.leistung_name} {x.fahrzeug ? <span className="text-grau">· {x.fahrzeug.kennzeichen}</span> : null}</span>
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
