import { Auswahl, Feld, Schalter, Textfeld } from "./ui";

export type EinlagerungZeile = Record<string, string | number | boolean | null>;

export function EinlagerungFelder({ e }: { e?: EinlagerungZeile }) {
  const w = (n: string) => (e?.[n] ?? null) as string | number | null;
  return (
    <>
      <Feld label="Lagerplatz" name="lagerplatz" wert={w("lagerplatz")} placeholder="z. B. R2-04" />
      <Auswahl label="Eingelagert sind" name="saison" wert={(w("saison") as string) ?? "sommer"} optionen={[["sommer", "Sommerräder"], ["winter", "Winterräder"], ["ganzjahr", "Ganzjahresräder"]]} />
      <Feld label="Reifenmarke" name="reifen_marke" wert={w("reifen_marke")} />
      <Feld label="Reifengröße" name="reifengroesse" wert={w("reifengroesse")} placeholder="205/55 R16 91V" />
      <Feld label="DOT" name="dot" wert={w("dot")} placeholder="z. B. 2322" />
      <Feld label="Anzahl" name="anzahl" wert={w("anzahl") ?? 4} inputMode="numeric" />
      <fieldset className="sm:col-span-2">
        <legend className="label">Profiltiefe in mm</legend>
        <div className="grid grid-cols-4 gap-2">
          {(["vl", "vr", "hl", "hr"] as const).map((p) => (
            <Feld key={p} label={p.toUpperCase()} name={`profil_${p}`} wert={w(`profil_${p}`)} inputMode="decimal" />
          ))}
        </div>
      </fieldset>
      <Feld label="Preis pro Saison (€)" name="preis" wert={w("preis_cent") !== null && w("preis_cent") !== undefined ? String(Number(w("preis_cent")) / 100).replace(".", ",") : ""} inputMode="decimal" />
      <Feld label="Eingelagert am" name="eingelagert_am" typ="date" wert={w("eingelagert_am")} />
      <div className="sm:col-span-2">
        <Schalter label="mit Felgen" name="mit_felgen" an={(e?.mit_felgen as boolean) ?? true} />
      </div>
      <Textfeld label="Notiz" name="notiz" wert={w("notiz") as string} zeilen={2} className="sm:col-span-2" />
    </>
  );
}
