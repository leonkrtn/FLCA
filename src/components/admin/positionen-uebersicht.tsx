import { euro } from "@/lib/format";
import { berechne, type Position } from "@/lib/rechnung/berechnung";

/** Positionen und Summen eines abgeschlossenen Belegs, schmal genug fürs Handy. */
export function PositionenUebersicht({ positionen }: { positionen: Position[] }) {
  const s = berechne(positionen);
  return (
    <div className="bg-papier p-4">
      <ul className="divide-y divide-linie">
        {positionen.map((p, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2">
            <span className="min-w-0 break-words">
              {p.text}
              <span className="block text-sm text-grau">
                {String(p.menge).replace(".", ",")} {p.einheit} × {euro(p.einzel_brutto_cent)}
              </span>
            </span>
            <span className="zahlen text-right">{euro(s.zeilenBrutto[i])}</span>
          </li>
        ))}
      </ul>
      <dl className="zahlen mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-t-2 border-tinte pt-2 text-right">
        <dt className="font-sans text-grau">Netto</dt>
        <dd>{euro(s.netto)}</dd>
        <dt className="font-sans text-grau">MwSt.</dt>
        <dd>{euro(s.steuer)}</dd>
        <dt className="font-sans font-semibold">Gesamt</dt>
        <dd className="text-lg">{euro(s.brutto)}</dd>
      </dl>
    </div>
  );
}
