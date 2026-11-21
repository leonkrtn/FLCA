import "server-only";
import type { Benutzer } from "./auth";
import { melden } from "./ereignisse";
import { darf } from "./rollen";
import { pushSenden } from "./services/push";
import { db } from "./supabase/admin";
import { naechsteWiederholung, type Wiederholung } from "./zeit";

/**
 * Notizen mit optionaler Erinnerung. Wer was sieht:
 *  - privat: die Person, die sie angelegt hat, und die Person, an die erinnert wird
 *  - buero: zusätzlich alle mit Recht „notizen“ (Inhaber, Büro)
 * Mitarbeiter legen keine Notizen an; sie sehen in der Team-App nur, woran sie erinnert werden.
 */
export type Notiz = {
  id: string;
  titel: string;
  text: string;
  sichtbar: "privat" | "buero";
  erstellt_von: string | null;
  kunde_id: string | null;
  termin_id: string | null;
  erinnern_am: string | null;
  wiederholung: Wiederholung;
  erinnern_an: string | null;
  erinnert_am: string | null;
  erledigt_am: string | null;
  erstellt_am: string;
  kunde: { id: string; name: string } | null;
  termin: { id: string; nummer: number; leistung_name: string; beginn: string } | null;
  autor: { name: string } | null;
  empfaenger: { name: string } | null;
};

export const WIEDERHOLUNG_TEXT: Record<Wiederholung, string> = {
  keine: "einmalig",
  taeglich: "täglich",
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
};

export type NotizAnsicht = "offen" | "erinnerungen" | "erledigt";

const FELDER =
  "*, kunde:kunden(id, name), termin:termine(id, nummer, leistung_name, beginn), autor:profile!notizen_erstellt_von_fkey(name), empfaenger:profile!notizen_erinnern_an_fkey(name)";

/** PostgREST-Filter: Erinnerungen, die an diese Person gehen. */
function meineErinnerungen(b: Benutzer): string {
  return `erinnern_an.eq.${b.id},and(erinnern_an.is.null,erstellt_von.eq.${b.id})`;
}

/** PostgREST-Filter: alle Notizen, die diese Person sehen darf. */
function sichtbarFuer(b: Benutzer): string {
  return [`erstellt_von.eq.${b.id}`, `erinnern_an.eq.${b.id}`, ...(darf(b.rolle, "notizen") ? ["sichtbar.eq.buero"] : [])].join(",");
}

export async function notizenLaden(
  b: Benutzer,
  { ansicht = "offen", kundeId, terminId, nurMeine = false, limit = 200 }: { ansicht?: NotizAnsicht; kundeId?: string; terminId?: string; nurMeine?: boolean; limit?: number } = {},
): Promise<Notiz[]> {
  // Team-App: nur, woran man selbst erinnert wird (bzw. eigene Notizen ohne anderen Empfänger). Das ist
  // enger als „sichtbar“, deshalb ersetzt es den Filter, statt ein zweites „or“ anzuhängen.
  let q = db()
    .from("notizen")
    .select(FELDER)
    .or(nurMeine ? meineErinnerungen(b) : sichtbarFuer(b))
    .limit(limit);
  if (kundeId) q = q.eq("kunde_id", kundeId);
  if (terminId) q = q.eq("termin_id", terminId);
  if (ansicht === "erledigt") q = q.not("erledigt_am", "is", null).order("erledigt_am", { ascending: false });
  else {
    q = q.is("erledigt_am", null);
    if (ansicht === "erinnerungen") q = q.not("erinnern_am", "is", null);
    // Fällige und bald fällige Erinnerungen zuerst, dann Notizen ohne Erinnerung, neueste oben
    q = q.order("erinnern_am", { ascending: true, nullsFirst: false }).order("erstellt_am", { ascending: false });
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Notiz[];
}

export async function notizLaden(b: Benutzer, id: string): Promise<Notiz | null> {
  const { data } = await db().from("notizen").select(FELDER).eq("id", id).or(sichtbarFuer(b)).maybeSingle();
  return (data as unknown as Notiz | null) ?? null;
}

/** Ist die Erinnerung fällig (Zeitpunkt erreicht, Notiz offen)? */
export function faellig(n: Pick<Notiz, "erinnern_am" | "erledigt_am">, jetzt: number): boolean {
  return Boolean(n.erinnern_am && !n.erledigt_am && new Date(n.erinnern_am).getTime() <= jetzt);
}

/** Zähler für Menü und App: fällige Erinnerungen, die an diese Person gehen. */
export async function faelligeAnzahl(b: Benutzer): Promise<number> {
  const { count } = await db()
    .from("notizen")
    .select("id", { count: "exact", head: true })
    .is("erledigt_am", null)
    .lte("erinnern_am", new Date().toISOString())
    .or(meineErinnerungen(b));
  return count ?? 0;
}

/** Daten für Webhooks: Inhalt nur bei Büro-Notizen, private Notizen verlassen das System nicht. */
export function notizEreignis(n: Pick<Notiz, "id" | "titel" | "sichtbar" | "kunde_id" | "termin_id" | "erinnern_am" | "wiederholung">) {
  return {
    notiz_id: n.id,
    sichtbar: n.sichtbar,
    titel: n.sichtbar === "buero" ? n.titel : null,
    kunde_id: n.kunde_id,
    termin_id: n.termin_id,
    erinnern_am: n.erinnern_am,
    wiederholung: n.wiederholung,
  };
}

/**
 * Aus dem Takt: fällige Erinnerungen per Push verschicken. Je Notiz und Zeitpunkt genau einmal
 * (automatik_log), danach rückt eine Wiederholung auf den nächsten Zeitpunkt vor.
 */
export async function erinnerungenSenden(einmalig: (art: string, bezug: string) => Promise<boolean>): Promise<number> {
  const jetzt = new Date();
  const { data, error } = await db()
    .from("notizen")
    .select("id, titel, text, sichtbar, kunde_id, termin_id, erinnern_am, wiederholung, erinnern_an, erstellt_von, erinnert_am, kunde:kunden(name)")
    .is("erledigt_am", null)
    .lte("erinnern_am", jetzt.toISOString())
    // Schon erinnerte, nicht erledigte Notizen bleiben in dieser Menge. Jüngste zuerst, damit sie neue
    // Erinnerungen nicht hinter die Grenze von 200 drängen.
    .order("erinnern_am", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  let gesendet = 0;
  for (const n of (data ?? []) as unknown as (Notiz & { kunde: { name: string } | null })[]) {
    // Schon erinnert und nicht wiederkehrend: bleibt als „fällig“ stehen, bis jemand sie erledigt.
    if (n.erinnert_am && new Date(n.erinnert_am).getTime() >= new Date(n.erinnern_am!).getTime()) continue;
    if (!(await einmalig("notiz", `${n.id}:${n.erinnern_am}`))) continue;
    const an = n.erinnern_an ?? n.erstellt_von;
    if (an) {
      const { data: p } = await db().from("profile").select("rolle").eq("id", an).maybeSingle();
      const titel = n.titel || n.text.split("\n")[0].slice(0, 60) || "Notiz";
      await pushSenden(
        { profile: [an] },
        {
          titel: `Erinnerung: ${titel}`,
          text: [n.kunde?.name, n.titel ? n.text.slice(0, 120) : ""].filter(Boolean).join(" · ") || "Jetzt fällig",
          url: p?.rolle === "mitarbeiter" ? "/team/notizen" : `/app/notizen/${n.id}`,
          tag: `notiz-${n.id}`,
        },
      );
    }
    const naechste = naechsteWiederholung(new Date(n.erinnern_am!), n.wiederholung, jetzt);
    await db()
      .from("notizen")
      .update(naechste ? { erinnert_am: jetzt.toISOString(), erinnern_am: naechste.toISOString() } : { erinnert_am: jetzt.toISOString() })
      .eq("id", n.id);
    await melden("notiz.erinnert", notizEreignis(n));
    gesendet++;
  }
  return gesendet;
}
