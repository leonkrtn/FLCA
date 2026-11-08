"use server";

import { redirect } from "next/navigation";
import { aktuellerBenutzer, sicheresZiel } from "@/lib/auth";
import { ENV } from "@/lib/env";
import { type Ergebnis, istEmail, sicher, text } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { db } from "@/lib/supabase/admin";
import { sitzung } from "@/lib/supabase/server";
import type { Rolle } from "@/lib/rollen";

export async function anmelden(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const email = text(fd, "email", 160).toLowerCase();
  const passwort = typeof fd.get("passwort") === "string" ? (fd.get("passwort") as string) : "";
  const ergebnis = await sicher(fd, async () => {
    if (!istEmail(email) || !passwort) return { status: "fehler", meldung: "Bitte E-Mail und Passwort eingeben.", werte: { email } };
    if ((await imLimit("anmeldung")) !== "ok" || (await imLimit("anmeldungKonto", email)) !== "ok") {
      return { status: "fehler", meldung: "Zu viele Versuche. Bitte in 15 Minuten noch einmal.", werte: { email } };
    }
    const { data, error } = await (await sitzung()).auth.signInWithPassword({ email, password: passwort });
    if (error || !data.user) return { status: "fehler", meldung: "E-Mail oder Passwort stimmen nicht.", werte: { email } };
    const { data: profil } = await db().from("profile").select("rolle, aktiv").eq("id", data.user.id).maybeSingle();
    if (!profil?.rolle || profil.aktiv === false) {
      await (await sitzung()).auth.signOut();
      return { status: "fehler", meldung: "Ihr Konto ist noch nicht freigeschaltet. Bitte wenden Sie sich an den Inhaber.", werte: { email } };
    }
    return { status: "ok", daten: { ziel: sicheresZiel(fd.get("weiter"), profil.rolle as Rolle) } };
  });
  if (ergebnis.status === "ok") redirect(String(ergebnis.daten?.ziel ?? "/admin"));
  return ergebnis;
}

export async function abmelden() {
  await (await sitzung()).auth.signOut();
  redirect("/login");
}

export async function passwortVergessen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const email = text(fd, "email", 160).toLowerCase();
    if (!istEmail(email)) return { status: "fehler", meldung: "Bitte eine gültige E-Mail-Adresse eingeben." };
    if ((await imLimit("passwortLink")) === "ok" && (await imLimit("passwortLinkKonto", email)) === "ok") {
      await (await sitzung()).auth.resetPasswordForEmail(email, { redirectTo: `${ENV.siteUrl}/login/passwort-setzen` });
    }
    // Immer dieselbe Antwort, damit sich nicht ausprobieren lässt, welche Adressen ein Konto haben.
    return { status: "ok", meldung: "Wenn es zu dieser Adresse ein Konto gibt, ist ein Link unterwegs." };
  });
}

export async function passwortSetzen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const ergebnis = await sicher(fd, async () => {
    const pw = typeof fd.get("passwort") === "string" ? (fd.get("passwort") as string) : "";
    if (pw.length < 10) return { status: "fehler", meldung: "Bitte mindestens 10 Zeichen." };
    if (pw !== fd.get("wiederholung")) return { status: "fehler", meldung: "Die beiden Passwörter sind nicht gleich." };
    const { error } = await (await sitzung()).auth.updateUser({ password: pw });
    if (error) return { status: "fehler", meldung: "Der Link ist abgelaufen. Bitte einen neuen anfordern." };
    return { status: "ok" };
  });
  if (ergebnis.status === "ok") {
    const b = await aktuellerBenutzer();
    redirect(sicheresZiel(null, b?.rolle ?? null));
  }
  return ergebnis;
}
