"use server";

import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { centAus, type Ergebnis, sicher, text, zahl } from "../forms";
import { textNorm } from "../rechnung/aehnlich";
import { db } from "../supabase/admin";

// Reiter „Gemerkte Preise“ in den Einstellungen
const PFAD = "/admin/einstellungen";

/** Gemerkten Preis von Hand korrigieren: Netto, Menge, bei Teilen der Einkauf. */
export async function gemerktAendern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("rechnungen");
    const eingabe = centAus(fd, "preis");
    const menge = zahl(fd, "menge");
    if (eingabe === null || eingabe < 0) return { status: "fehler", meldung: "Bitte einen Preis angeben." };
    if (menge === null || menge <= 0) return { status: "fehler", meldung: "Bitte eine Menge angeben." };
    // Das Feld zeigt den Preis auf ganze Cent; gespeichert ist er auf Hundertstel Cent (aus runden
    // Bruttopreisen). Bleibt die Eingabe unverändert, gilt der genaue Wert weiter, sonst würde schon eine
    // geänderte Menge aus 40,00 € brutto bei zwei Stück 79,99 € machen.
    const { data: alt } = await db().from("preis_gedaechtnis").select("einzel_netto_cent").eq("id", id).maybeSingle();
    const genau = alt ? Number(alt.einzel_netto_cent) : null;
    const preis = genau !== null && Math.round(genau) === eingabe ? genau : eingabe;
    const ek = centAus(fd, "ek");
    const { error } = await db()
      .from("preis_gedaechtnis")
      .update({
        einzel_netto_cent: preis,
        menge: Math.round(menge * 1000) / 1000,
        ek_cent: ek && ek > 0 ? ek : null,
        aufschlag: ek && ek > 0 ? Math.round((preis / ek - 1) * 1000) / 10 : null,
      })
      .eq("id", id);
    if (error) return { status: "fehler", meldung: error.message };
    revalidatePath(PFAD);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function gemerktLoeschen(id: string): Promise<void> {
  await benutzerMitRecht("rechnungen");
  await db().from("preis_gedaechtnis").delete().eq("id", id);
  revalidatePath(PFAD);
}

export async function paketUmbenennen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("rechnungen");
    const name = text(fd, "name", 120);
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen angeben." };
    const { error } = await db().from("pakete").update({ name, name_norm: textNorm(name) }).eq("id", id);
    if (error) return { status: "fehler", meldung: error.code === "23505" ? "Für dieses Auto gibt es schon ein Paket mit diesem Namen." : error.message };
    revalidatePath(PFAD);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function paketLoeschen(id: string): Promise<void> {
  await benutzerMitRecht("rechnungen");
  await db().from("pakete").delete().eq("id", id);
  revalidatePath(PFAD);
}
