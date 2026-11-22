import Link from "next/link";
import type { FruehereRechnung } from "@/lib/altbestand/daten";
import type { MitFassungen } from "@/lib/altbestand/fassungen";
import { datum, euro } from "@/lib/format";

type Zeile = MitFassungen<FruehereRechnung & { kunde?: { id: string; name: string } | null }>;

/**
 * Rechnungen aus der Zeit vor dem System (Einstellungen → Datenübernahme), zum Nachschlagen. Je Rechnung
 * die letzte Fassung mit Nummer und Datum; aufgeklappt Positionen wie auf dem Beleg (netto bzw. ohne USt
 * bei Kleinunternehmer-Rechnungen) und die älteren Fassungen. In der Rechnungsliste mit Kunde.
 */
export function FruehereRechnungen({ liste, mitKunde = false }: { liste: Zeile[]; mitKunde?: boolean }) {
  return (
    <ul className="divide-y divide-linie text-sm">
      {liste.map((r) => (
        <li key={r.id}>
          <details>
            <summary className={`grid cursor-pointer list-none gap-3 py-2 hover:bg-papier ${mitKunde ? "grid-cols-[5.5rem_6rem_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"}`}>
              {mitKunde ? (
                <>
                  <span className="zahlen font-semibold">{r.nummer}</span>
                  <span className="zahlen text-grau">{datum(r.rechnungsdatum)}</span>
                  <span className="min-w-0 truncate">
                    {r.kunde?.name ?? <span className="text-grau">ohne Kunde</span>} <span className="text-grau">{r.kennzeichen}</span>
                  </span>
                </>
              ) : (
                <span className="min-w-0 truncate">
                  <span className="zahlen">{r.nummer}</span> <span className="text-grau">{datum(r.rechnungsdatum)} {r.kennzeichen}</span>
                </span>
              )}
              <span className="zahlen text-right">{r.endbetrag_cent == null ? "" : euro(r.endbetrag_cent)}</span>
            </summary>
            <div className="grid gap-2 pb-4">
              <table className="w-full text-sm">
                <tbody>
                  {r.positionen.map((p, i) => (
                    <tr key={i} className="align-top">
                      <td className="zahlen w-12 py-0.5 pr-2 text-grau">{p.menge}</td>
                      <td className="py-0.5 pr-2">{p.text}</td>
                      <td className="zahlen py-0.5 text-right">{euro(p.summe_cent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="zahlen text-xs text-grau">
                {r.steuer === "kleinunternehmer"
                  ? "ohne Umsatzsteuer (§ 19 UStG)"
                  : [r.netto_cent != null ? `netto ${euro(r.netto_cent)}` : "", r.mwst_cent != null ? `MwSt ${euro(r.mwst_cent)}` : "", r.brutto_cent != null ? `brutto ${euro(r.brutto_cent)}` : ""].filter(Boolean).join(" · ")}
                {r.regulaer_cent ? ` · Sonderpreis statt ${euro(r.regulaer_cent)}` : ""}
                {r.leistungsdatum && r.leistungsdatum !== r.rechnungsdatum ? ` · Leistung ${datum(r.leistungsdatum)}` : ""}
                {r.km_stand ? ` · ${new Intl.NumberFormat("de-DE").format(r.km_stand)} km` : ""}
                {r.zahlart ? ` · ${r.zahlart}` : ""}
              </p>
              {r.aeltere.length ? (
                <p className="zahlen text-xs text-grau">
                  Ersetzt: {r.aeltere.map((a) => `${a.nummer} vom ${datum(a.rechnungsdatum)}${a.endbetrag_cent != null && a.endbetrag_cent !== r.endbetrag_cent ? ` (${euro(a.endbetrag_cent)})` : ""}`).join(", ")}
                </p>
              ) : null}
              <p className="break-all text-xs text-grau">
                Original: {r.datei}
                {mitKunde && r.kunde ? (
                  <>
                    {" · "}
                    <Link href={`/admin/kunden/${r.kunde.id}`} className="underline">Kundenakte</Link>
                  </>
                ) : null}
              </p>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

/** Summe der letzten Fassungen (ersetzte zählen nicht). */
export const fruehereSumme = (liste: { endbetrag_cent: number | null }[]) => liste.reduce((s, r) => s + (r.endbetrag_cent ?? 0), 0);
