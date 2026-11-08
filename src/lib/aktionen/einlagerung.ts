"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { melden } from "../ereignisse";
import { centAus, type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { db } from "../supabase/admin";
import { fahrzeugFindenOderAnlegen, kundeFindenOderAnlegen } from "../termine";
import { berlinDatum, istDatum } from "../zeit";

function daten(fd: FormData) {
  const profil = (n: string) => {
    const z = zahl(fd, n);
    return z === null ? null : Math.max(0, Math.min(z, 20));
  };
  return {
    lagerplatz: text(fd, "lagerplatz", 40),
    saison: ["sommer", "winter", "ganzjahr"].includes(text(fd, "saison")) ? text(fd, "saison") : "sommer",
    reifen_marke: text(fd, "reifen_marke", 80),
    reifengroesse: text(fd, "reifengroesse", 40),
    dot: text(fd, "dot", 40),
    mit_felgen: ja(fd, "mit_felgen"),
    anzahl: Math.round(zahl(fd, "anzahl") ?? 4),
    profil_vl: profil("profil_vl"),
    profil_vr: profil("profil_vr"),
    profil_hl: profil("profil_hl"),
    profil_hr: profil("profil_hr"),
    preis_cent: centAus(fd, "preis"),
    eingelagert_am: istDatum(text(fd, "eingelagert_am")) ? text(fd, "eingelagert_am") : berlinDatum(),
    notiz: text(fd, "notiz", 2000),
  };
}

export async function einlagern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    await benutzerMitRecht("einlagerung");
    const kz = text(fd, "kennzeichen", 16);
    if (!kz) return { status: "fehler", meldung: "Bitte das Kennzeichen angeben." };
    const norm = kz.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
    let { data: fz } = await db().from("fahrzeuge").select("id, kunde_id").eq("kennzeichen_norm", norm).maybeSingle();
    if (!fz?.kunde_id) {
      const name = text(fd, "name", 120);
      if (!name) return { status: "fehler", meldung: "Das Kennzeichen ist neu. Bitte den Namen des Kunden angeben." };
      const kundeId = await kundeFindenOderAnlegen({ name, telefon: text(fd, "telefon", 40), email: text(fd, "email", 160) });
      const fid = await fahrzeugFindenOderAnlegen(kz, kundeId);
      fz = { id: fid, kunde_id: kundeId };
    }
    const { data, error } = await db().from("einlagerungen").insert({ ...daten(fd), kunde_id: fz.kunde_id, fahrzeug_id: fz.id }).select("id, nummer").single();
    if (error) throw new Error(error.message);
    await melden("einlagerung.angelegt", { einlagerung_id: data.id, nummer: data.nummer, kennzeichen: kz });
    ziel = `/admin/einlagerung/${data.id}`;
    return { status: "ok" };
  });
  if (ziel) redirect(ziel);
  return e;
}

export async function einlagerungSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einlagerung");
    const { error } = await db().from("einlagerungen").update(daten(fd)).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/einlagerung/${id}`);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function auslagern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einlagerung");
    const am = istDatum(text(fd, "am")) ? text(fd, "am") : berlinDatum();
    await db().from("einlagerungen").update({ ausgelagert_am: am }).eq("id", id);
    await melden("einlagerung.ausgelagert", { einlagerung_id: id, am });
    revalidatePath("/admin/einlagerung", "layout");
    return { status: "ok", meldung: "Ausgelagert." };
  });
}
