"use server";

import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { centAus, type Ergebnis, sicher, text, zahl } from "../forms";
import { textNorm } from "../rechnung/aehnlich";
import { db } from "../supabase/admin";

const PFAD = "/admin/gemerkte-preise";

/** Gemerkten Preis von Hand korrigieren: Netto, Menge, bei Teilen der Einkauf. */
export async function gemerktAendern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("rechnungen");
    const preis = centAus(fd, "preis");
    const menge = zahl(fd, "menge");
    if (preis === null || preis < 0) return { status: "fehler", meldung: "Bitte einen Preis angeben." };
    if (menge === null || menge <= 0) return { status: "fehler", meldung: "Bitte eine Menge angeben." };
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
