import { besterTreffer } from "../rechnung/aehnlich";
import { ausEk, centGenau, nettoAusBruttoPreis, type Position } from "../rechnung/berechnung";
import { besterEintrag } from "./abgleich";
import type { PositionsWunsch } from "./verstehen";

/**
 * Gesprochene Positionen werden Rechnungspositionen, nach denselben Regeln wie im Beleg-Editor:
 * Preisliste (runder Bruttopreis wird netto), gemerkter Preis für dieses Auto, Stundensatz für Lohn.
 * Ein gesprochener Preis geht vor und ist netto, außer es wurde „brutto“ gesagt.
 */

export type ListenEintrag = { id: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number; sprachnamen?: string[] | null };

/** Was aus dem Preisgedächtnis gebraucht wird (Teilmenge von `Gemerkt`, damit das hier ohne Server läuft). */
export type GemerktKurz = {
  marke: string;
  modell: string;
  text: string;
  text_norm: string;
  einheit: string;
  menge: number;
  einzel_netto_cent: number;
  mwst_satz: number;
  lohnart: string | null;
  ek_cent: number | null;
  aufschlag: number | null;
  artikel_id: string | null;
};

export type Grundlagen = {
  preisliste: ListenEintrag[];
  gemerkt: GemerktKurz[];
  stundensaetze: { name: string; netto_cent: number }[];
  aufschlagProzent: number;
};

/** Woher der Preis kommt, für die Vorschau. */
export type Herkunft = "gesprochen netto" | "gesprochen brutto" | "Einkauf + Aufschlag" | "gemerkt" | "Preisliste" | "Stundensatz" | "ohne Preis" | "Rabatt";

export function positionenBauen(wuensche: PositionsWunsch[], g: Grundlagen): { position: Position; herkunft: Herkunft }[] {
  const standardLohn = g.stundensaetze[0] ?? null;
  const satzFuer = (lohnart: string | null) => g.stundensaetze.find((s) => s.name === lohnart) ?? standardLohn;
  const netto = (cent: number, brutto: boolean, mwst: number) => (brutto ? nettoAusBruttoPreis(cent, mwst) : cent);

  return wuensche.map((w): { position: Position; herkunft: Herkunft } => {
    if (w.rabatt) {
      const rabatt = w.rabatt.betrag_cent != null ? { betrag_cent: Math.round(netto(w.rabatt.betrag_cent, w.brutto, 19)) } : { prozent: w.rabatt.prozent ?? 0 };
      return { position: { text: "Rabatt", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt }, herkunft: "Rabatt" };
    }

    const artikel = w.text ? (besterEintrag(w.text, g.preisliste)?.eintrag ?? null) : null;

    // Lohn: Stunden × Stundensatz (oder gesprochener Stundensatz)
    if (w.stunden || artikel?.einheit === "Std") {
      const satz = satzFuer(w.lohnart);
      const mwst = artikel?.mwst_satz ?? 19;
      const preis = w.preisCent !== null ? netto(w.preisCent, w.brutto, mwst) : (satz?.netto_cent ?? 0);
      return {
        position: {
          text: w.text || artikel?.name || (satz && g.stundensaetze.length > 1 ? `Arbeitszeit ${satz.name}` : "Arbeitszeit"),
          menge: w.menge ?? 1,
          einheit: "Std",
          einzel_netto_cent: preis,
          mwst_satz: mwst,
          artikel_id: artikel?.id ?? null,
          lohnart: satz?.name ?? null,
        },
        herkunft: w.preisCent !== null ? (w.brutto ? "gesprochen brutto" : "gesprochen netto") : satz ? "Stundensatz" : "ohne Preis",
      };
    }

    const gemerkt = g.gemerkt.length ? (besterTreffer(w.text, g.gemerkt) ?? (artikel ? (g.gemerkt.find((x) => x.artikel_id === artikel.id) ?? null) : null)) : null;
    const mwst = artikel?.mwst_satz ?? gemerkt?.mwst_satz ?? 19;
    const menge = w.menge ?? gemerkt?.menge ?? 1;
    let einzel = 0;
    let herkunft: Herkunft = "ohne Preis";
    let ek: number | null = null;
    let aufschlag: number | null = null;
    if (w.preisCent !== null) {
      const gesamt = netto(w.preisCent, w.brutto, mwst);
      einzel = w.gesamt && menge > 0 ? centGenau(gesamt / menge) : gesamt;
      herkunft = w.brutto ? "gesprochen brutto" : "gesprochen netto";
    } else if (w.ekCent !== null) {
      ek = w.ekCent;
      aufschlag = g.aufschlagProzent;
      einzel = ausEk(ek, aufschlag);
      herkunft = "Einkauf + Aufschlag";
    } else if (gemerkt) {
      // Gemerkter Lohn: gemerkte Stunden mit dem heutigen Stundensatz, wie im Editor
      einzel = gemerkt.einheit === "Std" ? (satzFuer(gemerkt.lohnart)?.netto_cent ?? gemerkt.einzel_netto_cent) : gemerkt.einzel_netto_cent;
      ek = gemerkt.ek_cent;
      aufschlag = gemerkt.aufschlag;
      herkunft = "gemerkt";
    } else if (artikel) {
      einzel = nettoAusBruttoPreis(artikel.preis_brutto_cent, mwst);
      herkunft = "Preisliste";
    }
    // Gesprochener Einkauf zählt auch neben einem gesprochenen Verkaufspreis (für den Rohertrag)
    if (w.ekCent !== null && ek === null) ek = w.ekCent;
    const einheit = w.einheit ?? gemerkt?.einheit ?? artikel?.einheit ?? (w.menge !== null ? "Stk" : "Pauschal");

    return {
      position: {
        // Ohne eigenen Preis steht der Name aus der Preisliste drin, sonst das Gesprochene
        text: artikel && herkunft === "Preisliste" ? artikel.name : w.text || artikel?.name || "Position",
        menge,
        einheit,
        einzel_netto_cent: einzel,
        mwst_satz: mwst,
        artikel_id: artikel?.id ?? gemerkt?.artikel_id ?? null,
        ...(einheit === "Std" && { lohnart: satzFuer(gemerkt?.lohnart ?? null)?.name ?? null }),
        ...(ek !== null && { ek_cent: ek, aufschlag }),
      },
      herkunft,
    };
  });
}
