import { aehnlichkeit, grundform, textNorm } from "../rechnung/aehnlich";
import { type Rest, TRENNER, woerter } from "./text";

/**
 * Gesprochenes mit der Preisliste vergleichen. Gleiche Unschärfe wie bei den gemerkten Preisen
 * (`aehnlich.ts`), dazu Wörter, die in der Werkstatt dasselbe meinen („Reifen wechseln“ = „Radwechsel“).
 */

/** Ersetzungen auf beiden Seiten des Vergleichs. Auch in zusammengesetzten Wörtern („Reifenwechsel“). */
const GLEICH: [RegExp, string][] = [
  // „wechseln“ würde in `textNorm` zu „erneuern“; gesprochen ist meist der Wechsel gemeint („Öl wechseln“ = „Ölwechsel“)
  [/\bwechseln\b/g, "wechsel"],
  [/reifen/g, "rad"],
  [/raeder/g, "rad"],
  [/oel ?service/g, "oelwechsel"],
  [/tuev/g, "hu"],
  [/hauptuntersuchung/g, "hu"],
  [/abgasuntersuchung/g, "au"],
  [/klimaanlage/g, "klima"],
  [/wartung/g, "inspektion"],
];

export function vergleichsform(s: string): string {
  let g = grundform(s);
  for (const [a, b] of GLEICH) g = g.replace(a, b);
  return textNorm(g);
}

/**
 * Kern eines Namens aus der Preisliste: „Ölwechsel inkl. Filter“ wird auch als „Ölwechsel“ erkannt,
 * „HU/AU“ auch als „HU“. Wer nur den Anfang sagt, meint meist genau das.
 */
function kerne(name: string): string[] {
  const teile = [name, name.split(/\s+(?:inkl\.?|inklusive|mit|zzgl\.?|ohne|und|für|fuer)\s+|[(),/–]|\s-\s/i)[0], ...name.split(/[/,]/)];
  return [...new Set(teile.map(vergleichsform).filter(Boolean))];
}

const kernSpeicher = new Map<string, string[]>();
const kerneVon = (name: string) => {
  let k = kernSpeicher.get(name);
  if (!k) {
    k = kerne(name);
    if (kernSpeicher.size > 2000) kernSpeicher.clear();
    kernSpeicher.set(name, k);
  }
  return k;
};

/** 0…1: wie gut passt das Gesprochene zu einem Namen der Preisliste. */
export function passung(gesprochen: string, name: string): number {
  const g = vergleichsform(gesprochen);
  if (!g) return 0;
  const k = kerneVon(name);
  if (k.includes(g)) return 1;
  // Zwei Buchstaben („HU“) zählen nur, wenn sie genau passen
  if (g.replace(/ /g, "").length < 3) return 0;
  return Math.max(0, ...k.map((x) => aehnlichkeit(g, x)));
}

/** Etwas großzügiger als bei den gemerkten Preisen: gesprochen kommt seltener genau der Listenname. */
export const SCHWELLE_SPRACHE = 0.8;

/** Bester Eintrag zu einem ganzen Stück Text, oder null. */
export function besterEintrag<T extends { name: string }>(text: string, liste: T[], schwelle = SCHWELLE_SPRACHE): { eintrag: T; wert: number } | null {
  let bester: { eintrag: T; wert: number } | null = null;
  for (const e of liste) {
    const w = passung(text, e.name);
    if (w >= schwelle && (!bester || w > bester.wert)) bester = { eintrag: e, wert: w };
  }
  return bester;
}

/**
 * Alle Einträge, die irgendwo im Satz vorkommen. Probiert jede Folge von ein bis vier Wörtern (nicht über
 * einen Trenner hinweg), nimmt die besten Treffer ohne Überschneidung und jeden Eintrag nur einmal.
 */
export function eintraegeNehmen<T extends { id: string; name: string }>(rest: Rest, liste: T[], schwelle = SCHWELLE_SPRACHE): T[] {
  if (!liste.length) return [];
  const w = woerter(rest.text);
  const kandidaten: { von: number; bis: number; wert: number; eintrag: T }[] = [];
  for (let i = 0; i < w.length; i++) {
    for (let n = 1; n <= 4 && i + n <= w.length; n++) {
      if (n > 1 && w[i + n - 1].nachTrenner) break;
      const text = rest.text.slice(w[i].start, w[i + n - 1].ende);
      const b = besterEintrag(text, liste, schwelle);
      if (b) kandidaten.push({ von: i, bis: i + n - 1, wert: b.wert, eintrag: b.eintrag });
    }
  }
  // Bessere zuerst, bei Gleichstand die längere Wortfolge („Bremsen vorne“ vor „Bremsen“)
  kandidaten.sort((a, b) => b.wert - a.wert || b.bis - b.von - (a.bis - a.von));
  const belegt = new Set<number>();
  const gewaehlt: typeof kandidaten = [];
  for (const k of kandidaten) {
    if (gewaehlt.some((g) => g.eintrag.id === k.eintrag.id)) continue;
    let frei = true;
    for (let i = k.von; i <= k.bis; i++) if (belegt.has(i)) frei = false;
    if (!frei) continue;
    for (let i = k.von; i <= k.bis; i++) belegt.add(i);
    gewaehlt.push(k);
  }
  // Von hinten herausnehmen, damit die Positionen davor stimmen; Ergebnis in Satzreihenfolge
  for (const g of [...gewaehlt].sort((a, b) => b.von - a.von)) rest.entfernen(w[g.von].start, w[g.bis].ende, TRENNER);
  return gewaehlt.sort((a, b) => a.von - b.von).map((g) => g.eintrag);
}

/** Beginnt an dieser Stelle ein Eintrag der Liste? Damit ein Name nicht „Müller Ölwechsel“ heißt. */
export function beginntEintrag(woerterAbHier: string[], liste: { name: string }[]): boolean {
  for (let n = 1; n <= Math.min(3, woerterAbHier.length); n++) {
    if (besterEintrag(woerterAbHier.slice(0, n).join(" "), liste)) return true;
  }
  return false;
}
