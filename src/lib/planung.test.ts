import { describe, expect, it } from "vitest";
import type { Fenster } from "./einstellungen";
import {
  abziehen,
  arbeitsfenster,
  besteFreiePerson,
  freieSlotsMitPersonen,
  kalenderwoche,
  konflikte,
  type PersonBelegung,
  type PlanPerson,
  schnitt,
  urlaubstage,
} from "./planung";
import { berlin, berlinUhrzeit } from "./zeit";

const werktag: Fenster[] = [["08:30", "13:00"], ["14:00", "18:00"]];
// 2026-12-01 ist ein Dienstag in KW 49 (ungerade)
const TAG = "2026-12-01";

function person(id: string, teil: Partial<PlanPerson> = {}): PlanPerson {
  return {
    id,
    name: id,
    farbe: 0,
    nimmtAuftraege: true,
    wochenplan: [1, 2, 3, 4, 5].flatMap((t) => [
      { wochentag: t, beginn: "08:00", ende: "12:00", woche: "jede" as const },
      { wochentag: t, beginn: "13:00", ende: "17:00", woche: "jede" as const },
    ]),
    ausnahmen: {},
    abwesenheiten: [],
    gesperrt: [],
    ...teil,
  };
}

const basis = {
  datum: TAG,
  oeffnung: werktag,
  leistungIds: ["oel"],
  dauerMin: 60,
  pufferMin: 0,
  rasterMin: 30,
  kapazitaet: 2,
  fruehestens: new Date(0),
  belegungen: [] as PersonBelegung[],
};
const belegt = (profil: string | null, von: string, bis: string): PersonBelegung => ({ beginn: berlin(TAG, von).getTime(), bis: berlin(TAG, bis).getTime(), gewicht: 1, profil });

describe("Zeitfenster", () => {
  it("Schnitt von Öffnung und Arbeitszeit", () => expect(schnitt(werktag, [["08:00", "12:00"], ["13:00", "17:00"]])).toEqual([["08:30", "12:00"], ["14:00", "17:00"]]));
  it("Abziehen eines halben Tages", () => expect(abziehen([["08:00", "17:00"]], "12:00", "13:30")).toEqual([["08:00", "12:00"], ["13:30", "17:00"]]));
  it("Kalenderwoche nach ISO", () => {
    expect(kalenderwoche("2026-01-01")).toBe(1);
    expect(kalenderwoche("2027-01-01")).toBe(53);
    expect(kalenderwoche(TAG)).toBe(49);
  });
});

describe("arbeitsfenster", () => {
  it("Wochenplan", () => expect(arbeitsfenster(person("a"), TAG)).toEqual([["08:00", "12:00"], ["13:00", "17:00"]]));
  it("Ausnahme ersetzt den Plan, leer = frei", () => {
    expect(arbeitsfenster(person("a", { ausnahmen: { [TAG]: [["10:00", "14:00"]] } }), TAG)).toEqual([["10:00", "14:00"]]);
    expect(arbeitsfenster(person("a", { ausnahmen: { [TAG]: [] } }), TAG)).toEqual([]);
  });
  it("ganztägige und halbe Abwesenheit", () => {
    expect(arbeitsfenster(person("a", { abwesenheiten: [{ art: "urlaub", von: "2026-11-30", bis: "2026-12-04", von_zeit: null, bis_zeit: null }] }), TAG)).toEqual([]);
    expect(arbeitsfenster(person("a", { abwesenheiten: [{ art: "sonstiges", von: TAG, bis: TAG, von_zeit: "07:00:00", bis_zeit: "12:00:00" }] }), TAG)).toEqual([["13:00", "17:00"]]);
  });
  it("wechselnde Wochen: Samstag nur in geraden Kalenderwochen", () => {
    const p = person("a", { wochenplan: [{ wochentag: 6, beginn: "09:00", ende: "13:00", woche: "gerade" }] });
    expect(arbeitsfenster(p, "2026-12-05")).toEqual([]); // KW 49
    expect(arbeitsfenster(p, "2026-12-12")).toEqual([["09:00", "13:00"]]); // KW 50
  });
});

describe("freieSlotsMitPersonen", () => {
  it("nur innerhalb von Öffnung UND Arbeitszeit, Pause wird übersprungen", () => {
    const slots = freieSlotsMitPersonen({ ...basis, personen: [person("a")] });
    const zeiten = slots.map((s) => berlinUhrzeit(s.beginn));
    expect(zeiten[0]).toBe("08:30");
    expect(zeiten).not.toContain("16:30");
    // 11:30 + 60 Min: 30 Min vor der Pause (bis 12:00 Arbeitszeit), Rest ab 14:00 (Öffnung)
    const elfDreissig = slots.find((s) => berlinUhrzeit(s.beginn) === "11:30")!;
    expect(berlinUhrzeit(elfDreissig.ende)).toBe("14:30");
  });

  it("niemand da = nichts frei", () => {
    const p = person("a", { abwesenheiten: [{ art: "krank", von: TAG, bis: TAG, von_zeit: null, bis_zeit: null }] });
    expect(freieSlotsMitPersonen({ ...basis, personen: [p] })).toEqual([]);
  });

  it("wer schon einen Termin hat, ist zu der Zeit nicht frei, auch wenn Arbeitsplätze frei sind", () => {
    const slots = freieSlotsMitPersonen({ ...basis, personen: [person("a")], belegungen: [belegt("a", "09:00", "11:00")] });
    const zeiten = slots.map((s) => berlinUhrzeit(s.beginn));
    expect(zeiten).not.toContain("09:00");
    expect(zeiten).not.toContain("08:30");
    expect(zeiten).toContain("11:00");
  });

  it("Fähigkeiten: gesperrte Leistung macht die Person unpassend", () => {
    expect(freieSlotsMitPersonen({ ...basis, personen: [person("a", { gesperrt: ["oel"] })] })).toEqual([]);
    expect(freieSlotsMitPersonen({ ...basis, personen: [person("a", { gesperrt: ["reifen"] })] }).length).toBeGreaterThan(0);
  });

  it("Arbeitsplätze begrenzen weiter, auch wenn Personen frei wären", () => {
    const slots = freieSlotsMitPersonen({ ...basis, kapazitaet: 1, personen: [person("a"), person("b")], belegungen: [belegt("a", "09:00", "10:00")] });
    expect(slots.map((s) => berlinUhrzeit(s.beginn))).not.toContain("09:00");
  });

  it("die am wenigsten Ausgelastete zuerst", () => {
    const slots = freieSlotsMitPersonen({ ...basis, personen: [person("a"), person("b")], belegungen: [belegt("a", "14:00", "16:00")] });
    expect(slots.find((s) => berlinUhrzeit(s.beginn) === "09:00")!.kandidaten[0].profil).toBe("b");
  });

  it("Termine ohne Person brauchen auch jemanden", () => {
    const slots = freieSlotsMitPersonen({ ...basis, personen: [person("a")], belegungen: [belegt(null, "09:00", "10:00")] });
    expect(slots.map((s) => berlinUhrzeit(s.beginn))).not.toContain("09:00");
  });
});

describe("konflikte", () => {
  const t = (von: string, bis: string, leistungIds = ["oel"]) => ({ beginn: berlin(TAG, von), ende: berlin(TAG, bis), bis: berlin(TAG, bis), leistungIds });
  it("passt", () => expect(konflikte(person("a"), t("09:00", "10:00"), [])).toEqual([]));
  it("arbeitet nicht", () => expect(konflikte(person("a"), t("07:00", "08:00"), [])[0]).toMatch(/arbeitet um 07:00 Uhr nicht/));
  it("Feierabend", () => expect(konflikte(person("a"), t("16:00", "18:00"), [])[0]).toMatch(/Feierabend/));
  it("abwesend", () => expect(konflikte(person("a", { abwesenheiten: [{ art: "urlaub", von: TAG, bis: TAG, von_zeit: null, bis_zeit: null }] }), t("09:00", "10:00"), [])[0]).toMatch(/Urlaub/));
  it("darf nicht", () => expect(konflikte(person("a", { gesperrt: ["oel"] }), t("09:00", "10:00"), [], { oel: "Ölwechsel" })[0]).toMatch(/Ölwechsel/));
  it("doppelt belegt, aber nicht mit sich selbst", () => {
    const b = { ...belegt("a", "09:30", "10:30"), id: "x" };
    expect(konflikte(person("a"), t("09:00", "10:00"), [b]).join()).toMatch(/schon einen Termin/);
    expect(konflikte(person("a"), { ...t("09:00", "10:00"), id: "x" }, [b])).toEqual([]);
  });
  it("beste freie Person", () => {
    expect(besteFreiePerson([person("a"), person("b")], t("09:00", "10:00"), [belegt("a", "09:00", "10:00")])?.id).toBe("b");
    expect(besteFreiePerson([person("a")], t("09:00", "10:00"), [], ["a"])).toBeNull();
  });
});

describe("urlaubstage", () => {
  const p = person("a");
  it("zählt nur Arbeitstage", () => expect(urlaubstage(p, { von: "2026-11-30", bis: "2026-12-06", von_zeit: null })).toBe(5));
  it("halber Tag = 0,5", () => expect(urlaubstage(p, { von: TAG, bis: TAG, von_zeit: "08:00" })).toBe(0.5));
  it("nur Tage im Jahr", () => expect(urlaubstage(p, { von: "2026-12-28", bis: "2027-01-08", von_zeit: null }, "2026")).toBe(4));
});
