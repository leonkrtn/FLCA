import { type Einstellungen, WOCHENTAGE } from "@/lib/einstellungen";
import { berlinDatum, wochentag } from "@/lib/zeit";

export function Oeffnungszeiten({ zeiten }: { zeiten: Einstellungen["oeffnungszeiten"] }) {
  const heute = wochentag(berlinDatum());
  return (
    <table className="w-full text-left">
      <caption className="sr-only">Öffnungszeiten</caption>
      <tbody>
        {(["1", "2", "3", "4", "5", "6", "7"] as const).map((t) => {
          const istHeute = Number(t) === heute;
          return (
            <tr key={t} className={`border-b border-linie ${istHeute ? "font-semibold" : ""}`}>
              <th scope="row" className="py-2 pr-4 font-[inherit]">
                {WOCHENTAGE[Number(t) - 1]}
                {istHeute ? <span className="ml-2 text-xs font-normal text-grau">heute</span> : null}
              </th>
              <td className="zahlen py-2 text-right">
                {zeiten[t].length ? zeiten[t].map(([a, b]) => `${a}–${b}`).join("  ") : <span className="font-sans text-grau">geschlossen</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
