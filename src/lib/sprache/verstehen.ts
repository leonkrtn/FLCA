import type { Rabatt } from "../rechnung/berechnung";
import { berlinUhrzeit, plusTage, type Wiederholung } from "../zeit";
import { besterEintrag, type Eintrag, eintraegeNehmen, istFachwort, SCHWELLE_SPRACHE } from "./abgleich";
import {
  emailNehmen,
  type Fahrzeug,
  fahrzeugNehmen,
  type FahrzeugTypen,
  fahrzeugWissen,
  kennzeichenNehmen,
  mitarbeiterNehmen,
  nameAmAnfang,
  nameNehmen,
  teamFinden,
  telefonNehmen,
} from "./merkmale";
import { grossAnfang, klein, Rest, saeubern, stuecke, wort } from "./text";
import { centAusText, dezimal, zahlenEinsetzen } from "./zahlen";
import { datumNehmen, spaeterNehmen, uhrzeitNehmen, wiederholungNehmen } from "./zeitangaben";

/**
 * Aus einem gesprochenen Satz eine Notiz, einen Termin oder eine Rechnung machen. Feste Regeln, kein
 * Sprachmodell: Was nicht erkannt wird, bleibt als Text stehen und wird im Formular von Hand verteilt.
 * Gespeichert wird hier nichts, das Ergebnis füllt nur ein Formular bzw. einen Entwurf vor.
 */

export type Art = "notiz" | "termin" | "rechnung";

export const ART_TEXT: Record<Art, string> = { notiz: "Notiz", termin: "Termin", rechnung: "Rechnung" };

const ABSICHT: [Art, RegExp][] = [
  ["notiz", wort("notiz|notizen|erinnere|erinner|erinnerung|erinnern|merke|merken|aufschreiben|notieren")],
  ["termin", wort("termin|termine|terminanfrage")],
  ["rechnung", wort("rechnung|rechnungen|abrechnen|abrechnung")],
];

/** Worum geht es? Das erste passende Schlüsselwort entscheidet („Erinnere mich an den Termin“ ist eine Notiz). */
function schluesselwort(satz: string): { art: Art; wort: string } | null {
  let beste: { art: Art; stelle: number; wort: string } | null = null;
  for (const [art, muster] of ABSICHT) {
    muster.lastIndex = 0;
    const m = muster.exec(satz);
    if (m && (!beste || m.index < beste.stelle)) beste = { art, stelle: m.index, wort: m[0] };
  }
  return beste;
}

export const absichtErkennen = (satz: string): Art | null => schluesselwort(satz)?.art ?? null;

export type ArtErkannt = {
  art: Art;
  /** Woran es erkannt wurde, für die Anzeige („Datum, Uhrzeit, Leistung“) */
  grund: string;
  /** Eindeutig: Schlüsselwort oder klarer Vorsprung. Sonst zeigt die Seite „bitte prüfen“. */
  sicher: boolean;
};

/** Aufgaben, die man sich merkt: Das ist eine Notiz, auch mit Datum („morgen um 9 Reifen bestellen“). */
const AUFGABE = "bestellen|bestelle|anrufen|zurückrufen|zurueckrufen|rückruf|rueckruf|besorgen|nachfragen|nachhaken|klären|klaeren|abklären|abklaeren|nachschauen|kümmern|kuemmern|schicken|mailen|erledigen|nicht\\s+vergessen|denk(?:e|t)?\\s+(?:dran|daran)|aufgabe|todo";

/**
 * Was ist gemeint, wenn kein Schlüsselwort fällt? Jede Spur zählt Punkte, die meisten gewinnen:
 * Preis, brutto/netto, Rabatt, Arbeitsstunden oder ein vergangenes Datum → Rechnung. Leistung aus der
 * Preisliste, Datum, Uhrzeit, „kommt“, Kennzeichen → Termin. Aufgabe („bestellen“, „anrufen“),
 * „in zwei Stunden“, „jeden Montag“ → Notiz. Ohne Spur oder bei Gleichstand: Notiz, das ist das
 * Harmloseste, und die Seite bittet ums Prüfen.
 */
export function artErkennen(satz: string, k: { heute: string; jetzt: Date; leistungen: Leistungswahl[] }): ArtErkannt | null {
  if (!satz.trim()) return null;
  const sw = schluesselwort(satz);
  if (sw) return { art: sw.art, grund: `Wort „${sw.wort}“`, sicher: true };

  const t = zahlenEinsetzen(satz);
  const punkte: Record<Art, number> = { notiz: 0, termin: 0, rechnung: 0 };
  const gruende: Record<Art, string[]> = { notiz: [], termin: [], rechnung: [] };
  const plus = (a: Art, n: number, grund: string) => {
    punkte[a] += n;
    if (!gruende[a].includes(grund)) gruende[a].push(grund);
  };
  const hat = (quelle: string) => wort(quelle).test(t);

  if (/\d\s*(?:euro|€|eur)(?![\p{L}])/iu.test(t)) plus("rechnung", 3, "Preis");
  if (hat("brutto|netto|rabatt|nachlass|mwst|mehrwertsteuer")) plus("rechnung", 2, "brutto/netto/Rabatt");
  if (hat("abrechnen|berechnen|kostet|kosten|bezahlt|einkauf|ek")) plus("rechnung", 2, "abrechnen");
  if (hat("\\d+(?:,\\d+)?\\s*(?:arbeits)?(?:stunden?|std\\.?)\\s+(?:arbeit|lohn|mechanik|elektrik|diagnose)|arbeitszeit|arbeitsstunden?|\\d+\\s*(?:stück|stueck|stk|liter)")) {
    plus("rechnung", 2, "Arbeitszeit/Menge");
  }
  if (hat(AUFGABE)) plus("notiz", 4, "Aufgabe");
  if (hat("kommt|kommen|bringt|bringen|vorbei|vorbeikommen|buchen|einbuchen|einplanen|reservieren|dauert|abholen|holt")) plus("termin", 2, "kommt/bringt");

  // Spuren, die etwas aus dem Satz nehmen, auf einer Kopie
  const r = new Rest(t);
  if (spaeterNehmen(r, k.jetzt)) plus("notiz", 3, "in … Minuten/Stunden");
  if (wiederholungNehmen(r, k.heute)) plus("notiz", 3, "Wiederholung");
  const vergangen = wort("gestern|vorgestern|letzte[nrs]?\\s+woche").test(t);
  const datum = datumNehmen(r, k.heute);
  if (vergangen) plus("rechnung", 2, "Datum vorbei");
  else if (datum) plus("termin", 1, "Datum");
  if (uhrzeitNehmen(r)) plus("termin", 1, "Uhrzeit");
  if (eintraegeNehmen(r, k.leistungen).length) {
    plus("termin", 3, "Leistung");
    plus("rechnung", 1, "Leistung");
  }
  if (kennzeichenNehmen(r) || telefonNehmen(r)) plus("termin", 1, "Kennzeichen/Telefon");
  // Ein Termin ohne Tag und Uhrzeit ist eher eine erledigte Arbeit (Rechnung) oder eine Notiz
  if (!datum && !gruende.termin.includes("Uhrzeit")) punkte.termin -= 2;

  const reihenfolge: Art[] = ["notiz", "termin", "rechnung"];
  const beste = Math.max(...reihenfolge.map((a) => punkte[a]));
  if (beste <= 0) return { art: "notiz", grund: "kein Hinweis auf Termin oder Rechnung", sicher: false };
  const vorn = reihenfolge.filter((a) => punkte[a] === beste);
  const art = vorn[0];
  const zweite = Math.max(...reihenfolge.filter((a) => a !== art).map((a) => punkte[a]));
  return { art, grund: gruende[art].join(", "), sicher: vorn.length === 1 && beste - zweite >= 2 };
}

/** Eingang für alle drei: Trennzeichen aus dem Text, Zahlwörter als Ziffern. */
const vorbereiten = (satz: string, auchVerben = true) => {
  const rest = new Rest(zahlenEinsetzen(satz.replace(/[|]/g, " ").replace(/\s+/g, " ").trim()));
  aufforderungEntfernen(rest, auchVerben);
  return rest;
};

const NACHSATZ = "(?:\\s+(?:bitte|mal|schnell|kurz|noch|doch|eben|gleich))*";
const FUER_MICH = "(?:\\s+(?:mir|uns|mich))?";
const BEFEHL =
  "erstell|erstelle|mach|mache|schreib|schreibe|leg|lege|trag|trage|notier|notiere|buch|buche|stell|stelle|setz|setze|plan|plane|füg|füge|fueg|fuege|nimm|bereite";

/**
 * Die Aufforderung um den eigentlichen Inhalt herum: „Erstelle mir bitte …“, „Kannst du mir …“,
 * „Ich brauche …“, „… eintragen“. Ohne das landete sie als Rechnungsposition, Terminnotiz, Notiztitel oder
 * im Kundennamen („Müller Erstellen“). Abtrennbare Reste („Trag … ein“, „Leg … an“) fängt `saeubern` ab.
 * `auchVerben`: Infinitive wie „schreiben“ oder „buchen“ nur bei Termin und Rechnung entfernen; in einer
 * Notiz können sie Inhalt sein („Mail an den Lieferanten schreiben“).
 */
function aufforderungEntfernen(rest: Rest, auchVerben: boolean) {
  // „Kannst du mir bitte“, „Könnten Sie“
  rest.nimm(wort(`(?:kannst|könntest|koenntest|würdest|wuerdest|kann|könnte|koennte|könnten|koennten|würden|wuerden)\\s+(?:du|sie|man)${FUER_MICH}${NACHSATZ}`));
  // „Ich brauche“, „Wir hätten gern“
  rest.nimm(
    wort(
      `(?:ich|wir)\\s+(?:brauche|brauchen|bräuchte|braeuchte|bräuchten|braeuchten|hätte|haette|hätten|haetten|möchte|moechte|möchten|moechten|will|wollen|würde|wuerde|würden|wuerden)(?:\\s+gerne?)?${NACHSATZ}`,
    ),
  );
  // „Erstelle mir bitte“ am Satzanfang, auch nach einem schon entfernten Rahmen
  rest.nimm(new RegExp(`^[\\s|]*(?:bitte\\s+)?(?:${BEFEHL})(?![\\p{L}\\p{N}])${FUER_MICH}${NACHSATZ}`, "giu"));
  // „… erstellen“, „… eintragen“ (am Ende oder mittendrin)
  const verben = "erstellen|anlegen|eintragen|einbuchen|ausstellen|hinzufügen|hinzufuegen|erstellt|angelegt|eingetragen";
  while (rest.nimm(wort(auchVerben ? `${verben}|aufschreiben|notieren|schreiben|buchen` : verben)));
}

/** Artikel und „neu“ vor dem Schlüsselwort: „eine neue Rechnung“, „einen weiteren Termin“. */
const ARTIKEL = "(?:(?:eine[nrm]?|ein|die|den|der|das)\\s+)?(?:(?:neue[nrsm]?|weitere[nrsm]?)\\s+)?";

// ---------------------------------------------------------------------------------------------------------
// Notiz

export type Person = { id: string; name: string };

export type NotizVerstanden = {
  titel: string;
  text: string;
  datum: string | null;
  uhrzeit: string | null;
  wiederholung: Wiederholung;
  sichtbar: "privat" | "buero" | null;
  erinnernAn: Person | null;
};

/**
 * „Erinnere mich morgen um 9, Bremsbeläge für Müller bestellen“, „Notiz fürs Büro: Hebebühne 2 prüfen“,
 * „Erinnere Marco jeden Montag an die Altölabholung“.
 */
export function notizVerstehen(satz: string, k: { heute: string; jetzt: Date; team: Person[] }): NotizVerstanden {
  const rest = vorbereiten(satz, false);

  // „Erinnere Marco …“ / „Erinnerung für Marco“: an jemand anderen aus dem Team (vor dem Einleitungswort,
  // sonst wäre „Erinnerung“ schon weg)
  const erinnernAn: Person | null =
    rest.nimmErstes(wort("erinnere?\\s+(\\p{L}+)(?:\\s+daran)?"), (m) => teamFinden(m[1], k.team)) ??
    rest.nimmErstes(wort("erinnerung\\s+(?:für|fuer|an)\\s+(\\p{L}+)"), (m) => teamFinden(m[1], k.team)) ??
    rest.nimmErstes(wort("(?:sag|sage)\\s+(\\p{L}+)\\s+bescheid"), (m) => teamFinden(m[1], k.team));
  rest.nimm(wort(`${ARTIKEL}(?:notiz|erinnerung)(?:\\s+(?:an|machen|schreiben|aufschreiben))?\\s*:?`));
  rest.nimm(wort("(?:bitte\\s+)?(?:erinnere?|erinnern)\\s+(?:mich|uns)(?:\\s+daran)?|erinnerung|erinnern|merken|notieren"));

  const sichtbar = rest.nimm(wort("(?:(?:für|fuer|an|ans|ins|in)\\s+(?:das\\s+)?)?büro|fürs\\s+büro|buero"))
    ? "buero"
    : rest.nimm(wort("nur\\s+(?:für\\s+)?mich|privat"))
      ? "privat"
      : null;

  const wdh = wiederholungNehmen(rest, k.heute);
  const spaeter = spaeterNehmen(rest, k.jetzt);
  let datum = spaeter?.datum ?? datumNehmen(rest, k.heute) ?? wdh?.datum ?? null;
  const uhrzeit = spaeter?.uhrzeit ?? uhrzeitNehmen(rest);
  // Nur eine Uhrzeit: heute, und wenn die schon vorbei ist, morgen
  if (uhrzeit && !datum) datum = uhrzeit > berlinUhrzeit(k.jetzt) || wdh ? k.heute : plusTage(k.heute, 1);
  if (!datum && wdh) datum = k.heute;

  // Hinten nur Füllwörter wie „bitte“ abschneiden: „Kunde ruft an“ bleibt so
  const inhalt = grossAnfang(saeubern(rest.text.replace(/\s*\|\s*/g, " ").replace(/\s+,/g, ","), true));
  // Kurz: alles in den Titel. Lang: der erste Satz als Titel, alles in den Text.
  let titel = inhalt;
  let text = "";
  if (inhalt.length > 100) {
    const satzEnde = inhalt.slice(0, 100).search(/[.!?;:](\s|$)/);
    titel = satzEnde > 10 ? inhalt.slice(0, satzEnde) : `${inhalt.slice(0, 80).replace(/\s+\S*$/, "")} …`;
    text = inhalt;
  }
  return { titel, text, datum, uhrzeit, wiederholung: wdh?.wiederholung ?? "keine", sichtbar, erinnernAn };
}

// ---------------------------------------------------------------------------------------------------------
// Termin

/** Leistung aus der Preisliste, mit den weiteren Namen beim Sprechen. */
export type Leistungswahl = Eintrag & { id: string };

export type TerminVerstanden = {
  leistungen: Leistungswahl[];
  /** Was nach Arbeit klingt, aber in der Preisliste fehlt */
  leistungFrei: string;
  dauerMin: number | null;
  datum: string | null;
  uhrzeit: string | null;
  name: string;
  telefon: string;
  email: string;
  kennzeichen: string;
  fahrzeug: Fahrzeug | null;
  mitarbeiter: Person | null;
  notiz: string;
};

/** „Termin für Herrn Müller, Ölwechsel und Bremsen vorne, nächsten Dienstag halb neun, Kennzeichen OF AB 123, Telefon 0151 …“ */
export function terminVerstehen(satz: string, k: { heute: string; leistungen: Leistungswahl[]; team: Person[]; typen?: FahrzeugTypen | null }): TerminVerstanden {
  const rest = vorbereiten(satz);
  const wissen = fahrzeugWissen(k.typen);
  const keinName = (w: string[]) => istFachwort(w[0], k.leistungen);
  // „Termin Max Schulz …“: Name direkt nach dem Wort Termin, vor allem anderen
  const nameVorn = nameNehmen(rest, keinName, "termin\\s+(?:für|fuer)|termin", wissen);
  rest.nimm(wort(`${ARTIKEL}termin(?:\\s+(?:eintragen|anlegen|machen))?`));

  // „Notiz: …“ am Ende gilt bis zum Schluss
  const notizTeile: string[] = [];
  const notiz = rest.nimmErstes(wort("(?:notiz|bemerkung|hinweis|info)\\s*:?\\s+(.+)$"), (m) => saeubern(m[1]) || null);
  if (notiz) notizTeile.push(grossAnfang(notiz));

  const email = emailNehmen(rest) ?? "";
  const kennzeichenMitWort = kennzeichenNehmen(rest, false);
  const mitarbeiter = mitarbeiterNehmen(rest, k.team);
  const datum = datumNehmen(rest, k.heute);
  const uhrzeit = uhrzeitNehmen(rest);
  const dauerMin = dauerNehmen(rest);
  const telefon = telefonNehmen(rest) ?? "";
  const kennzeichen = kennzeichenMitWort ?? kennzeichenNehmen(rest) ?? "";
  const leistungen = eintraegeNehmen(rest, k.leistungen);
  const fahrzeug = fahrzeugNehmen(rest, undefined, wissen);
  const name = nameVorn ?? nameNehmen(rest, keinName, undefined, wissen) ?? nameAmAnfang(rest, keinName, wissen) ?? "";

  // Rest: ohne erkannte Leistung ist er die Leistung, sonst eine Notiz
  const uebrig = stuecke(rest.text).join(", ");
  let leistungFrei = "";
  if (uebrig) {
    if (!leistungen.length) leistungFrei = grossAnfang(uebrig).slice(0, 120);
    else notizTeile.unshift(grossAnfang(uebrig));
  }
  return { leistungen, leistungFrei, dauerMin, datum, uhrzeit, name, telefon, email, kennzeichen, fahrzeug, mitarbeiter, notiz: notizTeile.join("\n") };
}

/** „dauert zwei Stunden“, „90 Minuten“ */
function dauerNehmen(rest: Rest): number | null {
  return (
    rest.nimmErstes(wort("(?:dauer|dauert|ungefähr|ungefaehr|etwa|circa|ca\\.?)?\\s*(?:eine\\s+)?halbe\\s+stunde"), () => 30) ??
    rest.nimmErstes(wort("(?:dauer|dauert|ungefähr|ungefaehr|etwa|circa|ca\\.?)?\\s*(\\d+(?:,\\d+)?|eine)\\s*(stunden?|std\\.?|minuten|min\\.?)"), (m) => {
      const n = m[1].toLowerCase() === "eine" ? 1 : (dezimal(m[1]) ?? 0);
      const min = Math.round(/^st/i.test(m[2]) ? n * 60 : n);
      return min >= 5 && min <= 24 * 60 ? min : null;
    })
  );
}

// ---------------------------------------------------------------------------------------------------------
// Rechnung

export type PositionsWunsch = {
  text: string;
  menge: number | null;
  einheit: string | null;
  /** Gesprochener Preis in Cent, netto oder brutto je nach `brutto` */
  preisCent: number | null;
  brutto: boolean;
  /** Preis gilt für alle zusammen („4 Zündkerzen zusammen 48 Euro“) */
  gesamt: boolean;
  ekCent: number | null;
  /** Arbeitszeit: Menge in Stunden, Preis aus dem Stundensatz */
  stunden: boolean;
  lohnart: string | null;
  rabatt: Rabatt | null;
};

export type RechnungVerstanden = {
  name: string;
  telefon: string;
  email: string;
  kennzeichen: string;
  fahrzeug: Fahrzeug | null;
  leistungsdatum: string | null;
  positionen: PositionsWunsch[];
};

/**
 * „Rechnung für Müller, Golf, Ölwechsel, zwei Stunden Arbeit, Bremsscheiben vorne 180 Euro brutto,
 * 10 Prozent Rabatt“. Preise ohne Angabe sind netto (wie im Editor).
 */
export function rechnungVerstehen(
  satz: string,
  k: { heute: string; preisliste: Eintrag[]; lohnarten: string[]; typen?: FahrzeugTypen | null },
): RechnungVerstanden {
  const rest = vorbereiten(satz);
  const wissen = fahrzeugWissen(k.typen);
  const keinName = (w: string[]) => istFachwort(w[0], k.preisliste);
  const nameVorn = nameNehmen(rest, keinName, "rechnung\\s+(?:für|fuer|an)|rechnung", wissen);
  rest.nimm(wort(`${ARTIKEL}rechnung(?:\\s+(?:schreiben|erstellen|anlegen|machen))?`));
  const alleBrutto = rest.nimm(
    wort("(?:alle|alles|die)\\s+(?:preise\\s+)?(?:sind\\s+)?brutto|preise\\s+(?:sind\\s+)?brutto|alles\\s+(?:inklusive|inkl\\.?|mit)\\s+(?:mehrwertsteuer|mwst)"),
  );
  rest.nimm(wort("(?:alle|alles|die)\\s+(?:preise\\s+)?(?:sind\\s+)?netto|preise\\s+(?:sind\\s+)?netto"));

  const email = emailNehmen(rest) ?? "";
  const telefon = telefonNehmen(rest, false) ?? "";
  const kennzeichen = kennzeichenNehmen(rest) ?? "";
  const leistungsdatum = rest.nimmErstes(wort("(?:leistungsdatum|datum)\\s*:?"), () => true) ? datumNehmen(rest, k.heute, "vergangenheit") : datumAmRand(rest, k.heute);
  // Das Fahrzeug steht oft mitten in einer Position („Bremsen für den Golf 180 Euro“): ohne Trenner herausnehmen
  const fahrzeug = fahrzeugNehmen(rest, " ", wissen);
  const name = nameVorn ?? nameNehmen(rest, keinName, "für|fuer|kunde|kundin|an", wissen) ?? nameAmAnfang(rest, keinName, wissen) ?? "";

  const positionen: PositionsWunsch[] = [];
  for (const stueck of segmente(rest.text, k.preisliste)) {
    const p = positionAus(stueck, k.lohnarten, alleBrutto);
    if (!p) continue;
    const vorige = positionen[positionen.length - 1];
    // Nur ein Preis („…, 180 Euro“): gehört zur Position davor, wenn die noch keinen hat
    if (!p.text && !p.stunden && !p.rabatt) {
      if (vorige && vorige.preisCent === null && !vorige.rabatt && p.preisCent !== null) {
        vorige.preisCent = p.preisCent;
        vorige.brutto = p.brutto;
        vorige.gesamt = p.gesamt;
        if (p.menge !== null && vorige.menge === null) vorige.menge = p.menge;
      } else if (vorige && vorige.menge === null && p.menge !== null && p.preisCent === null) {
        vorige.menge = p.menge;
        vorige.einheit = p.einheit;
      } else if (p.preisCent !== null) {
        positionen.push({ ...p, text: "Position" });
      }
      continue;
    }
    positionen.push(p);
  }
  return { name, telefon, email, kennzeichen, fahrzeug, leistungsdatum, positionen };
}

/** Ein Datum für die Rechnung nur am Anfang oder Ende des Satzes („…, Leistung vom 12.11.“), nicht mitten in einer Position. */
function datumAmRand(rest: Rest, heute: string): string | null {
  return rest.nimmErstes(wort("(?:vom|am|leistung\\s+vom|gemacht\\s+am)\\s+(gestern|vorgestern|heute|\\d{1,2}\\.\\s?\\d{1,2}\\.(?:\\s?\\d{2,4})?)"), (m) => {
    const r = new Rest(m[1]);
    return datumNehmen(r, heute, "vergangenheit");
  });
}

const HARTER_TRENNER = /[|;\n]|[,.](?!\d)|(?<!\d)[,.]|(?<![\p{L}])(?:plus|sowie|außerdem|ausserdem|zusätzlich|zusaetzlich|dazu)(?![\p{L}])/giu;
const HAT_ZAHL = /\d|euro|€|stunde|std/i;

/**
 * Positionen trennen. Komma, Punkt, „plus“ trennen immer. „und“ nur, wenn links schon etwas Ganzes steht
 * (ein Preis, eine Menge, ein Eintrag der Preisliste) oder rechts eine Zahl beginnt: „Bremsscheiben und
 * Beläge vorne 180 Euro“ bleibt eine Position, „Ölwechsel und Luftfilter“ werden zwei.
 */
function segmente(text: string, preisliste: Eintrag[]): string[] {
  const aus: string[] = [];
  for (const teil of text.split(HARTER_TRENNER)) {
    let t = teil.trim();
    if (!t) continue;
    for (;;) {
      const und = /\s+und\s+/i.exec(t);
      if (!und) break;
      const links = t.slice(0, und.index);
      const rechts = t.slice(und.index + und[0].length);
      const ganz = HAT_ZAHL.test(links) || /^\d/.test(rechts) || Boolean(besterEintrag(saeubern(links), preisliste, SCHWELLE_SPRACHE));
      if (!ganz) break;
      aus.push(links);
      t = rechts;
    }
    aus.push(t);
  }
  return aus.map((s) => s.trim()).filter(Boolean);
}

const EINHEIT: Record<string, string> = { x: "Stk", mal: "Stk", stueck: "Stk", stk: "Stk", liter: "l", ltr: "l", l: "l", satz: "Satz", saetze: "Satz", paar: "Paar", meter: "m", m: "m" };
const EINHEITEN = "x|mal|stück|stueck|stk\\.?|liter|ltr\\.?|l|satz|sätze|saetze|paar|meter|m";
const BETRAG = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)";
const NACH_EURO = "(?:\\s+(\\d{1,2})(?!\\d|[,.]\\d)(?!\\s*(?:stück|stueck|stk|liter|l|stunden?|std|x|mal|%|prozent)(?![\\p{L}])))?";

function positionAus(stueck: string, lohnarten: string[], alleBrutto: boolean): PositionsWunsch | null {
  const r = new Rest(stueck);
  const leer: PositionsWunsch = { text: "", menge: null, einheit: null, preisCent: null, brutto: alleBrutto, gesamt: false, ekCent: null, stunden: false, lohnart: null, rabatt: null };

  if (r.nimm(wort("brutto|inklusive\\s+(?:mehrwertsteuer|mwst)|inkl\\.?\\s+(?:mehrwertsteuer|mwst)|mit\\s+(?:mehrwertsteuer|mwst)"), " ")) leer.brutto = true;
  else if (r.nimm(wort("netto|zuzüglich|zzgl\\.?|ohne\\s+(?:mehrwertsteuer|mwst)|plus\\s+(?:mehrwertsteuer|mwst)"), " ")) leer.brutto = false;

  // Rabatt: „10 Prozent Rabatt“, „Rabatt 20 Euro“
  const rabatt =
    r.nimmErstes(wort(`(\\d+(?:,\\d+)?)\\s*(?:%|prozent)\\s+(?:rabatt|nachlass)`), (m) => ({ prozent: dezimal(m[1]) ?? 0 })) ??
    r.nimmErstes(wort(`(?:rabatt|nachlass)\\s+(?:von\\s+)?${BETRAG}\\s*(%|prozent|euro|€)`), (m) =>
      /%|prozent/i.test(m[2]) ? { prozent: dezimal(m[1]) ?? 0 } : { betrag_cent: centAusText(m[1]) ?? 0 },
    ) ??
    r.nimmErstes(wort(`${BETRAG}\\s*(?:euro|€)\\s+(?:rabatt|nachlass)`), (m) => ({ betrag_cent: centAusText(m[1]) ?? 0 }));
  if (rabatt) return { ...leer, text: "Rabatt", rabatt };

  if (r.nimm(wort("zusammen|insgesamt|gesamt|in\\s+summe"), " ")) leer.gesamt = true;
  r.nimm(wort("je|pro\\s+(?:stück|stueck|liter|satz)|das\\s+stück|einzeln|stückpreis|stueckpreis"), " ");

  leer.ekCent = r.nimmErstes(wort(`(?:einkauf(?:spreis)?|ek)\\s*(?:von|für|fuer|zu)?\\s*${BETRAG}\\s*(?:euro|€)?${NACH_EURO}`), (m) => centAusText(m[1], m[2]), " ");

  leer.preisCent =
    r.nimmErstes(new RegExp(`(?<![\\d.,])${BETRAG}\\s*(?:euro|€|eur)(?![\\p{L}])${NACH_EURO}`, "giu"), (m) => centAusText(m[1], m[2]), " ") ??
    r.nimmErstes(wort(`(?:für|fuer|zu|à|a|preis)\\s+${BETRAG}(?!\\d|[,.]\\d)(?!\\s*(?:stück|stueck|stk|liter|l|stunden?|std|x|mal|%|prozent|minuten?)(?![\\p{L}]))`), (m) => centAusText(m[1]), " ") ??
    r.nimmErstes(new RegExp(`(?<![\\d.,])(\\d+,\\d{2})(?![\\d])`, "gu"), (m) => centAusText(m[1]), " ");

  // Arbeitszeit
  const stunden =
    r.nimmErstes(wort("(?:eine\\s+)?halbe\\s+(?:arbeits)?stunde"), () => 0.5, " ") ??
    r.nimmErstes(wort("(?:eine\\s+)?viertelstunde"), () => 0.25, " ") ??
    r.nimmErstes(wort("(?:eine\\s+)?drei\\s?viertel\\s?stunde"), () => 0.75, " ") ??
    r.nimmErstes(wort("(\\d+(?:,\\d+)?|eine|einer|1)\\s*(?:arbeits)?(?:stunden?|std\\.?)"), (m) => (/\d/.test(m[1]) ? dezimal(m[1]) : 1), " ") ??
    r.nimmErstes(wort("(\\d+)\\s*(?:minuten|min\\.?)"), (m) => Math.round((Number(m[1]) / 60) * 100) / 100, " ");
  if (stunden !== null) {
    leer.stunden = true;
    leer.menge = stunden;
    leer.einheit = "Std";
    leer.lohnart = lohnartFinden(r.text, lohnarten);
  } else {
    // Menge: „4 Stück“, „5 Liter“, „2x“, oder eine Zahl vorn („4 Zündkerzen“)
    const menge =
      r.nimmErstes(wort(`(\\d+(?:,\\d+)?)\\s*(${EINHEITEN})`), (m) => ({ n: dezimal(m[1]), e: EINHEIT[klein(m[2])] ?? null }), " ") ??
      r.nimmErstes(/^\s*(\d+(?:,\d+)?)(?=\s+\p{L})/gu, (m) => ({ n: dezimal(m[1]), e: null }), " ");
    if (menge?.n) {
      leer.menge = menge.n;
      leer.einheit = menge.e;
    }
  }

  const text = saeubern(r.text.replace(/\s+(?:à|a|je|pro)\s+/gi, " ").replace(/^\s*(?:à|a|je|pro)\s+/i, ""));
  leer.text = text ? grossAnfang(text) : "";
  if (!leer.text && !leer.stunden && leer.preisCent === null && leer.menge === null) return null;
  return leer;
}

/** Lohnart aus den Einstellungen, deren Name im Stück vorkommt („Diagnose“ → „Elektrik/Diagnose“). */
function lohnartFinden(text: string, lohnarten: string[]): string | null {
  const woerterImText = text.split(/[^\p{L}]+/u).map(klein).filter((w) => w.length >= 4);
  for (const l of lohnarten) {
    const teile = l.split(/[^\p{L}]+/u).map(klein).filter((w) => w.length >= 4);
    if (teile.some((t) => woerterImText.some((w) => w.startsWith(t.slice(0, 5)) || t.startsWith(w.slice(0, 5))))) return l;
  }
  return null;
}
