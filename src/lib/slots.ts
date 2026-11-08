import type { Fenster } from "./einstellungen";
import { berlin, minuten, uhrzeit } from "./zeit";

/** Belegung als Millisekunden-Zeitraum; Gewicht = belegte Arbeitsplätze (ganztägige Sperre = alle). */
export type Belegung = { beginn: number; bis: number; gewicht: number };

export type Slot = { beginn: Date; ende: Date; bis: Date };

/**
 * Wann ist eine Arbeit fertig, die um `startMin` beginnt und `dauerMin` Arbeitszeit braucht?
 * Pausen zwischen den Öffnungsfenstern werden übersprungen (das Auto bleibt in der Halle stehen).
 * null, wenn der Start außerhalb der Öffnungszeit liegt oder die Arbeit am selben Tag nicht fertig wird.
 */
export function arbeitsende(fenster: Fenster[], startMin: number, dauerMin: number): number | null {
  const bereiche = fenster.map(([a, b]) => [minuten(a), minuten(b)] as const).sort((x, y) => x[0] - y[0]);
  const start = bereiche.findIndex(([a, b]) => startMin >= a && startMin < b);
  if (start === -1) return null;
  let rest = dauerMin;
  let jetzt = startMin;
  for (let i = start; i < bereiche.length; i++) {
    const [a, b] = bereiche[i];
    if (i > start) jetzt = a;
    const verfuegbar = b - jetzt;
    if (rest <= verfuegbar) return jetzt + rest;
    rest -= verfuegbar;
  }
  return null;
}

/** Höchste gleichzeitige Belegung im Zeitraum – dieselbe Rechnung wie public.belegung_max in der Datenbank. */
export function belegungMax(beginn: number, bis: number, belegungen: Belegung[]): number {
  const relevant = belegungen.filter((b) => b.beginn < bis && b.bis > beginn);
  const punkte = [beginn, ...relevant.map((b) => b.beginn).filter((t) => t > beginn && t < bis)];
  let max = 0;
  for (const t of punkte) {
    const summe = relevant.filter((b) => b.beginn <= t && b.bis > t).reduce((s, b) => s + b.gewicht, 0);
    max = Math.max(max, summe);
  }
  return max;
}

export type SlotParameter = {
  datum: string;
  fenster: Fenster[];
  dauerMin: number;
  pufferMin: number;
  rasterMin: number;
  kapazitaet: number;
  /** Frühester erlaubter Beginn (Vorlauf) */
  fruehestens: Date;
  belegungen: Belegung[];
};

/** Freie Startzeiten eines Tages. */
export function freieSlots(p: SlotParameter): Slot[] {
  const slots: Slot[] = [];
  for (const [von, bis] of p.fenster) {
    for (let start = minuten(von); start < minuten(bis); start += p.rasterMin) {
      const ende = arbeitsende(p.fenster, start, p.dauerMin);
      if (ende === null) continue;
      const beginnZeit = berlin(p.datum, uhrzeit(start));
      if (beginnZeit < p.fruehestens) continue;
      const endeZeit = berlin(p.datum, uhrzeit(ende));
      const bisZeit = new Date(endeZeit.getTime() + p.pufferMin * 60000);
      if (belegungMax(beginnZeit.getTime(), bisZeit.getTime(), p.belegungen) >= p.kapazitaet) continue;
      slots.push({ beginn: beginnZeit, ende: endeZeit, bis: bisZeit });
    }
  }
  return slots;
}
