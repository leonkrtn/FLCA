/**
 * Unscharfer Vergleich für gemerkte Preise: „ungefähr gleiches Auto“ und „ungefähr gleiche Position“.
 * Läuft im Browser (Editor) und auf dem Server (Merken beim Stellen), deshalb ohne Abhängigkeiten.
 *
 * Absichtlich grob: Es soll sich ungefähr merken, was ein Golf kostet, ohne dass jemand Motor oder Baujahr
 * eintragen muss. Marke und Modell zählen, Schreibweisen wie „VW“/„Volkswagen“ oder „Golf VII“/„Golf 7“ nicht.
 */

const MARKEN_ALIAS: Record<string, string> = {
  vw: "volkswagen",
  mercedesbenz: "mercedes",
  mb: "mercedes",
  benz: "mercedes",
  daimler: "mercedes",
  chevy: "chevrolet",
  alfa: "alfaromeo",
  range: "landrover",
  rangerover: "landrover",
};

/** Häufige Marken für die Vorschläge, solange die Kartei noch wenige kennt. */
export const MARKEN = [
  "Alfa Romeo", "Audi", "BMW", "Citroën", "Cupra", "Dacia", "Fiat", "Ford", "Honda", "Hyundai", "Jaguar", "Jeep", "Kia",
  "Land Rover", "Lancia", "Mazda", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Porsche", "Renault",
  "Seat", "Škoda", "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

/** Kleinbuchstaben, Umlaute ausgeschrieben, Akzente weg, nur Buchstaben, Ziffern und einzelne Leerzeichen. */
export function grundform(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ROEMISCH: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

export function markeNorm(marke: string): string {
  const g = grundform(marke).replace(/ /g, "");
  return MARKEN_ALIAS[g] ?? g;
}

export function modellNorm(modell: string): string {
  // „Golf VII“ = „Golf 7“, „C-Klasse“ = „C Klasse“ = „cklasse“
  return grundform(modell)
    .split(" ")
    .map((w, i) => (i > 0 && ROEMISCH[w] ? ROEMISCH[w] : w))
    .join("");
}

/** Schlüssel für „so ein Auto“. Leer, wenn Marke oder Modell fehlt: dann gibt es keine gemerkten Preise. */
export function fahrzeugSchluessel(marke?: string | null, modell?: string | null): { marke_norm: string; modell_norm: string } | null {
  const m = markeNorm(marke ?? "");
  const o = modellNorm(modell ?? "");
  return m && o ? { marke_norm: m, modell_norm: o } : null;
}

/** Zweiteilige Marken, damit „Alfa Romeo Giulia“ nicht als Marke „Alfa“ und Modell „Romeo Giulia“ endet. */
const ZWEITEILIG = ["alfa romeo", "land rover", "aston martin", "rolls royce", "mercedes benz"];

/**
 * Alter Freitext „VW Golf 7“ → Marke „VW“, Modell „Golf 7“. Für Fahrzeuge aus der Zeit vor den getrennten
 * Feldern und für Anfragen von der Website, die nur ein Feld haben. Nur ein Vorschlag, im Editor änderbar.
 */
export function markeModellTrennen(text: string): { marke: string; modell: string } {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return { marke: "", modell: "" };
  const teile = t.split(" ");
  // Nur echte zwei Wörter zählen: „Mercedes-Benz C“ ist schon einteilig.
  const n = teile.length > 1 && ZWEITEILIG.includes(grundform(teile.slice(0, 2).join(" "))) ? 2 : 1;
  return { marke: teile.slice(0, n).join(" "), modell: teile.slice(n).join(" ") };
}

export const fahrzeugText = (f: { marke?: string | null; modell?: string | null }) => [f.marke, f.modell].filter((x) => x?.trim()).join(" ");

/** Wortstamm grob: „Bremsscheiben“ = „Bremsscheibe“, „Filters“ = „Filter“. */
function stamm(w: string): string {
  return w.length > 4 ? w.replace(/(en|n|e|s)$/, "") : w;
}

const KUERZEL: Record<string, string> = { va: "vorne", vorderachse: "vorne", vorn: "vorne", ha: "hinten", hinterachse: "hinten", li: "links", re: "rechts", wechseln: "erneuern", ersetzen: "erneuern", tauschen: "erneuern" };

/** Vergleichsform einer Positionsbezeichnung. Gespeichert als text_norm. */
export function textNorm(text: string): string {
  return grundform(text)
    .split(" ")
    .filter(Boolean)
    .map((w) => stamm(KUERZEL[w] ?? w))
    .join(" ");
}

function bigramme(s: string): Map<string, number> {
  const t = s.replace(/ /g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Ähnlichkeit 0…1 zweier Vergleichsformen (Dice-Koeffizient über Buchstabenpaare). */
export function aehnlichkeit(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const x = bigramme(a);
  const y = bigramme(b);
  let gemeinsam = 0;
  let summe = 0;
  for (const [k, n] of x) {
    gemeinsam += Math.min(n, y.get(k) ?? 0);
    summe += n;
  }
  for (const n of y.values()) summe += n;
  return summe ? (2 * gemeinsam) / summe : 0;
}

/** Ab hier gilt eine Bezeichnung als „dieselbe Position“. */
export const SCHWELLE = 0.82;

/** Der beste Treffer zu einer Bezeichnung, oder null. Bei Gleichstand gewinnt der jüngste (Liste ist danach sortiert). */
export function besterTreffer<T extends { text_norm: string }>(text: string, liste: T[]): T | null {
  const n = textNorm(text);
  if (!n) return null;
  let bester: T | null = null;
  let wert = 0;
  for (const e of liste) {
    const w = aehnlichkeit(n, e.text_norm);
    if (w > wert) {
      wert = w;
      bester = e;
    }
  }
  return wert >= SCHWELLE ? bester : null;
}
