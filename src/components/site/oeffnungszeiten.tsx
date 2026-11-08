import { type Einstellungen, WOCHENTAGE } from "@/lib/einstellungen";
import { berlinDatum, berlinUhrzeit, wochentag } from "@/lib/zeit";

/** Ist gerade geöffnet? Für den Hinweis „Jetzt geöffnet · bis 18:00“. */
export function jetztStatus(zeiten: Einstellungen["oeffnungszeiten"]): { offen: boolean; text: string } {
  const jetzt = berlinUhrzeit(new Date());
  const heute = zeiten[String(wochentag(berlinDatum())) as keyof typeof zeiten];
  const aktuell = heute.find(([a, b]) => jetzt >= a && jetzt < b);
  if (aktuell) return { offen: true, text: `Jetzt geöffnet · bis ${aktuell[1]} Uhr` };
  const spaeter = heute.find(([a]) => jetzt < a);
  return { offen: false, text: spaeter ? `Geschlossen · öffnet um ${spaeter[0]} Uhr` : "Gerade geschlossen" };
}

export function Oeffnungszeiten({ zeiten }: { zeiten: Einstellungen["oeffnungszeiten"] }) {
  const heute = wochentag(berlinDatum());
  const status = jetztStatus(zeiten);
  return (
    <div>
      <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-flaeche px-4 py-2 text-sm font-semibold ring-1 ring-linie">
        <span className={`size-2 rounded-full ${status.offen ? "bg-[#3ccf6e] shadow-[0_0_10px_#3ccf6e]" : "bg-grau-hell"}`} aria-hidden />
        {status.text}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(["1", "2", "3", "4", "5", "6", "7"] as const).map((t) => {
          const istHeute = Number(t) === heute;
          return (
            <li key={t} className={`flex items-baseline justify-between gap-4 rounded-2xl px-4 py-3 ${istHeute ? "bg-tinte text-boden" : "bg-flaeche"}`}>
              <span className="font-semibold">{WOCHENTAGE[Number(t) - 1]}</span>
              <span className={`zahlen text-right text-sm ${istHeute ? "" : "text-grau"}`}>
                {zeiten[t].length ? zeiten[t].map(([a, b]) => `${a}–${b}`).join(" · ") : "geschlossen"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
