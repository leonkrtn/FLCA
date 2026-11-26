import type { Fenster } from "./einstellungen";
import { arbeitsende, type Belegung, belegungMax, type Slot } from "./slots";
import { berlin, berlinDatum, berlinUhrzeit, minuten, plusTage, uhrzeit, wochentag } from "./zeit";

/**
 * Mitarbeiterplanung ohne Datenbank: Wann arbeitet wer, wer darf was, wer ist frei. Läuft auf dem Server
 * (Website, Verwaltung) und ist deshalb ohne Abhängigkeiten testbar. Die Datenbank prüft beim Speichern nur
 * noch, dass die gewählte Person nicht doppelt belegt ist (person_belegt), der Rest steht hier.
 */

export type Woche = "jede" | "gerade" | "ungerade";

export type PlanAbwesenheit = {
  art: "urlaub" | "krank" | "sonstiges";
  von: string;
  bis: string;
  /** Nur bei einem einzelnen Tag: abwesend von … bis (sonst ganztägig) */
  von_zeit: string | null;
  bis_zeit: string | null;
};

export type PlanPerson = {
  id: string;
  name: string;
  /** Feste Farbe im Kalender (siehe farbeVon); -1 = wird nicht eingeplant */
  farbe: number;
  /** Wird eingeplant (Website, automatische Zuteilung); entscheidet die Werkstatt, nie die Person */
  nimmtAuftraege?: boolean;
  /** Kein eigener Wochenplan eingetragen: Der Wochenplan sind dann die Öffnungszeiten */
  planAusOeffnung?: boolean;
  wochenplan: { wochentag: number; beginn: string; ende: string; woche: Woche }[];
  /** Abweichende Zeiten an einzelnen Tagen; [] = frei */
  ausnahmen: Record<string, Fenster[]>;
  /** Nur genehmigte Abwesenheiten */
  abwesenheiten: PlanAbwesenheit[];
  /** Leistungen, die die Person nicht machen darf */
  gesperrt: string[];
};

/** Belegung mit Person (null = noch niemandem zugeteilt). */
export type PersonBelegung = Belegung & { profil: string | null; id?: string };

/** Farbe einer Person im Kalender: Token --color-person-1 … 8 aus globals.css; -1 (keine Farbe) = Linie. */
export const farbeVon = (i: number) => (i < 0 ? "var(--color-linie)" : `var(--color-person-${(i % 8) + 1})`);

const ABW_TEXT: Record<PlanAbwesenheit["art"], string> = { urlaub: "Urlaub", krank: "krank", sonstiges: "frei" };
export const abwesenheitText = (a: Pick<PlanAbwesenheit, "art">) => ABW_TEXT[a.art];

/** ISO-Kalenderwoche eines Datums „YYYY-MM-DD“. */
export function kalenderwoche(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`);
  // Donnerstag derselben Woche bestimmt das Jahr der Kalenderwoche
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jahresbeginn = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jahresbeginn) / 86400000 + 1) / 7);
}

export const istGeradeWoche = (datum: string) => kalenderwoche(datum) % 2 === 0;

function sortiert(f: Fenster[]): Fenster[] {
  return [...f].filter(([a, b]) => minuten(b) > minuten(a)).sort((x, y) => minuten(x[0]) - minuten(y[0]));
}

/** Schnittmenge zweier Listen von Zeitfenstern (z. B. Öffnungszeiten und Arbeitszeit). */
export function schnitt(a: Fenster[], b: Fenster[]): Fenster[] {
  const ergebnis: Fenster[] = [];
  for (const [a1, a2] of sortiert(a)) {
    for (const [b1, b2] of sortiert(b)) {
      const von = Math.max(minuten(a1), minuten(b1));
      const bis = Math.min(minuten(a2), minuten(b2));
      if (bis > von) ergebnis.push([uhrzeit(von), uhrzeit(bis)]);
    }
  }
  return sortiert(ergebnis);
}

/** Zeitfenster ohne den Bereich [von, bis). */
export function abziehen(f: Fenster[], von: string, bis: string): Fenster[] {
  const v = minuten(von);
  const b = minuten(bis);
  return sortiert(
    f.flatMap(([x, y]): Fenster[] => {
      const a1 = minuten(x);
      const a2 = minuten(y);
      if (b <= a1 || v >= a2) return [[x, y]];
      const teile: Fenster[] = [];
      if (v > a1) teile.push([x, uhrzeit(v)]);
      if (b < a2) teile.push([uhrzeit(b), y]);
      return teile;
    }),
  );
}

/** Wochenplan eines Tages ohne Ausnahmen und Abwesenheiten (gerade/ungerade Kalenderwoche beachtet). */
export function planFenster(p: Pick<PlanPerson, "wochenplan">, datum: string): Fenster[] {
  const tag = wochentag(datum);
  const woche: Woche = istGeradeWoche(datum) ? "gerade" : "ungerade";
  return sortiert(p.wochenplan.filter((z) => z.wochentag === tag && (z.woche === "jede" || z.woche === woche)).map((z) => [z.beginn.slice(0, 5), z.ende.slice(0, 5)]));
}

/** Abwesenheit an diesem Tag (die erste, falls mehrere). */
export function abwesenheitAm(p: Pick<PlanPerson, "abwesenheiten">, datum: string): PlanAbwesenheit | null {
  return p.abwesenheiten.find((a) => a.von <= datum && a.bis >= datum) ?? null;
}

/** Wann arbeitet die Person an diesem Tag wirklich: Ausnahme oder Wochenplan, ohne Abwesenheiten. */
export function arbeitsfenster(p: PlanPerson, datum: string): Fenster[] {
  let f = datum in p.ausnahmen ? sortiert(p.ausnahmen[datum]) : planFenster(p, datum);
  for (const a of p.abwesenheiten) {
    if (a.von > datum || a.bis < datum) continue;
    if (!a.von_zeit || !a.bis_zeit) return [];
    f = abziehen(f, a.von_zeit.slice(0, 5), a.bis_zeit.slice(0, 5));
  }
  return f;
}

/** Darf die Person alle diese Leistungen machen? */
export const kann = (p: Pick<PlanPerson, "gesperrt">, leistungIds: string[]) => leistungIds.every((id) => !p.gesperrt.includes(id));

const ueberlappt = (b: Belegung, beginn: number, bis: number) => b.beginn < bis && b.bis > beginn;

/** Verplante Minuten einer Person an einem Tag (für die gleichmäßige Verteilung). */
export function tagesMinuten(profil: string, datum: string, belegungen: PersonBelegung[]): number {
  const von = berlin(datum).getTime();
  const bis = berlin(plusTage(datum, 1)).getTime();
  return belegungen.filter((b) => b.profil === profil && b.beginn >= von && b.beginn < bis).reduce((s, b) => s + (b.bis - b.beginn) / 60000, 0);
}

export type PersonSlot = Slot & {
  /** Wer zu dieser Startzeit frei ist, die am wenigsten Ausgelasteten zuerst (mit eigenem Ende je Person) */
  kandidaten: { profil: string; ende: Date; bis: Date }[];
};

export type PlanParameter = {
  datum: string;
  /** Öffnungszeiten des Tages */
  oeffnung: Fenster[];
  personen: PlanPerson[];
  leistungIds: string[];
  dauerMin: number;
  pufferMin: number;
  rasterMin: number;
  kapazitaet: number;
  fruehestens: Date;
  belegungen: PersonBelegung[];
};

/**
 * Freie Startzeiten mit Mitarbeitern. Eine Startzeit ist frei, wenn ein Arbeitsplatz frei ist und mindestens
 * eine Person, die alle Leistungen darf, die Arbeit innerhalb ihrer Arbeitszeit UND der Öffnungszeit schafft
 * (Pausen überspringen, am selben Tag fertig) und zu der Zeit keinen anderen Termin hat. Termine ohne Person
 * brauchen auch jemanden: Es müssen mehr Personen frei sein, als solche Termine gleichzeitig laufen.
 */
export function freieSlotsMitPersonen(p: PlanParameter): PersonSlot[] {
  const geeignet = p.personen
    .filter((x) => kann(x, p.leistungIds))
    .map((x) => ({ person: x, fenster: schnitt(p.oeffnung, arbeitsfenster(x, p.datum)), last: tagesMinuten(x.id, p.datum, p.belegungen) }))
    .filter((x) => x.fenster.length)
    .sort((a, b) => a.last - b.last || a.person.name.localeCompare(b.person.name, "de"));
  if (!geeignet.length) return [];

  const slots: PersonSlot[] = [];
  for (const [von, bis] of p.oeffnung) {
    for (let start = minuten(von); start < minuten(bis); start += p.rasterMin) {
      const beginn = berlin(p.datum, uhrzeit(start));
      if (beginn < p.fruehestens) continue;
      const kandidaten: PersonSlot["kandidaten"] = [];
      for (const g of geeignet) {
        const endeMin = arbeitsende(g.fenster, start, p.dauerMin);
        if (endeMin === null) continue;
        const ende = berlin(p.datum, uhrzeit(endeMin));
        const bisZeit = new Date(ende.getTime() + p.pufferMin * 60000);
        if (p.belegungen.some((b) => b.profil === g.person.id && ueberlappt(b, beginn.getTime(), bisZeit.getTime()))) continue;
        if (belegungMax(beginn.getTime(), bisZeit.getTime(), p.belegungen) >= p.kapazitaet) continue;
        kandidaten.push({ profil: g.person.id, ende, bis: bisZeit });
      }
      if (!kandidaten.length) continue;
      const erster = kandidaten[0];
      const ohnePerson = p.belegungen.filter((b) => b.profil === null && ueberlappt(b, beginn.getTime(), erster.bis.getTime())).length;
      if (kandidaten.length <= ohnePerson) continue;
      slots.push({ beginn, ende: erster.ende, bis: erster.bis, kandidaten });
    }
  }
  return slots;
}

/** Was spricht dagegen, dass diese Person den Termin macht? Leere Liste = passt. Für Warnungen in der Verwaltung. */
export function konflikte(
  person: PlanPerson,
  t: { beginn: Date; ende: Date; bis: Date; leistungIds: string[]; id?: string },
  belegungen: (PersonBelegung & { titel?: string })[],
  leistungNamen: Record<string, string> = {},
): string[] {
  const name = person.name || "Die Person";
  const datum = berlinDatum(t.beginn);
  const gruende: string[] = [];
  const abw = person.abwesenheiten.find((a) => a.von <= datum && a.bis >= datum && (!a.von_zeit || !a.bis_zeit || (minuten(berlinUhrzeit(t.beginn)) < minuten(a.bis_zeit) && minuten(berlinUhrzeit(t.ende)) > minuten(a.von_zeit))));
  if (abw) gruende.push(`${name} ist ${abwesenheitText(abw) === "krank" ? "krank gemeldet" : `abwesend (${abwesenheitText(abw)})`}${abw.von_zeit ? ` von ${abw.von_zeit.slice(0, 5)} bis ${abw.bis_zeit?.slice(0, 5)} Uhr` : ""}.`);
  else {
    const f = arbeitsfenster(person, datum);
    const start = minuten(berlinUhrzeit(t.beginn));
    const endeDatum = berlinDatum(new Date(t.ende.getTime() - 1));
    const ende = endeDatum === datum ? minuten(berlinUhrzeit(t.ende)) || 24 * 60 : 24 * 60;
    if (!f.length) gruende.push(`${name} arbeitet an diesem Tag nicht.`);
    else if (!f.some(([a, b]) => start >= minuten(a) && start < minuten(b))) gruende.push(`${name} arbeitet um ${uhrzeit(start)} Uhr nicht (${f.map(([a, b]) => `${a}–${b}`).join(", ")}).`);
    else if (ende > minuten(f[f.length - 1][1])) gruende.push(`${name} hat um ${f[f.length - 1][1]} Uhr Feierabend, der Termin geht bis ${uhrzeit(ende % (24 * 60))} Uhr.`);
  }
  const nicht = t.leistungIds.filter((id) => person.gesperrt.includes(id));
  if (nicht.length) gruende.push(`${name} macht ${nicht.map((id) => leistungNamen[id] ?? "eine der Leistungen").join(", ")} nicht.`);
  const doppelt = belegungen.find((b) => b.profil === person.id && b.id !== t.id && ueberlappt(b, t.beginn.getTime(), t.bis.getTime()));
  if (doppelt) gruende.push(`${name} hat um ${berlinUhrzeit(new Date(doppelt.beginn))} Uhr schon einen Termin${doppelt.titel ? ` (${doppelt.titel})` : ""}.`);
  return gruende;
}

/** Wer passt am besten: keine Konflikte, am wenigsten ausgelastet. null = niemand. */
export function besteFreiePerson(
  personen: PlanPerson[],
  t: { beginn: Date; ende: Date; bis: Date; leistungIds: string[]; id?: string },
  belegungen: PersonBelegung[],
  ausser: string[] = [],
): PlanPerson | null {
  const datum = berlinDatum(t.beginn);
  const frei = personen.filter((p) => !ausser.includes(p.id) && !konflikte(p, t, belegungen).length);
  frei.sort((a, b) => tagesMinuten(a.id, datum, belegungen) - tagesMinuten(b.id, datum, belegungen) || a.name.localeCompare(b.name, "de"));
  return frei[0] ?? null;
}

/** Verfügbare Arbeitsminuten an einem Tag (für die Auslastung). */
export function verfuegbareMinuten(p: PlanPerson, datum: string): number {
  return arbeitsfenster(p, datum).reduce((s, [a, b]) => s + minuten(b) - minuten(a), 0);
}

export type UmzuplanenderTermin = { id: string; beginn: Date; ende: Date; bis: Date; leistungIds: string[] };
export type Umverteilung = { id: string; vorschlag: string | null; moeglich: string[] };

/**
 * Vorschau, wer die Termine einer ausfallenden Person übernimmt: dieselbe Wahl wie beim Genehmigen
 * (nachAbwesenheitUmverteilen), also der Reihe nach, und jede Zuteilung belegt die Person für die folgenden.
 * `moeglich`: wer den Termin für sich genommen machen könnte, ohne die anderen Vorschläge; das ist die Auswahl
 * zum Anpassen, denn wer einen früheren Vorschlag ändert, macht damit vielleicht jemanden frei.
 */
export function umverteilungVorschlagen(termine: UmzuplanenderTermin[], personen: PlanPerson[], belegungen: PersonBelegung[], profil: string): Umverteilung[] {
  const belegt = belegungen.map((b) => ({ ...b }));
  return [...termine]
    .sort((a, b) => a.beginn.getTime() - b.beginn.getTime())
    .map((t) => {
      const moeglich = personen.filter((p) => p.id !== profil && !konflikte(p, t, belegungen).length).map((p) => p.id);
      const vorschlag = besteFreiePerson(personen, t, belegt, [profil])?.id ?? null;
      const eigene = belegt.find((b) => b.id === t.id);
      if (eigene) eigene.profil = vorschlag;
      else belegt.push({ beginn: t.beginn.getTime(), bis: t.bis.getTime(), gewicht: 1, profil: vorschlag, id: t.id });
      return { id: t.id, vorschlag, moeglich };
    });
}

export type TagesLage = { verplant: number; verfuegbar: number; da: number; stufe: "ok" | "knapp" | "zu_viel" };

/**
 * Reicht die Zeit der Übrigen an einem Tag, wenn `ohne` fehlen? Verplant zählt jeder Termin, der an dem Tag
 * beginnt (auch die der Fehlenden, denn die muss jemand anderes machen), verfügbar die Arbeitszeit der übrigen
 * Planbaren nach Abzug genehmigter Abwesenheiten. Knapp ab 85 % wie die Auslastung im Wochenplan.
 */
export function tagesLage(datum: string, personen: PlanPerson[], termine: { beginn: Date; ende: Date }[], ohne: string[]): TagesLage {
  const uebrig = personen.filter((p) => !ohne.includes(p.id));
  const verfuegbar = uebrig.reduce((s, p) => s + verfuegbareMinuten(p, datum), 0);
  const da = uebrig.filter((p) => verfuegbareMinuten(p, datum) > 0).length;
  const verplant = termine.filter((t) => berlinDatum(t.beginn) === datum).reduce((s, t) => s + (t.ende.getTime() - t.beginn.getTime()) / 60000, 0);
  const stufe = verplant > verfuegbar ? "zu_viel" : verplant > verfuegbar * 0.85 ? "knapp" : "ok";
  return { verplant, verfuegbar, da, stufe };
}

/**
 * Urlaubstage in einem Zeitraum: gezählt werden nur Tage, an denen die Person laut Plan arbeiten würde. Ein
 * halber Tag (Abwesenheit mit Uhrzeit) zählt 0,5. Ohne Wochenplan gelten Montag bis Freitag.
 */
export function urlaubstage(p: Pick<PlanPerson, "wochenplan" | "ausnahmen" | "planAusOeffnung">, a: Pick<PlanAbwesenheit, "von" | "bis" | "von_zeit">, jahr?: string): number {
  if (a.von_zeit) return !jahr || a.von.startsWith(jahr) ? 0.5 : 0;
  let tage = 0;
  for (let d = a.von; d <= a.bis; d = plusTage(d, 1)) {
    if (jahr && !d.startsWith(jahr)) continue;
    const arbeitet = d in p.ausnahmen ? p.ausnahmen[d].length > 0 : p.wochenplan.length && !p.planAusOeffnung ? planFenster(p, d).length > 0 : wochentag(d) <= 5;
    if (arbeitet) tage++;
  }
  return tage;
}

/**
 * Soll-Arbeitszeit in Minuten für die Tage [von, bis]: Wochenplan mit Ausnahmen, genehmigte Abwesenheiten
 * (Urlaub, krank, auch halbe Tage) zählen als erfüllt und fallen heraus. null, wenn die Person keinen eigenen
 * Wochenplan hat: Die Öffnungszeiten sind kein Soll (sie enthalten keine Pausen und keine Teilzeit).
 */
export function sollMinuten(p: PlanPerson, von: string, bis: string): number | null {
  if (p.planAusOeffnung) return null;
  let summe = 0;
  for (let d = von; d <= bis; d = plusTage(d, 1)) summe += verfuegbareMinuten(p, d);
  return summe;
}

/**
 * Darf eine Person eine neu angelegte Leistung? Sie gilt wie die Kategorie: Wer die meisten Leistungen der
 * Kategorie darf, darf auch die neue. In einer neuen (leeren) Kategorie darf jeder. Rückgabe true = sperren.
 */
export function neueLeistungGesperrt(kategorie: string[], gesperrt: string[]): boolean {
  if (!kategorie.length) return false;
  const nicht = kategorie.filter((id) => gesperrt.includes(id)).length;
  return nicht * 2 > kategorie.length;
}
