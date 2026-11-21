import { berlinDatum, berlinUhrzeit, istDatum, plusMonate, plusTage, type Wiederholung, wochenbeginn, wochentag } from "../zeit";
import { klein, type Rest, wort } from "./text";
import { ordnungszahl } from "./zahlen";

/**
 * Datum und Uhrzeit aus gesprochenen Angaben: „morgen“, „nächsten Dienstag“, „am 3. Dezember“, „halb neun“,
 * „Viertel nach zehn“, „in zwei Stunden“. Rechnet über `zeit.ts`, also immer in Berliner Zeit.
 */

const WOCHENTAGE: Record<string, number> = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6, sonntag: 7 };
const WT = "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag";
const MONAT = "januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sept|sep|okt|nov|dez";
const MONAT_NR: Record<string, number> = { jan: 1, jae: 1, feb: 2, mae: 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dez: 12 };

/** Termine und Erinnerungen liegen in der Zukunft, das Datum einer Rechnung in der Vergangenheit. */
export type Richtung = "zukunft" | "vergangenheit";

const monatNr = (s: string) => MONAT_NR[klein(s).slice(0, 3)] ?? null;
const zwei = (n: number) => String(n).padStart(2, "0");

/** Wochentag ab heute: in der Zukunft der nächste (heute nicht mitgezählt), in der Vergangenheit der letzte (heute mitgezählt). */
function wochentagDatum(heute: string, ziel: number, richtung: Richtung, auchHeute = false): string {
  const w = wochentag(heute);
  if (richtung === "vergangenheit") return plusTage(heute, -((w - ziel + 7) % 7));
  let d = (ziel - w + 7) % 7;
  if (d === 0 && !auchHeute) d = 7;
  return plusTage(heute, d);
}

/** Tag und Monat ohne Jahr: das nächste (bzw. letzte) Vorkommen. */
function mitJahr(heute: string, monat: number, tag: number, jahr: number | null, richtung: Richtung): string | null {
  const j = Number(heute.slice(0, 4));
  if (jahr !== null) {
    const d = `${jahr < 100 ? 2000 + jahr : jahr}-${zwei(monat)}-${zwei(tag)}`;
    return istDatum(d) ? d : null;
  }
  const d = `${j}-${zwei(monat)}-${zwei(tag)}`;
  if (!istDatum(d)) {
    // 29. Februar: im nächsten bzw. letzten Schaltjahr gibt es ihn vielleicht, so weit rechnen wir nicht
    return null;
  }
  if (richtung === "zukunft" && d < heute) return `${j + 1}${d.slice(4)}`;
  if (richtung === "vergangenheit" && d > heute) return `${j - 1}${d.slice(4)}`;
  return d;
}

/** Nur der Tag („am 3.“, „am dritten“): in diesem Monat, sonst im nächsten (bzw. letzten). */
function nurTag(heute: string, tag: number, richtung: Richtung): string | null {
  const t = Number(heute.slice(8, 10));
  const monatsAnfang = `${heute.slice(0, 7)}-01`;
  const basis = richtung === "zukunft" && tag < t ? plusMonate(monatsAnfang, 1) : richtung === "vergangenheit" && tag > t ? plusMonate(monatsAnfang, -1) : monatsAnfang;
  const d = `${basis.slice(0, 7)}-${zwei(tag)}`;
  return istDatum(d) ? d : null;
}

const tagZahl = (s: string): number | null => {
  const ziffern = /^(\d{1,2})\.?$/.exec(s);
  const n = ziffern ? Number(ziffern[1]) : ordnungszahl(s);
  return n !== null && n >= 1 && n <= 31 ? n : null;
};

const NAECHSTE = "nächste[nrs]?|naechste[nrs]?|kommende[nrs]?|übernächste[nrs]?|uebernaechste[nrs]?";
const wochenAbstand = (s: string) => (/^(übernächst|uebernaechst)/i.test(s) ? 2 : 1);

/** Ein Datum aus dem Satz nehmen. */
export function datumNehmen(rest: Rest, heute: string, richtung: Richtung = "zukunft"): string | null {
  // „nächste Woche Dienstag“ / „Dienstag nächste Woche“: Wochentag in der Woche danach
  const inWoche = (abstand: number, tag: string) => plusTage(wochenbeginn(plusTage(heute, 7 * abstand)), WOCHENTAGE[klein(tag)] - 1);
  const wocheTag =
    rest.nimmErstes(wort(`(?:am\\s+)?(${NAECHSTE})\\s+woche\\s+(?:am\\s+)?(${WT})`), (m) => inWoche(wochenAbstand(m[1]), m[2])) ??
    rest.nimmErstes(wort(`(?:am\\s+)?(${WT})\\s+(?:in\\s+der\\s+)?(${NAECHSTE})\\s+woche`), (m) => inWoche(wochenAbstand(m[2]), m[1]));
  if (wocheTag) return wocheTag;

  const tag = rest.nimmErstes(
    wort(`(?:am\\s+|bis\\s+|ab\\s+)?(?:(nächste[nrs]?|naechste[nrs]?|kommende[nrs]?|diese[nrs]?|letzte[nrs]?|vergangene[nrs]?)\\s+)?(${WT})`),
    (m) => wochentagDatum(heute, WOCHENTAGE[klein(m[2])], m[1] && /^(letzt|vergangen)/i.test(m[1]) ? "vergangenheit" : richtung),
  );
  if (tag) return tag;

  const relativ = rest.nimmErstes(wort("vorgestern|gestern|übermorgen|uebermorgen|morgen|heute"), (m) => {
    const w = klein(m[0]);
    return plusTage(heute, { vorgestern: -2, gestern: -1, uebermorgen: 2, morgen: 1, heute: 0 }[w] ?? 0);
  });
  if (relativ) return relativ;

  const spaeter = rest.nimmErstes(wort("in\\s+(\\d+|einer|einem|eine)\\s+(tag|tagen|woche|wochen|monat|monaten)"), (m) => {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
    const einheit = klein(m[2]);
    return einheit.startsWith("monat") ? plusMonate(heute, n) : plusTage(heute, einheit.startsWith("woche") ? 7 * n : n);
  });
  if (spaeter) return spaeter;

  // „3.12.“, „03.12.2026“, „am 3.12“
  const zahlen =
    rest.nimmErstes(/(?:(?:am|den|zum|vom|bis)\s+)?(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2})(?![\d:]))?/giu, (m) =>
      mitJahr(heute, Number(m[2]), Number(m[1]), m[3] ? Number(m[3]) : null, richtung),
    ) ??
    rest.nimmErstes(/(?:am|den|zum|vom|bis)\s+(\d{1,2})\.(\d{1,2})(?![\d.,:])/giu, (m) => mitJahr(heute, Number(m[2]), Number(m[1]), null, richtung));
  if (zahlen && Number(zahlen.slice(5, 7)) >= 1) return zahlen;

  // „am 3. Dezember“, „dritten Dezember 2026“
  const mitMonat = rest.nimmErstes(wort(`(?:am\\s+|den\\s+|zum\\s+|vom\\s+|bis\\s+)?(\\d{1,2}\\.?|\\p{L}+)\\s+(${MONAT})\\.?(?:\\s+(\\d{4}))?`), (m) => {
    const t = tagZahl(m[1]);
    const mo = monatNr(m[2]);
    return t && mo ? mitJahr(heute, mo, t, m[3] ? Number(m[3]) : null, richtung) : null;
  });
  if (mitMonat) return mitMonat;

  // „am 3.“, „zum ersten“
  const einzeln = rest.nimmErstes(/(?<![\p{L}\p{N}])(?:am|den|zum|vom|bis)\s+(\d{1,2}\.(?!\d)|\p{L}+)(?![\p{L}\p{N}])/giu, (m) => {
    const t = tagZahl(m[1]);
    return t ? nurTag(heute, t, richtung) : null;
  });
  if (einzeln) return einzeln;

  return rest.nimmErstes(wort(`(${NAECHSTE})\\s+woche`), (m) => wochenbeginn(plusTage(heute, 7 * wochenAbstand(m[1]))));
}

type Tageszeit = "vormittag" | "nachmittag" | null;

/**
 * „um 3“ heißt in der Werkstatt 15 Uhr: Ohne „morgens“ gelten 1 bis 6 als Nachmittag. „halb eins“ ist Mittag.
 */
function stunde(h: number, teil: Tageszeit): number {
  if (teil === "nachmittag" && h < 12) return h + 12;
  if (teil === null && h >= 1 && h <= 6) return h + 12;
  if (h === 0 && teil !== "vormittag") return 12;
  return h;
}

const KEINE_UHR = "(?!\\s*(?:euro|€|eur|stunden?|std|minuten?|min|stück|stk|liter|prozent|%|tage?n?|wochen?|monate?n?|mal|x)(?![\\p{L}]))";
const UM = "(?:(?:um|gegen|ab|bis)\\s+)?";

/** Eine Uhrzeit „HH:MM“ aus dem Satz nehmen. */
export function uhrzeitNehmen(rest: Rest): string | null {
  const teil: Tageszeit = rest.nimm(wort("(?:am\\s+)?(?:nachmittags?|abends?)|heute\\s+abend"))
    ? "nachmittag"
    : rest.nimm(wort("(?:am\\s+)?(?:vormittags?|morgens)|früh|frueh|in\\s+der\\s+früh"))
      ? "vormittag"
      : null;

  const fertig = (h: number, m: number) => {
    const s = stunde(h, teil);
    return s >= 0 && s <= 23 && m >= 0 && m <= 59 ? `${zwei(s)}:${zwei(m)}` : null;
  };
  // Vor einer vollen Stunde: „Viertel vor neun“ = 8:45
  const vor = (h: number, m: number) => fertig(h === 0 ? 23 : h - 1, 60 - m);

  return (
    rest.nimmErstes(new RegExp(`${UM}(?<![\\d.,])(\\d{1,2}):(\\d{2})(?!\\d)(?:\\s*uhr)?`, "giu"), (m) => fertig(+m[1], +m[2])) ??
    rest.nimmErstes(new RegExp(`(?<![\\d.,])(\\d{1,2})\\.(\\d{2})\\s*uhr`, "giu"), (m) => fertig(+m[1], +m[2])) ??
    rest.nimmErstes(new RegExp(`(?:um|gegen|ab|bis)\\s+(\\d{1,2})\\.(\\d{2})(?![\\d.])`, "giu"), (m) => fertig(+m[1], +m[2])) ??
    rest.nimmErstes(new RegExp(`${UM}(?<![\\d.,])(\\d{1,2})\\s*uhr(?![\\p{L}])(?:\\s+(\\d{1,2})(?!\\d|[,.]\\d)${KEINE_UHR})?`, "giu"), (m) => fertig(+m[1], m[2] ? +m[2] : 0)) ??
    rest.nimmErstes(new RegExp(`${UM}(?<![\\d.,])(\\d{1,2})\\s+(nach|vor)\\s+(halb\\s+)?(\\d{1,2})(?!\\d|[,.]\\d)${KEINE_UHR}`, "giu"), (m) => {
      const min = +m[1];
      const h = +m[4];
      if (min > 29) return null;
      if (m[3]) return /nach/i.test(m[2]) ? fertig(h - 1, 30 + min) : fertig(h - 1, 30 - min);
      return /nach/i.test(m[2]) ? fertig(h, min) : vor(h, min);
    }) ??
    rest.nimmErstes(wort(`${UM}viertel\\s+nach\\s+(\\d{1,2})`), (m) => fertig(+m[1], 15)) ??
    rest.nimmErstes(wort(`${UM}viertel\\s+vor\\s+(\\d{1,2})`), (m) => vor(+m[1], 15)) ??
    rest.nimmErstes(wort(`${UM}(?:drei\\s?viertel|3\\s*viertel)\\s+(\\d{1,2})`), (m) => vor(+m[1], 15)) ??
    rest.nimmErstes(wort(`${UM}viertel\\s+(\\d{1,2})`), (m) => fertig(+m[1] - 1, 15)) ??
    rest.nimmErstes(wort(`${UM}halb\\s+(\\d{1,2})`), (m) => fertig(+m[1] - 1, 30)) ??
    rest.nimmErstes(new RegExp(`(?<![\\p{L}\\p{N}])(?:um|gegen|ab|bis)\\s+(\\d{1,2})(?![\\d:]|[,.]\\d)${KEINE_UHR}`, "giu"), (m) => fertig(+m[1], 0)) ??
    rest.nimmErstes(wort("mittags?"), () => "12:00")
  );
}

/** „in zwei Stunden“, „in einer halben Stunde“, „in 20 Minuten“: Zeitpunkt ab jetzt. */
export function spaeterNehmen(rest: Rest, jetzt: Date): { datum: string; uhrzeit: string } | null {
  const minuten =
    rest.nimmErstes(wort("in\\s+(?:einer\\s+)?halben\\s+stunde"), () => 30) ??
    rest.nimmErstes(wort("in\\s+(?:einer\\s+)?viertelstunde"), () => 15) ??
    rest.nimmErstes(wort("in\\s+(\\d+(?:,\\d+)?|einer|einem|eine)\\s+(minuten?|min|stunden?|std)"), (m) => {
      const n = /\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : 1;
      return Math.round(n * (/^st/i.test(m[2]) ? 60 : 1));
    });
  if (minuten === null) return null;
  const z = new Date(jetzt.getTime() + minuten * 60000);
  return { datum: berlinDatum(z), uhrzeit: berlinUhrzeit(z) };
}

/** „jeden Montag“, „täglich“, „jeden Monat“: Wiederholung, bei einem Wochentag auch der erste Termin. */
export function wiederholungNehmen(rest: Rest, heute: string): { wiederholung: Wiederholung; datum: string | null } | null {
  return (
    rest.nimmErstes(wort(`jeden\\s+(${WT})|(${WT})s`), (m) => ({
      wiederholung: "woechentlich" as const,
      datum: wochentagDatum(heute, WOCHENTAGE[klein(m[1] ?? m[2])], "zukunft", true),
    })) ??
    rest.nimmErstes(wort("jeden\\s+(?:ersten|1\\.)(?:\\s+(?:des\\s+monats|im\\s+monat))?"), () => ({
      wiederholung: "monatlich" as const,
      datum: heute.endsWith("-01") ? heute : plusMonate(`${heute.slice(0, 7)}-01`, 1),
    })) ??
    rest.nimmErstes(wort("jeden\\s+tag|täglich|taeglich|jeden\\s+morgen|jeden\\s+abend"), () => ({ wiederholung: "taeglich" as const, datum: null })) ??
    rest.nimmErstes(wort("jede\\s+woche|wöchentlich|woechentlich|einmal\\s+(?:pro|die|in\\s+der)\\s+woche"), () => ({ wiederholung: "woechentlich" as const, datum: null })) ??
    rest.nimmErstes(wort("jeden\\s+monat|monatlich|einmal\\s+(?:pro|im)\\s+monat"), () => ({ wiederholung: "monatlich" as const, datum: null }))
  );
}
