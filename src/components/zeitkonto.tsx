import type { Zeitkonto } from "@/lib/mitarbeiter";
import { datum } from "@/lib/format";
import { saldo, stunden } from "@/lib/zeiterfassung";

/** Soll, Ist und Saldo nebeneinander (Team-App und Personenseite). */
export function ZeitkontoKacheln({ k }: { k: Zeitkonto }) {
  const werte: [string, string, boolean?][] = [
    ["Soll Monat", k.sollMonat === null ? "–" : stunden(k.sollMonat)],
    ["Ist Monat", stunden(k.istMonat)],
    ["Saldo Monat", k.saldoMonat === null ? "–" : saldo(k.saldoMonat), (k.saldoMonat ?? 0) < 0],
    ["Saldo gesamt", k.saldoGesamt === null ? "–" : saldo(k.saldoGesamt), (k.saldoGesamt ?? 0) < 0],
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {werte.map(([titel, wert, minus]) => (
          <div key={titel}>
            <p className={`zahlen text-xl ${minus ? "text-rot" : ""}`}>{wert}</p>
            <p className="text-xs text-grau">{titel}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-grau">
        {k.sollMonat === null
          ? "Kein eigener Wochenplan eingetragen, deshalb kein Soll."
          : `Soll aus dem Wochenplan, Urlaub und krank zählen als gearbeitet. Saldo bis gestern${k.seit ? `, gesamt seit ${datum(k.seit)}` : ""}.`}
      </p>
    </div>
  );
}
