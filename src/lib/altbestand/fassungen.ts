/**
 * Frühere Rechnungen, die neu geschrieben wurden („0055“, „0055.1“, „0055.2“), sind eine Rechnung in
 * mehreren Fassungen. Angezeigt wird die letzte mit ihrer Nummer und ihrem Datum, die älteren hängen an
 * ihr. Zusammen gehört, was beim selben Kunden dieselbe Grundnummer (vor dem Punkt) hat. Ohne Datenbank,
 * damit es getestet ist und Kundenakte und Rechnungsliste gleich zählen.
 */

type Fassung = { id: string; nummer: string; rechnungsdatum: string | null; kunde_id?: string | null };

export type MitFassungen<T> = T & { aeltere: T[] };

const grundnummer = (n: string) => n.trim().split(".")[0];
/** Spätere Fassung zuerst: jüngeres Datum, bei gleichem Datum die höhere Nummer („0055.2“ vor „0055.1“). */
const spaeter = (a: Fassung, b: Fassung) => (b.rechnungsdatum ?? "").localeCompare(a.rechnungsdatum ?? "") || b.nummer.localeCompare(a.nummer, "de", { numeric: true });

export function letzteFassungen<T extends Fassung>(liste: T[]): MitFassungen<T>[] {
  const gruppen = new Map<string, T[]>();
  for (const r of liste) {
    const schluessel = `${r.kunde_id ?? r.id}|${grundnummer(r.nummer)}`;
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), r]);
  }
  return [...gruppen.values()]
    .map((g) => {
      const [letzte, ...aeltere] = [...g].sort(spaeter);
      return { ...letzte, aeltere };
    })
    .sort(spaeter);
}
