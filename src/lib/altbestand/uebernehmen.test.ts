import { beforeEach, describe, expect, it, vi } from "vitest";

// Nachgebaute Datenbank: nur die Aufrufe, die die Übernahme macht (laden, einfügen, ändern per id).
type Zeile = Record<string, unknown>;
const tabellen: Record<string, Zeile[]> = {};
let zaehler = 0;
const norm = (s: string) => s.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
function abfrage(t: string) {
  const liste = () => (tabellen[t] ??= []);
  const neu = (z: Zeile) => {
    const zeile = { id: `${t}-${++zaehler}`, ...z, ...(t === "fahrzeuge" ? { kennzeichen_norm: norm(String(z.kennzeichen)) } : {}) };
    liste().push(zeile);
    return zeile;
  };
  return {
    select: () => ({ limit: async () => ({ data: liste().map((z) => ({ ...z })) }) }),
    insert: (z: Zeile | Zeile[]) => {
      const zeilen = (Array.isArray(z) ? z : [z]).map(neu);
      return Object.assign(Promise.resolve({ data: null }), { select: () => ({ single: async () => ({ data: zeilen[0] }) }) });
    },
    update: (x: Zeile) => ({ eq: async (_s: string, id: string) => (Object.assign(liste().find((z) => z.id === id)!, x), { data: null }) }),
  };
}
vi.mock("../supabase/admin", () => ({ db: () => ({ from: abfrage }) }));
const melden = vi.fn();
vi.mock("../ereignisse", () => ({ melden: (...a: unknown[]) => melden(...a) }));

const { uebernehmen } = await import("./uebernehmen");
const { planen } = await import("./lesen");

const rechnung = (nummer: string, name: string, extra: Record<string, string> = {}) => ({
  nummer, fassung: "Original", datum: "01.06.2026", leistungsdatum: "01.06.2026", name, anrede: "", strasse: "Weg 1", plz: "63128", ort: "Dietzenbach", land: "DE",
  kennzeichen: "", km: "", steuer: "19% USt", netto: "100,0", mwst: "19,0", brutto: "119,0", vereinbarter_preis: "", regulaerpreis: "", brutto_inkl_durchlaufend: "", endbetrag: "119,0", zahlart: "bar", datei: `Rechnung ${name} ${nummer}.pdf`, ...extra,
});

beforeEach(() => {
  for (const k of Object.keys(tabellen)) delete tabellen[k];
  melden.mockClear();
});

describe("uebernehmen", () => {
  it("Probelauf schreibt nichts", async () => {
    const b = await uebernehmen(planen({ rechnungen: [rechnung("0001", "Max Muster", { kennzeichen: "OF-MM 1", km: "1000" })] }), true);
    expect(b).toMatchObject({ kunden: { neu: 1 }, fahrzeuge: { neu: 1 }, rechnungen: { neu: 1 } });
    expect(tabellen.kunden ?? []).toEqual([]);
    expect(melden).not.toHaveBeenCalled();
  });

  it("legt an, verknüpft und ist beim zweiten Mal ohne Wirkung", async () => {
    const plan = () => planen({ rechnungen: [rechnung("0001", "Max Muster", { kennzeichen: "OF-MM 1", km: "1000" }), rechnung("0002", "Max Muster", { datei: "b.pdf" })] });
    const erst = await uebernehmen(plan(), false);
    expect(erst).toMatchObject({ kunden: { neu: 1, vorhanden: 0 }, fahrzeuge: { neu: 1 }, rechnungen: { neu: 2 } });
    const kunde = tabellen.kunden[0];
    expect(tabellen.fahrzeuge[0]).toMatchObject({ kunde_id: kunde.id, km_stand: 1000 });
    expect(tabellen.alt_rechnungen.map((r) => [r.kunde_id, r.fahrzeug_id])).toEqual([[kunde.id, tabellen.fahrzeuge[0].id], [kunde.id, null]]);
    expect(melden).toHaveBeenCalledTimes(1);

    const zweit = await uebernehmen(plan(), false);
    expect(zweit).toMatchObject({ kunden: { neu: 0, vorhanden: 1 }, fahrzeuge: { neu: 0, ergaenzt: 0 }, rechnungen: { neu: 0, vorhanden: 2 } });
    expect(tabellen.kunden).toHaveLength(1);
    expect(tabellen.alt_rechnungen).toHaveLength(2);
    expect(melden).toHaveBeenCalledTimes(1);
  });

  it("vorhandener Kunde wird nur ergänzt, fremdes Auto bleibt beim Halter", async () => {
    tabellen.kunden = [
      { id: "k1", name: "Max Muster", firma: "", strasse: "", plz: "", ort: "", notiz: "Stammkunde" },
      { id: "k2", name: "Anna Andere", firma: "", strasse: "Gasse 9", plz: "60311", ort: "Frankfurt", notiz: "" },
    ];
    tabellen.fahrzeuge = [{ id: "f1", kunde_id: "k2", kennzeichen: "OF-MM 1", kennzeichen_norm: "OFMM1", km_stand: 500, marke_modell: "" }];
    const b = await uebernehmen(planen({ rechnungen: [rechnung("0001", "Max Muster", { kennzeichen: "OF-MM 1", km: "1000" })] }), false);
    expect(b.kunden).toEqual({ neu: 0, vorhanden: 1 });
    expect(tabellen.kunden[0]).toMatchObject({ strasse: "Weg 1", plz: "63128", notiz: "Stammkunde" });
    expect(tabellen.fahrzeuge[0]).toMatchObject({ kunde_id: "k2", km_stand: 500 });
    expect(tabellen.alt_rechnungen[0]).toMatchObject({ kunde_id: "k1", fahrzeug_id: null });
    expect(b.hinweise[0]).toContain("OF-MM 1");
  });

  it("gleicher Name, andere Anschrift: zwei verschiedene Kunden", async () => {
    tabellen.kunden = [{ id: "k1", name: "Max Muster", firma: "", strasse: "Ganz woanders 5", plz: "10115", ort: "Berlin", notiz: "" }];
    const b = await uebernehmen(planen({ rechnungen: [rechnung("0001", "Max Muster")] }), false);
    expect(b.kunden).toEqual({ neu: 1, vorhanden: 0 });
    expect(tabellen.kunden).toHaveLength(2);
  });

  it("höherer KM-Stand ergänzt ein eigenes Auto ohne Halter", async () => {
    tabellen.fahrzeuge = [{ id: "f1", kunde_id: null, kennzeichen: "OF-MM 1", kennzeichen_norm: "OFMM1", km_stand: 500, marke_modell: "" }];
    const b = await uebernehmen(planen({ rechnungen: [rechnung("0001", "Max Muster", { kennzeichen: "OF-MM 1", km: "1000" })] }), false);
    expect(b.fahrzeuge).toEqual({ neu: 0, ergaenzt: 1 });
    expect(tabellen.fahrzeuge[0]).toMatchObject({ kunde_id: tabellen.kunden[0].id, km_stand: 1000 });
  });
});
