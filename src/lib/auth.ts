import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { KONFIGURIERT } from "./env";
import { type Bereich, darf, type Rolle, startseite } from "./rollen";
import { db } from "./supabase/admin";
import { sitzung } from "./supabase/server";

export type Benutzer = {
  id: string;
  email: string;
  name: string;
  rolle: Rolle | null;
  aktiv: boolean;
  zeiterfassung: boolean;
};

/** Der angemeldete Benutzer mit Rolle, oder null. */
export const aktuellerBenutzer = cache(async (): Promise<Benutzer | null> => {
  if (!KONFIGURIERT.supabase) return null;
  const {
    data: { user },
  } = await (await sitzung()).auth.getUser();
  if (!user) return null;
  const { data: profil } = await db()
    .from("profile")
    .select("name, rolle, aktiv, zeiterfassung")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    name: profil?.name ?? "",
    rolle: (profil?.aktiv === false ? null : (profil?.rolle as Rolle | null)) ?? null,
    aktiv: profil?.aktiv ?? false,
    zeiterfassung: profil?.zeiterfassung ?? false,
  };
});

/**
 * Stellt sicher, dass jemand angemeldet ist und den Bereich nutzen darf. Für Seiten, Route Handler und
 * Server Actions. In einer Server Action wird nicht umgeleitet, sondern ein Fehler geworfen, damit das
 * Formular seine Eingaben behält und einen Hinweis zeigt.
 */
export async function benutzerMitRecht(bereich?: Bereich): Promise<Benutzer> {
  const benutzer = await aktuellerBenutzer();
  const aktion = (await headers()).has("next-action");
  if (!benutzer) {
    if (aktion) throw new Error("Sie sind nicht mehr angemeldet. Bitte melden Sie sich neu an.");
    redirect("/login");
  }
  if (bereich && !darf(benutzer.rolle, bereich)) {
    if (aktion) throw new Error("Dafür fehlt Ihnen die Berechtigung.");
    redirect(benutzer.rolle ? startseite(benutzer.rolle) : "/login?fehler=kein-zugriff");
  }
  return benutzer;
}

/** Ziel nach dem Login: nur Adressen dieser Website. */
export function sicheresZiel(wert: unknown, rolle: Rolle | null): string {
  const fallback = startseite(rolle);
  if (typeof wert !== "string" || /[\\\s]/.test(wert) || !wert.startsWith("/") || wert.startsWith("//")) return fallback;
  try {
    const ziel = new URL(wert, "https://intern.invalid");
    if (ziel.origin !== "https://intern.invalid") return fallback;
    const erlaubt = ["/admin", "/app", "/team"].some((p) => ziel.pathname === p || ziel.pathname.startsWith(`${p}/`));
    return erlaubt ? ziel.pathname + ziel.search : fallback;
  } catch {
    return fallback;
  }
}
