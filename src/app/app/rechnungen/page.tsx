import { offenerBetrag } from "@/lib/rechnung/korrektur";
import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf, MobilReiter } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Rechnungen" };

export default async function AppRechnungen() {
  await benutzerMitRecht("rechnungen");
  const [{ data }, { count: kvOffen }] = await Promise.all([
    // „*“: bereits_bezahlt_cent (Korrektur) gibt es erst nach der Migration „rechnung_korrigieren“.
    db().from("rechnungen").select("*").in("status", ["entwurf", "gestellt"]).order("erstellt_am", { ascending: false }).limit(100),
    db().from("kostenvoranschlaege").select("id", { count: "exact", head: true }).eq("status", "angenommen").is("rechnung_id", null).is("archiviert_am", null),
  ]);
  const heute = berlinDatum();
  // Entwürfe und gestellte Rechnungen getrennt: Ein Entwurf ist noch keine Rechnung (keine Nummer, nicht
  // gebucht, frei änderbar) und gehört nicht in die Summe der offenen Beträge.
  const entwuerfe = (data ?? []).filter((r) => r.status === "entwurf");
  const offen = (data ?? []).filter((r) => r.status === "gestellt");
  const abschnitt = (titel: string, anzahl: number) => (
    <h2 className="flex items-baseline justify-between bg-boden px-4 pb-2 pt-5 text-sm font-semibold text-grau">
      {titel}
      <span className="zahlen font-normal">{anzahl}</span>
    </h2>
  );
  return (
    <>
      <MobilKopf
        titel="Rechnungen"
        unter={`${euro(offen.reduce((s, r) => s + offenerBetrag(r), 0))} offen${entwuerfe.length ? ` · ${entwuerfe.length} ${entwuerfe.length === 1 ? "Entwurf" : "Entwürfe"}` : ""}`}
      />
      <MobilReiter aktiv="/app/rechnungen" eintraege={[{ href: "/app/rechnungen", text: "Rechnungen" }, { href: "/app/kostenvoranschlaege", text: "Kostenvoranschläge", anzahl: kvOffen ?? 0 }]} />
      {entwuerfe.length ? (
        <>
          {abschnitt("Entwürfe", entwuerfe.length)}
          <div className="grid grid-cols-1 gap-px bg-linie">
            {entwuerfe.map((r) => (
              <Karte key={r.id} href={`/app/rechnungen/${r.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.empfaenger?.name || "ohne Empfänger"}</span>
                    <span className="zahlen block text-sm text-grau">{[r.fahrzeug?.kennzeichen, `angelegt ${datum(r.erstellt_am)}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="zahlen block text-grau">{euro(r.summe_brutto_cent)}</span>
                    <Marke ton="hell">Entwurf</Marke>
                  </span>
                </div>
              </Karte>
            ))}
          </div>
        </>
      ) : null}
      {abschnitt("Gestellte Rechnungen, offen", offen.length)}
      <div className="grid grid-cols-1 gap-px bg-linie">
        {offen.map((r) => (
          <Karte key={r.id} href={`/app/rechnungen/${r.id}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.empfaenger?.name || "ohne Empfänger"}</span>
                <span className="zahlen block text-sm text-grau">{[r.nummer, r.fahrzeug?.kennzeichen, r.faellig_am ? `fällig ${datum(r.faellig_am)}` : ""].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="zahlen block">{euro(r.summe_brutto_cent)}</span>
                {r.faellig_am && r.faellig_am < heute ? <Marke ton="rot">überfällig</Marke> : <Marke ton="warnung">offen</Marke>}
              </span>
            </div>
          </Karte>
        ))}
      </div>
      {!offen.length ? <p className="px-4 py-10 text-center text-grau">Keine offenen Rechnungen.</p> : null}
    </>
  );
}
