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

/** Öffnungszeiten als ruhige Liste: gleich hohe Zeilen, heute nur fett. */
export function Oeffnungszeiten({ zeiten }: { zeiten: Einstellungen["oeffnungszeiten"] }) {
  const heute = wochentag(berlinDatum());
  const status = jetztStatus(zeiten);
  return (
    <div>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h3 className="schmal text-2xl">Öffnungszeiten</h3>
        <p className="flex items-center gap-2 text-sm text-grau">
          <span className={`size-2 rounded-full ${status.offen ? "bg-tinte/80" : "bg-grau-hell"}`} aria-hidden />
          {status.text}
        </p>
      </div>
      <ul className="divide-y divide-linie border-y border-linie">
        {(["1", "2", "3", "4", "5", "6", "7"] as const).map((t) => {
          const istHeute = Number(t) === heute;
          return (
            <li key={t} className={`flex min-h-12 items-center justify-between gap-4 ${istHeute ? "font-semibold text-tinte" : "text-grau"}`}>
              <span>{WOCHENTAGE[Number(t) - 1]}</span>
              <span className="zahlen text-right text-sm">{zeiten[t].length ? zeiten[t].map(([a, b]) => `${a}–${b}`).join(" · ") : "geschlossen"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
