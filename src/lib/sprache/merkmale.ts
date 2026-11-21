import { MARKEN, markeNorm } from "../rechnung/aehnlich";
import { klein, namensSchreibung, type Rest, TRENNER, woerter, wort } from "./text";

/** Kontaktdaten, Kennzeichen, Fahrzeug und Namen aus einem gesprochenen Satz. */

/** Telefonnummer nach „Telefon“, „Handy“, „Nummer“, oder eine Folge, die wie eine Rufnummer aussieht. */
export function telefonNehmen(rest: Rest, auchOhneWort = true): string | null {
  const fertig = (s: string) => {
    const t = s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    return t.replace(/\D/g, "").length >= 6 ? t : null;
  };
  const mitWort = rest.nimmErstes(
    wort("(?:telefon(?:nummer)?|tel\\.?|handy(?:nummer)?|mobil(?:nummer)?|rufnummer|nummer)\\s*:?\\s*(\\+?\\d[\\d\\s/()-]{4,}\\d)"),
    (m) => fertig(m[1]),
  );
  if (mitWort || !auchOhneWort) return mitWort;
  return rest.nimmErstes(/(?<![\d,.:])((?:\+49|0049|0)\s?[1-9][\d\s/-]{5,}\d)(?![\d,.:])/gu, (m) => (m[1].replace(/\D/g, "").length >= 8 ? fertig(m[1]) : null));
}

/** E-Mail-Adresse, auch diktiert („max at web punkt de“). */
export function emailNehmen(rest: Rest): string | null {
  return (
    rest.nimmErstes(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu, (m) => m[0].toLowerCase()) ??
    rest.nimmErstes(wort("([\\p{L}\\d._-]+)\\s+(?:at|ät|et)\\s+([\\p{L}\\d-]+)\\s+(?:punkt|dot)\\s+(de|com|net|org|eu|info|at|ch)"), (m) =>
      `${m[1]}@${m[2]}.${m[3]}`.toLowerCase(),
    )
  );
}

/** Wörter, die vorn wie ein Ortskürzel aussehen, aber keins sind (nur wenn groß geschrieben erkannt). */
const KEIN_KUERZEL = new Set(["AM", "UM", "IN", "AN", "AB", "DI", "MI", "DO", "FR", "SA", "SO", "MO", "EIN", "DER", "DIE", "DAS", "ICH", "UND", "FÜR", "MIT", "VON", "ZU", "BIS", "HU", "AU", "TÜV"]);

/** Ziffern am Ende: „123“, oder einzeln diktiert „1 2 3“ (dann nur einstellige, sonst wäre „123 4 Zündkerzen“ ein Kennzeichen „1234“). */
const ZIFFERN = "(\\d(?:\\s\\d){1,3}(?!\\d)|\\d{1,4})";

const kennzeichenText = (a: string, b: string, n: string, e?: string) => `${a.toUpperCase()}-${b.toUpperCase()} ${n.replace(/\s/g, "")}${(e ?? "").toUpperCase()}`;

/**
 * Kennzeichen nach dem Wort „Kennzeichen“ (Schreibweise egal: „of ab 123“, „OF-AB123“), sonst nur in
 * Großbuchstaben („OF AB 123“), damit „am Di 10“ kein Kennzeichen wird.
 */
export function kennzeichenNehmen(rest: Rest, auchOhneWort = true): string | null {
  const mitWort =
    rest.nimmErstes(wort(`kennzeichen\\s*:?\\s*(\\p{L}{1,3})[\\s-]+(\\p{L}{1,2})[\\s-]*${ZIFFERN}\\s?([eh])?`), (m) => kennzeichenText(m[1], m[2], m[3], m[4])) ??
    rest.nimmErstes(wort(`kennzeichen\\s*:?\\s*(\\p{L}{2,5})[\\s-]*${ZIFFERN}([eh])?`), (m) => `${m[1].toUpperCase()} ${m[2].replace(/\s/g, "")}${(m[3] ?? "").toUpperCase()}`);
  if (mitWort || !auchOhneWort) return mitWort;
  return rest.nimmErstes(/(?<![\p{L}\d])([A-ZÄÖÜ]{1,3})[\s-]([A-Z]{1,2})[\s-]?(\d{1,4})([EH])?(?![\p{L}\d])/gu, (m) =>
    KEIN_KUERZEL.has(m[1]) ? null : kennzeichenText(m[1], m[2], m[3], m[4]),
  );
}

/** Häufige Modelle ohne Marke („der Golf von Müller“). Schlüssel: Kleinschrift ohne Leerzeichen. */
const MODELLE: Record<string, string> = {
  golf: "VW", polo: "VW", passat: "VW", tiguan: "VW", touran: "VW", touareg: "VW", sharan: "VW", caddy: "VW", arteon: "VW", troc: "VW", tcross: "VW", transporter: "VW", multivan: "VW", scirocco: "VW", beetle: "VW", kaefer: "VW", id3: "VW", id4: "VW",
  astra: "Opel", corsa: "Opel", insignia: "Opel", zafira: "Opel", mokka: "Opel", meriva: "Opel", vectra: "Opel", vivaro: "Opel", grandland: "Opel", crossland: "Opel",
  fiesta: "Ford", focus: "Ford", mondeo: "Ford", kuga: "Ford", transit: "Ford", puma: "Ford", galaxy: "Ford", smax: "Ford", cmax: "Ford",
  a1: "Audi", a3: "Audi", a4: "Audi", a5: "Audi", a6: "Audi", a8: "Audi", q2: "Audi", q3: "Audi", q5: "Audi", q7: "Audi", tt: "Audi",
  "1er": "BMW", "2er": "BMW", "3er": "BMW", "4er": "BMW", "5er": "BMW", x1: "BMW", x3: "BMW", x5: "BMW",
  aklasse: "Mercedes-Benz", bklasse: "Mercedes-Benz", cklasse: "Mercedes-Benz", eklasse: "Mercedes-Benz", sklasse: "Mercedes-Benz", sprinter: "Mercedes-Benz", vito: "Mercedes-Benz", citan: "Mercedes-Benz",
  octavia: "Škoda", fabia: "Škoda", superb: "Škoda", kodiaq: "Škoda", karoq: "Škoda", kamiq: "Škoda", scala: "Škoda",
  ibiza: "Seat", leon: "Seat", ateca: "Seat", arona: "Seat", tarraco: "Seat", formentor: "Cupra",
  yaris: "Toyota", corolla: "Toyota", auris: "Toyota", aygo: "Toyota", rav4: "Toyota", chr: "Toyota", prius: "Toyota",
  clio: "Renault", megane: "Renault", twingo: "Renault", kangoo: "Renault", captur: "Renault", scenic: "Renault",
  micra: "Nissan", qashqai: "Nissan", juke: "Nissan", xtrail: "Nissan",
  i10: "Hyundai", i20: "Hyundai", i30: "Hyundai", tucson: "Hyundai", kona: "Hyundai",
  ceed: "Kia", sportage: "Kia", picanto: "Kia", niro: "Kia",
  punto: "Fiat", panda: "Fiat", ducato: "Fiat", tipo: "Fiat",
  berlingo: "Citroën", sandero: "Dacia", duster: "Dacia", logan: "Dacia", jogger: "Dacia",
  swift: "Suzuki", vitara: "Suzuki", jimny: "Suzuki", cx5: "Mazda", mx5: "Mazda",
};

/** Kurzformen, die so stehen bleiben, wie man sie sagt. Sonst gilt die Schreibweise aus der Markenliste. */
const MARKE_ANZEIGE: Record<string, string> = { vw: "VW", mercedes: "Mercedes-Benz", benz: "Mercedes-Benz" };
const MARKEN_NORM = new Map(MARKEN.map((m) => [markeNorm(m), m]));

function markeAus(text: string, wissen: Fahrzeugwissen): string | null {
  const k = klein(text);
  if (MARKE_ANZEIGE[k]) return MARKE_ANZEIGE[k];
  return wissen.marken.get(markeNorm(text)) ?? null;
}

/** Teile von Wörtern, die nach Arbeit oder Ersatzteil klingen: so etwas ist weder Modell noch Name. */
const KFZ_TEILE = [
  "wechsel", "brems", "filter", "reifen", "rad", "oel", "service", "inspektion", "kerze", "batterie", "belag", "belaeg", "scheibe", "wischer",
  "kupplung", "riemen", "lampe", "birne", "auspuff", "klima", "motor", "getriebe", "achse", "lager", "daempfer", "feder", "kette", "pumpe",
  "sensor", "diagnose", "arbeit", "stunde", "reparatur", "tuev", "fluessigkeit", "kuehl", "licht", "spiegel", "tausch", "einbau", "montage",
];
export const klingtNachArbeit = (w: string) => {
  const k = klein(w);
  return KFZ_TEILE.some((t) => k.includes(t));
};

/** Wörter, an denen ein Name oder ein Modell endet. */
const STOP = new Set(
  [
    "am", "um", "morgen", "heute", "uebermorgen", "gestern", "naechste", "naechsten", "naechster", "kommende", "kommenden", "diese", "diesen",
    "mit", "wegen", "termin", "rechnung", "notiz", "kennzeichen", "telefon", "nummer", "handy", "mail", "email", "und", "oder", "der", "die", "das",
    "den", "dem", "des", "ein", "eine", "einen", "zum", "zur", "im", "in", "an", "auf", "fuer", "von", "vom", "bei", "beim", "ab", "bis", "bitte",
    "uhr", "halb", "viertel", "plus", "sowie", "dazu", "euro", "brutto", "netto", "auto", "wagen", "fahrzeug", "kommt", "bringt", "will",
    "moechte", "braucht", "hat", "ist", "noch", "mal", "also", "dann", "position", "positionen", "stueck", "stk", "liter", "satz", "rabatt",
    "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag", "januar", "februar", "maerz", "april", "mai", "juni",
    "juli", "august", "september", "oktober", "november", "dezember", "herr", "herrn", "frau", "kunde", "kundin", "seinen", "seinem", "ihren",
    "ihrem", "sein", "ihr", "zu", "zusammen", "je", "pro", "einkauf", "ek", "mwst", "bescheid", "erledigt", "machen", "eintragen",
  ].map(klein),
);
export const istStop = (w: string) => STOP.has(klein(w));

export type Fahrzeug = { marke: string; modell: string };

/** Was die Kartei an Marken und Modellen kennt (`fahrzeugTypen()`), zusätzlich zu den festen Listen oben. */
export type FahrzeugTypen = { marken?: string[]; modelle?: { marke: string; modell: string }[] };
export type Fahrzeugwissen = { modelle: Map<string, string>; marken: Map<string, string> };

/**
 * Feste Listen plus Kartei: Ein Modell, das schon einmal in der Werkstatt war, wird auch ohne Marke erkannt
 * („der Ypsilon von Müller“). Ein Modellwort, das bei zwei Marken vorkommt, zählt ohne Marke nicht.
 */
export function fahrzeugWissen(t?: FahrzeugTypen | null): Fahrzeugwissen {
  const marken = new Map(MARKEN_NORM);
  for (const m of t?.marken ?? []) {
    const n = markeNorm(m);
    if (n.length >= 2 && !marken.has(n)) marken.set(n, m.trim());
  }
  const modelle = new Map(Object.entries(MODELLE));
  const aus = new Map<string, string | null>();
  for (const { marke, modell } of t?.modelle ?? []) {
    if (!marke?.trim() || !modell?.trim()) continue;
    const erstes = modell.trim().split(/\s+/)[0];
    for (const k of new Set([klein(modell), klein(erstes)])) {
      // Kurze Wörter („Bus“) und alles, was nach Arbeit klingt, zählen nur zusammen mit der Marke
      if (k.length < 4 || /^\d+$/.test(k) || STOP.has(k) || klingtNachArbeit(k) || modelle.has(k)) continue;
      aus.set(k, aus.has(k) && aus.get(k) !== marke.trim() ? null : marke.trim());
    }
  }
  for (const [k, m] of aus) if (m) modelle.set(k, m);
  return { modelle, marken };
}

const FESTES_WISSEN = fahrzeugWissen();

const modellZusatz = (w: string) => /^(\d{1,3}|[ivx]{1,4}|gti|gtd|tdi|tsi|rs|st|plus|variant|kombi|avant|touring)$/i.test(w);

/**
 * Marke und Modell („VW Golf 7“, „Audi A4“, „der Golf“, „C-Klasse“). Nimmt nur das Fahrzeug heraus, die
 * Wörter drumherum („für den“) bleiben stehen.
 */
export function fahrzeugNehmen(rest: Rest, ersatz = TRENNER, wissen: Fahrzeugwissen = FESTES_WISSEN): Fahrzeug | null {
  const w = woerter(rest.text);
  for (let i = 0; i < w.length; i++) {
    const zwei = i + 1 < w.length && !w[i + 1].nachTrenner ? `${w[i].text} ${w[i + 1].text}` : null;
    let marke = zwei ? markeAus(zwei, wissen) : null;
    let n = marke ? 2 : 1;
    if (!marke) marke = markeAus(w[i].text, wissen);
    if (marke) {
      // Modell: das Wort danach, wenn es nicht schon etwas anderes ist
      const m = w[i + n];
      if (m && !m.nachTrenner && !istStop(m.text) && !klingtNachArbeit(m.text)) {
        let bis = i + n;
        while (bis + 1 < w.length && !w[bis + 1].nachTrenner && modellZusatz(w[bis + 1].text) && bis - i - n < 2) bis++;
        const modell = rest.text.slice(m.start, w[bis].ende);
        rest.entfernen(w[i].start, w[bis].ende, ersatz);
        return { marke, modell: modellSchreibung(modell) };
      }
      rest.entfernen(w[i].start, w[i + n - 1].ende, ersatz);
      return { marke, modell: "" };
    }
    // Nur das Modell
    const k2 = zwei ? klein(zwei) : "";
    n = k2 && wissen.modelle.has(k2) ? 2 : 1;
    const k = n === 2 ? k2 : klein(w[i].text);
    const modellMarke = wissen.modelle.get(k);
    if (modellMarke) {
      let bis = i + n - 1;
      while (bis + 1 < w.length && !w[bis + 1].nachTrenner && modellZusatz(w[bis + 1].text) && bis - i < 3) bis++;
      const modell = rest.text.slice(w[i].start, w[bis].ende);
      rest.entfernen(w[i].start, w[bis].ende, ersatz);
      return { marke: modellMarke, modell: modellSchreibung(modell) };
    }
  }
  return null;
}

/** „golf 7“ → „Golf 7“, „a4“ → „A4“, „c klasse“ → „C-Klasse“ */
function modellSchreibung(s: string): string {
  return s
    .replace(/^(\p{L})\s+klasse/iu, "$1-Klasse")
    .split(" ")
    .map((x) => (/^[a-z]{1,2}\d+$/i.test(x) ? x.toUpperCase() : x[0].toLocaleUpperCase("de-DE") + x.slice(1)))
    .join(" ");
}

/**
 * Name nach „für“, „Kunde“, „Herr“, „Frau“: ein bis drei Wörter, bis etwas kommt, das kein Name ist
 * (Datum, Zahl, Füllwort, Leistung). `keinName` prüft zusätzlich gegen die Preisliste.
 */
export function nameNehmen(
  rest: Rest,
  keinName: (woerterAbHier: string[]) => boolean = () => false,
  marker = "für|fuer|kunde|kundin|kunden|von|bei",
  wissen: Fahrzeugwissen = FESTES_WISSEN,
): string | null {
  // Ohne `wort()`: Das Muster endet mit Leerzeichen, danach kommt der Name selbst.
  const muster = new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:(?:${marker})\\s+)?(herrn?|frau)|(?:${marker}))(?![\\p{L}\\p{N}])\\s+`, "giu");
  for (let m = muster.exec(rest.text); m; m = muster.exec(rest.text)) {
    const start = m.index;
    const nach = m.index + m[0].length;
    const w = woerter(rest.text.slice(nach));
    const name: string[] = [];
    let ende = nach;
    const max = m[1] ? 2 : 3;
    for (let i = 0; i < w.length && name.length < max; i++) {
      const x = w[i];
      if (x.nachTrenner || /\d/.test(x.text) || istStop(x.text) || klingtNachArbeit(x.text) || markeAus(x.text, wissen) || wissen.modelle.has(klein(x.text))) break;
      if (keinName(w.slice(i).map((y) => y.text))) break;
      name.push(x.text);
      ende = nach + x.ende;
    }
    if (name.length) {
      rest.entfernen(start, ende);
      return namensSchreibung(name.join(" "));
    }
  }
  return null;
}

/** Person aus dem Team zu einem gesprochenen Vornamen oder vollen Namen. */
export function teamFinden<T extends { id: string; name: string }>(gesprochen: string, team: T[]): T | null {
  const g = klein(gesprochen);
  if (g.length < 2) return null;
  return team.find((p) => klein(p.name) === g) ?? team.find((p) => klein(p.name.split(/\s+/)[0] ?? "") === g) ?? null;
}

/** „Mitarbeiter Marco“, „zuweisen an Marco“, „Marco macht das“: Person aus dem Team. */
export function mitarbeiterNehmen<T extends { id: string; name: string }>(rest: Rest, team: T[]): T | null {
  if (!team.length) return null;
  return (
    rest.nimmErstes(wort("(?:mitarbeiter(?:in)?|zuweisen\\s+an|zugewiesen\\s+an|zuteilen\\s+an|übernimmt|uebernimmt)\\s+(\\p{L}+)"), (m) => teamFinden(m[1], team)) ??
    rest.nimmErstes(wort("(\\p{L}+)\\s+(?:macht\\s+(?:das|den|ihn|es)|übernimmt|uebernimmt)"), (m) => teamFinden(m[1], team))
  );
}
