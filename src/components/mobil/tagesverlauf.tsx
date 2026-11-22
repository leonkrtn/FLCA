import Link from "next/link";
import type { Fenster } from "@/lib/einstellungen";
import { zeit } from "@/lib/format";
import { berlinUhrzeit, minuten } from "@/lib/zeit";

type Eintrag = { von: number; bis: number; art: "auftrag" | "pause" | "frei"; titel: string; unter?: string; href?: string };

/**
 * Der eigene Tag als Zeitleiste von oben nach unten: Arbeitsbeginn, Aufträge, Pausen zwischen den
 * Arbeitsfenstern, Lücken und Feierabend. Ein Strich zeigt, wo „jetzt“ ist. Für das Handy gebaut: senkrecht
 * liest es sich auch bei vielen Aufträgen.
 */
export function Tagesverlauf({ fenster, auftraege, jetzt = new Date() }: { fenster: Fenster[]; auftraege: { id: string; beginn: string; ende: string; titel: string; unter?: string }[]; jetzt?: Date }) {
  if (!fenster.length && !auftraege.length) return null;
  const a = auftraege.map((t): Eintrag => ({ von: minuten(berlinUhrzeit(new Date(t.beginn))), bis: minuten(berlinUhrzeit(new Date(t.ende))) || 24 * 60, art: "auftrag", titel: t.titel, unter: t.unter, href: `/team/auftrag/${t.id}` }));
  const eintraege: Eintrag[] = [...a];
  // Pausen: Lücken zwischen zwei Arbeitsfenstern
  for (let i = 1; i < fenster.length; i++) eintraege.push({ von: minuten(fenster[i - 1][1]), bis: minuten(fenster[i][0]), art: "pause", titel: "Pause" });
  // Freie Zeit innerhalb der Arbeitszeit, in der kein Auftrag liegt (ab 30 Minuten)
  for (const [f1, f2] of fenster) {
    let start = minuten(f1);
    for (const t of a.filter((x) => x.bis > minuten(f1) && x.von < minuten(f2)).sort((x, y) => x.von - y.von)) {
      if (t.von - start >= 30) eintraege.push({ von: start, bis: t.von, art: "frei", titel: "nichts eingeplant" });
      start = Math.max(start, t.bis);
    }
    if (minuten(f2) - start >= 30) eintraege.push({ von: start, bis: minuten(f2), art: "frei", titel: "nichts eingeplant" });
  }
  eintraege.sort((x, y) => x.von - y.von || (x.art === "auftrag" ? -1 : 1));
  const jetztMin = minuten(berlinUhrzeit(jetzt));
  const uhr = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const beginn = fenster[0]?.[0];
  const ende = fenster[fenster.length - 1]?.[1];

  return (
    <ol className="relative grid gap-px bg-linie text-sm">
      {beginn ? <Zeile zeit={beginn} text="Arbeitsbeginn" grau /> : null}
      {eintraege.map((e, i) => {
        const vorbei = e.bis <= jetztMin;
        const jetztHier = e.von <= jetztMin && jetztMin < e.bis;
        const inhalt = (
          <>
            <span className="zahlen w-24 shrink-0 text-grau">
              {uhr(e.von)}–{uhr(e.bis)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={e.art === "auftrag" ? "font-semibold" : "text-grau"}>{e.titel}</span>
              {e.unter ? <span className="block truncate text-grau">{e.unter}</span> : null}
            </span>
            {jetztHier ? <span className="shrink-0 text-xs font-semibold text-rot">jetzt</span> : null}
          </>
        );
        const klasse = `flex items-start gap-3 px-4 py-2.5 ${e.art === "auftrag" ? "bg-flaeche" : "bg-papier"} ${vorbei ? "opacity-60" : ""} ${jetztHier ? "border-l-4 border-rot pl-3" : ""}`;
        return (
          <li key={i}>
            {e.href ? (
              <Link href={e.href} className={`${klasse} active:bg-boden`}>
                {inhalt}
              </Link>
            ) : (
              <div className={klasse}>{inhalt}</div>
            )}
          </li>
        );
      })}
      {ende ? <Zeile zeit={ende} text="Feierabend" grau /> : null}
    </ol>
  );
}

function Zeile({ zeit: z, text, grau }: { zeit: string; text: string; grau?: boolean }) {
  return (
    <li className={`flex gap-3 bg-papier px-4 py-2 ${grau ? "text-grau" : ""}`}>
      <span className="zahlen w-24 shrink-0">{z}</span>
      <span>{text}</span>
    </li>
  );
}

/** Kurzer Zeittext für Listen („08:30–10:00“). */
export const vonBis = (t: { beginn: string; ende: string }) => `${zeit(t.beginn)}–${zeit(t.ende)}`;
