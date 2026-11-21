/**
 * Grundbausteine fürs Verstehen gesprochener Sätze. Alles hier sind feste Regeln, kein Sprachmodell:
 * Was erkannt wird, steht als Muster im Code und lässt sich in den Tests nachlesen.
 *
 * Läuft im Browser (Vorschau beim Sprechen) und auf dem Server (Übernehmen), deshalb ohne Abhängigkeiten.
 */

/** Ersetzt erkannte Stellen im Satz. Ein Name läuft so nicht über ein erkanntes Datum hinweg weiter. */
export const TRENNER = " | ";

/** Wortgrenzen auch für Umlaute (\b kennt nur a–z). */
const VOR = "(?<![\\p{L}\\p{N}])";
const NACH = "(?![\\p{L}\\p{N}])";

/** Muster für ganze Wörter, ohne Groß-/Kleinschreibung. Immer global, damit `nimmErstes` weitersuchen kann. */
export function wort(quelle: string, flags = "giu"): RegExp {
  return new RegExp(`${VOR}(?:${quelle})${NACH}`, flags);
}

/**
 * Der noch nicht verstandene Teil des Satzes. Jede Erkennung nimmt ihren Treffer heraus; am Ende bleibt,
 * was zu nichts passte (Titel einer Notiz, freie Leistung, Positionstext).
 */
export class Rest {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  /**
   * Erster Treffer, den `deuten` annimmt, wird herausgenommen. `deuten` kann ablehnen (null), dann wird
   * weitergesucht: „am 3.“ ist ein Datum, „am Golf“ nicht.
   */
  nimmErstes<T>(muster: RegExp, deuten: (m: RegExpExecArray) => T | null, ersatz = TRENNER): T | null {
    const g = muster.global ? muster : new RegExp(muster.source, `${muster.flags}g`);
    g.lastIndex = 0;
    for (let m = g.exec(this.text); m; m = g.exec(this.text)) {
      const wert = deuten(m);
      if (wert !== null && wert !== undefined) {
        this.entfernen(m.index, m.index + m[0].length, ersatz);
        return wert;
      }
      if (m[0].length === 0) g.lastIndex++;
    }
    return null;
  }

  /** Nur prüfen, ob ein Muster vorkommt, und es dann herausnehmen. */
  nimm(muster: RegExp, ersatz = TRENNER): boolean {
    return this.nimmErstes(muster, () => true, ersatz) !== null;
  }

  entfernen(start: number, ende: number, ersatz = TRENNER) {
    this.text = this.text.slice(0, start) + ersatz + this.text.slice(ende);
  }
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur Buchstaben und Ziffern. Für Wortvergleiche. */
export function klein(w: string): string {
  return w
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Wörter mit Position im Text. Ein Trenner dazwischen beendet eine Wortgruppe. */
export type Wort = { text: string; start: number; ende: number; nachTrenner: boolean };

export function woerter(text: string): Wort[] {
  const liste: Wort[] = [];
  let letztesEnde = 0;
  for (const m of text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
    const start = m.index ?? 0;
    liste.push({ text: m[0], start, ende: start + m[0].length, nachTrenner: /[|,;.!?:]/.test(text.slice(letztesEnde, start)) });
    letztesEnde = start + m[0].length;
  }
  return liste;
}

/** Füllwörter, die am Rand eines Rests nichts bedeuten („Bremsen vorne machen“ → „Bremsen vorne“). */
const FUELL = new Set(
  [
    "und", "oder", "auch", "noch", "dann", "dazu", "plus", "sowie", "ausserdem", "bitte", "mal", "also", "ja", "so",
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines",
    "fuer", "mit", "am", "um", "an", "auf", "im", "in", "zum", "zur", "bei", "beim", "von", "vom", "zu", "ab",
    "eintragen", "anlegen", "machen", "schreiben", "aufschreiben", "notieren", "merken", "erstellen", "neu", "neue", "neuer", "neuen",
    "termin", "rechnung", "notiz", "position", "positionen", "dass", "daran", "ich", "wir", "er", "sie", "es",
    "kommt", "kommen", "bringt", "will", "moechte", "braucht", "hat", "ist", "soll", "sollen", "muss", "muessen",
  ].map(klein),
);

/** Füllwörter vorn und hinten abschneiden, Satzzeichen glätten. Leer, wenn nichts Bedeutendes bleibt. */
export function saeubern(stueck: string): string {
  let w = stueck
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const rand = (x: string) => FUELL.has(klein(x)) || /^[,;.:!?-]+$/.test(x);
  while (w.length && rand(w[0])) w = w.slice(1);
  while (w.length && rand(w[w.length - 1])) w = w.slice(0, -1);
  return w
    .join(" ")
    .replace(/\s+([,;.:!?])/g, "$1")
    .replace(/^[,;.:!?\s-]+|[,;:\s-]+$/g, "")
    .trim();
}

/** Teile eines Rests zwischen den Trennern, jeweils gesäubert, leere weg. */
export function stuecke(text: string): string[] {
  return text
    .split(/[|;\n]|[,.](?!\d)|(?<!\d)[,.]/)
    .map(saeubern)
    .filter(Boolean);
}

export const grossAnfang = (s: string) => (s ? s[0].toLocaleUpperCase("de-DE") + s.slice(1) : s);

/** „max müller-lüdenscheid“ → „Max Müller-Lüdenscheid“ */
export const namensSchreibung = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, vor: string, b: string) => vor + b.toLocaleUpperCase("de-DE"));
