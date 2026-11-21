/**
 * Zahlwörter in Ziffern. Die Diktierfunktion schreibt Zahlen meist schon als Ziffern („180 €“), aber nicht
 * immer („zwei Stunden“, „halb neun“, „neunzehn Euro fünfzig“). Danach müssen die übrigen Regeln nur noch
 * Ziffern kennen.
 */

const EINER: Record<string, number> = { ein: 1, eins: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9 };
const ZEHN_BIS_NEUNZEHN: Record<string, number> = {
  zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
};
const ZEHNER: Record<string, number> = { zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };

/** Kleinbuchstaben mit ausgeschriebenen Umlauten, wie die Tabellen oben. */
const norm = (w: string) => w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

function unter100(w: string): number | null {
  if (w in EINER) return EINER[w];
  if (w in ZEHN_BIS_NEUNZEHN) return ZEHN_BIS_NEUNZEHN[w];
  if (w in ZEHNER) return ZEHNER[w];
  // „einundzwanzig“: Einer + „und“ + Zehner
  const i = w.indexOf("und");
  if (i > 0) {
    const e = EINER[w.slice(0, i)];
    const z = ZEHNER[w.slice(i + 3)];
    if (e && z) return e + z;
  }
  return null;
}

function unter1000(w: string): number | null {
  const i = w.indexOf("hundert");
  if (i < 0) return unter100(w);
  const links = i === 0 ? 1 : unter100(w.slice(0, i));
  const rechts = w.slice(i + 7);
  const r = rechts ? unter100(rechts) : 0;
  return links !== null && links < 10 && r !== null ? links * 100 + r : null;
}

/** Ein Zahlwort („dreihundertfünfzig“) als Zahl, sonst null. */
export function zahlwort(wort: string): number | null {
  const w = norm(wort);
  if (w === "null") return 0;
  const i = w.indexOf("tausend");
  if (i < 0) return unter1000(w);
  const links = i === 0 ? 1 : unter1000(w.slice(0, i));
  const rechts = w.slice(i + 7);
  const r = rechts ? unter1000(rechts) : 0;
  return links !== null && r !== null ? links * 1000 + r : null;
}

/** Unregelmäßige Ordnungszahlen, als Stamm ohne Endung („erst-en“, „drit-te“, „sieb-ten“, „ach-te“). */
const ORDNUNG_SONDER: Record<string, number> = { er: 1, drit: 3, sieb: 7, ach: 8 };
const ENDUNGEN = ["sten", "ster", "stes", "ste", "ten", "ter", "tes", "te"];

/** „dritten“, „sechste“, „zwanzigste“, „einunddreißigsten“ → 3, 6, 20, 31. Für Datumsangaben. */
export function ordnungszahl(wort: string): number | null {
  const w = norm(wort);
  // Jede passende Endung probieren: „sechsten“ ist „sechs-ten“, nicht „sech-sten“.
  for (const e of ENDUNGEN) {
    if (!w.endsWith(e) || w.length <= e.length) continue;
    const stamm = w.slice(0, -e.length);
    if (stamm in ORDNUNG_SONDER) return ORDNUNG_SONDER[stamm];
    const n = zahlwort(stamm);
    // „-ste“ ab zwanzig, „-te“ bis neunzehn
    if (n && (e.startsWith("s") ? n >= 20 : n < 20)) return n;
  }
  return null;
}

/** Artikel sind auch Zahlwörter („ein Termin“), bleiben aber Wörter. Mengen wie „eine Stunde“ regeln die Muster selbst. */
const ARTIKEL = new Set(["ein", "eine", "einen", "einem", "einer", "eines"]);

/** Dezimalzahl mit Komma, ohne überflüssige Nullen: 2.5 → „2,5“. */
const alsText = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** Alle Zahlwörter eines Satzes durch Ziffern ersetzen. */
export function zahlenEinsetzen(text: string): string {
  return text
    .replace(/\p{L}+/gu, (wort) => {
      const w = norm(wort);
      if (ARTIKEL.has(w)) return wort;
      if (w === "anderthalb" || w === "eineinhalb") return "1,5";
      if (w.endsWith("einhalb") && w.length > 7) {
        const n = zahlwort(w.slice(0, -7));
        if (n !== null) return alsText(n + 0.5);
      }
      const n = zahlwort(w);
      return n === null ? wort : String(n);
    })
    .replace(/(\d+)\s+komma\s+(\d+)/giu, "$1,$2");
}

/** „2,5“, „2.5“ oder „1.200“ als Zahl. Tausenderpunkte nur, wenn danach genau drei Ziffern folgen. */
export function dezimal(s: string): number | null {
  const t = s.trim();
  const zahl = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(zahl)) return null;
  const n = Number(zahl);
  return Number.isFinite(n) ? n : null;
}

/** Euro-Betrag als Cent: „180“ → 18000, „19,90“ → 1990, „1.200“ → 120000. */
export function centAusText(euro: string, cent?: string): number | null {
  const n = dezimal(euro);
  if (n === null) return null;
  return Math.round(n * 100) + (cent ? Number(cent.padEnd(2, "0").slice(0, 2)) : 0);
}
