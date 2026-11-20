"use server";

import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { alsBelegFahrzeug, alsEmpfaenger, kundeLaden, kundenSuchen, type KundenTreffer } from "../kunden";
import { kvAnlegen } from "../rechnung/kostenvoranschlaege";
import { entwurfAnlegen } from "../rechnung/rechnungen";
import { berlinDatum } from "../zeit";

export type BelegArt = "rechnung" | "kostenvoranschlag";
export type Ort = "admin" | "app";

const PFAD: Record<BelegArt, string> = { rechnung: "rechnungen", kostenvoranschlag: "kostenvoranschlaege" };

/** Live-Suche der Kundenauswahl. Eigene Aktion, damit der Browser nie mehr als die Treffer sieht. */
export async function kundenSuchenAktion(q: string): Promise<KundenTreffer[]> {
  await benutzerMitRecht("kunden");
  return kundenSuchen(String(q ?? ""), 8);
}

/**
 * Neuer Entwurf (Rechnung oder Kostenvoranschlag), auf Wunsch mit Kunde und Fahrzeug vorbefüllt.
 * Gleich für Verwaltung und Handy-App, nur das Ziel der Weiterleitung unterscheidet sich.
 */
export async function belegAnlegen(art: BelegArt, ort: Ort, kundeId: string | null, fahrzeugId: string | null): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const kunde = kundeId ? await kundeLaden(kundeId) : null;
  const fahrzeug = kunde?.fahrzeuge.find((f) => f.id === fahrzeugId) ?? null;
  const inhalt = {
    kunde_id: kunde?.id ?? null,
    empfaenger: kunde ? alsEmpfaenger(kunde) : { name: "" },
    fahrzeug: alsBelegFahrzeug(fahrzeug),
    positionen: [],
  };
  const id = art === "rechnung" ? await entwurfAnlegen({ ...inhalt, leistungsdatum: berlinDatum() }, b.id) : await kvAnlegen(inhalt, b.id);
  redirect(`/${ort}/${PFAD[art]}/${id}`);
}
