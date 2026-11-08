import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Rechnungen" };

export default async function AppRechnungen() {
  await benutzerMitRecht("rechnungen");
  const { data } = await db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, faellig_am, empfaenger, fahrzeug, erstellt_am").in("status", ["entwurf", "gestellt"]).order("erstellt_am", { ascending: false }).limit(100);
  const heute = berlinDatum();
  const offen = (data ?? []).filter((r) => r.status === "gestellt");
  return (
    <>
      <MobilKopf titel="Rechnungen" unter={`${euro(offen.reduce((s, r) => s + Number(r.summe_brutto_cent), 0))} offen`} />
      <div className="grid gap-px bg-linie">
        {(data ?? []).map((r) => (
          <Karte key={r.id} href={`/app/rechnungen/${r.id}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.empfaenger?.name || "ohne Empfänger"}</span>
                <span className="zahlen block text-sm text-grau">{r.nummer ?? "Entwurf"} · {r.fahrzeug?.kennzeichen ?? ""} {r.faellig_am ? `· fällig ${datum(r.faellig_am)}` : ""}</span>
              </span>
              <span className="text-right">
                <span className="zahlen block">{euro(r.summe_brutto_cent)}</span>
                {r.status === "entwurf" ? <Marke ton="hell">Entwurf</Marke> : r.faellig_am && r.faellig_am < heute ? <Marke ton="rot">überfällig</Marke> : <Marke ton="warnung">offen</Marke>}
              </span>
            </div>
          </Karte>
        ))}
      </div>
      {!data?.length ? <p className="px-4 py-10 text-center text-grau">Keine offenen Rechnungen.</p> : null}
    </>
  );
}
