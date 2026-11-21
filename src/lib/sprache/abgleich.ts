import { aehnlichkeit, grundform, textNorm } from "../rechnung/aehnlich";
import { type Rest, TRENNER, woerter } from "./text";

/**
 * Gesprochenes mit der Preisliste vergleichen. Die Liste kommt bei jedem Aufruf frisch aus der Datenbank:
 * Neue Einträge und neue Bezeichnungen werden sofort erkannt, dazu die „weiteren Namen beim Sprechen“,
 * die man je Eintrag in der Preisliste pflegt. Gleiche Unschärfe wie bei den gemerkten Preisen
 * (`aehnlich.ts`), dazu Wörter, die in der Werkstatt dasselbe meinen („Reifen wechseln“ = „Radwechsel“).
 */

/** Ein Eintrag der Preisliste, wie ihn der Abgleich braucht. */
export type Eintrag = { name: string; sprachnamen?: string[] | null };

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

/** Bezeichnung und weitere Namen eines Eintrags. */
const alleNamen = (e: Eintrag) => [e.name, ...(e.sprachnamen ?? [])].filter((n) => typeof n === "string" && n.trim());

/**
 * Kerne eines Namens: „Ölwechsel inkl. Filter“ wird auch als „Ölwechsel“ erkannt, „HU/AU“ auch als „HU“.
 * Wer nur den Anfang sagt, meint meist genau das.
 */
function kerne(name: string): string[] {
  return [name, name.split(/\s+(?:inkl\.?|inklusive|mit|zzgl\.?|ohne|und|für|fuer)\s+|[(),/–]|\s-\s/i)[0], ...name.split(/[/,]/)].map(vergleichsform).filter(Boolean);
}

type Vergleich = { kerne: string[]; kernWoerter: string[]; woerter: Set<string> };

// Die Liste ändert sich selten, verglichen wird bei jedem Tastendruck: Vergleichsformen je Eintrag merken.
// Schlüssel sind die Namen selbst, eine Umbenennung ergibt also einfach einen neuen Eintrag.
const speicher = new Map<string, Vergleich>();
function vergleichVon(e: Eintrag): Vergleich {
  const namen = alleNamen(e);
  const schluessel = namen.join("\n");
  let v = speicher.get(schluessel);
  if (!v) {
    const k = [...new Set(namen.flatMap(kerne))];
    // Wörter der Kerne (für Teilwörter) und aller Namen (für „das ist kein Kundenname“)
    const kernWoerter = [...new Set(k.flatMap((x) => x.split(" ")).filter((w) => w.length >= 4))];
    const woerter = new Set(namen.flatMap((n) => vergleichsform(n).split(" ")).filter((w) => w.length >= 4));
    v = { kerne: k, kernWoerter, woerter };
    if (speicher.size > 2000) speicher.clear();
    speicher.set(schluessel, v);
  }
  return v;
}

/** 0…1: wie gut passt das Gesprochene zu einem Eintrag (Bezeichnung oder weiterer Name). */
export function passung(gesprochen: string, e: Eintrag): number {
  const g = vergleichsform(gesprochen);
  if (!g) return 0;
  const { kerne: k } = vergleichVon(e);
  if (k.includes(g)) return 1;
  // Zwei Buchstaben („HU“) zählen nur, wenn sie genau passen
  if (g.replace(/ /g, "").length < 3) return 0;
  return Math.max(0, ...k.map((x) => aehnlichkeit(g, x)));
}

/** Etwas großzügiger als bei den gemerkten Preisen: gesprochen kommt seltener genau der Listenname. */
export const SCHWELLE_SPRACHE = 0.8;

/**
 * Bester Eintrag zu einem Stück Text, oder null. Reicht die Ähnlichkeit nicht, zählt auch ein Teilwort,
 * wenn es nur zu genau einem Eintrag gehört: „Aufbereitung“ für „Fahrzeugaufbereitung“, aber nicht
 * „Bremsen“, wenn es „Bremsen vorne“ und „Bremsen hinten“ gibt.
 */
export function besterEintrag<T extends Eintrag>(text: string, liste: T[], schwelle = SCHWELLE_SPRACHE): { eintrag: T; wert: number } | null {
  let bester: { eintrag: T; wert: number } | null = null;
  for (const e of liste) {
    const w = passung(text, e);
    if (w >= schwelle && (!bester || w > bester.wert)) bester = { eintrag: e, wert: w };
  }
  if (bester) return bester;
  const g = vergleichsform(text);
  if (g.includes(" ") || g.length < 6) return null;
  const treffer = liste.filter((e) => vergleichVon(e).kernWoerter.some((w) => w !== g && w.includes(g) && g.length * 2 >= w.length));
  return treffer.length === 1 ? { eintrag: treffer[0], wert: schwelle } : null;
}

/**
 * Kommt das Wort in der Preisliste vor? Dann ist es kein Kundenname („Termin für Müller Aufbereitung“).
 * Liest die aktuelle Liste, nicht eine feste Wortliste, damit auch neue Angebote einen Namen beenden.
 */
export function istFachwort(wort: string, liste: Eintrag[]): boolean {
  const g = vergleichsform(wort);
  if (!g || g.includes(" ")) return false;
  return liste.some((e) => vergleichVon(e).woerter.has(g)) || Boolean(besterEintrag(wort, liste));
}

/**
 * Alle Einträge, die irgendwo im Satz vorkommen. Probiert jede Folge von ein bis vier Wörtern (nicht über
 * einen Trenner hinweg), nimmt die besten Treffer ohne Überschneidung und jeden Eintrag nur einmal.
 */
export function eintraegeNehmen<T extends Eintrag & { id: string }>(rest: Rest, liste: T[], schwelle = SCHWELLE_SPRACHE): T[] {
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
