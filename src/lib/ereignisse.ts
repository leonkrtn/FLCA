import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { db } from "./supabase/admin";

/**
 * Alle Ereignisse, die das System nach außen meldet. Neue Module ergänzen hier ihre Typen. Externe
 * Dienste (n8n, Make, Zapier, eigene Skripte) abonnieren sie als Webhook oder lesen sie über
 * GET /api/v1/ereignisse. Der Kern muss dafür nie angefasst werden.
 */
export const EREIGNIS_TYPEN = {
  "termin.angefragt": "Ein Kunde hat einen Termin angefragt",
  "termin.bestaetigt": "Ein Termin wurde bestätigt",
  "termin.abgelehnt": "Eine Anfrage wurde abgelehnt",
  "termin.storniert": "Ein Termin wurde storniert",
  "termin.verschoben": "Ein Termin wurde verschoben",
  "termin.erledigt": "Ein Auftrag wurde abgeschlossen",
  "rechnung.gestellt": "Eine Rechnung wurde gestellt",
  "rechnung.versendet": "Eine Rechnung wurde per E-Mail versendet",
  "rechnung.bezahlt": "Eine Rechnung wurde als bezahlt markiert",
  "rechnung.storniert": "Eine Rechnung wurde storniert",
  "kunde.angelegt": "Ein neuer Kunde wurde angelegt",
  "einlagerung.angelegt": "Räder wurden eingelagert",
  "einlagerung.ausgelagert": "Räder wurden ausgelagert",
  "bewerbung.eingegangen": "Eine Bewerbung ist eingegangen",
  "abwesenheit.beantragt": "Urlaub beantragt oder krank gemeldet",
  "zeit.gestempelt": "Ein Mitarbeiter hat ein- oder ausgestempelt",
} as const;

export type EreignisTyp = keyof typeof EREIGNIS_TYPEN;

/** Zeichnet ein Ereignis auf und stellt es nach der Antwort an passende Webhooks zu. Wirft nie. */
export async function melden(typ: EreignisTyp, daten: Record<string, unknown>): Promise<void> {
  try {
    const { data: ereignis, error } = await db().from("ereignisse").insert({ typ, daten }).select("id").single();
    if (error || !ereignis) throw error;
    const { data: hooks } = await db().from("webhooks").select("id, typen").eq("aktiv", true);
    const passend = (hooks ?? []).filter((h) => (h.typen as string[]).includes("*") || (h.typen as string[]).includes(typ));
    if (!passend.length) return;
    await db()
      .from("webhook_zustellungen")
      .insert(passend.map((h) => ({ webhook_id: h.id, ereignis_id: ereignis.id })));
    after(() => zustellen());
  } catch (error) {
    console.error(`Ereignis ${typ} konnte nicht gemeldet werden`, error);
  }
}

/** Signatur nach dem Muster von Stripe: „t=<Unixzeit>,v1=<HMAC-SHA256 über "t.body">“. */
export function signatur(geheimnis: string, body: string, zeit = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", geheimnis).update(`${zeit}.${body}`).digest("hex");
  return `t=${zeit},v1=${v1}`;
}

const WARTEZEITEN_MIN = [1, 5, 30, 120, 720, 1440];

/** Stellt fällige Webhooks zu. Läuft nach jedem Ereignis und im 10-Minuten-Takt (Wiederholungen). */
export async function zustellen(limit = 25): Promise<number> {
  const { data: offen } = await db()
    .from("webhook_zustellungen")
    .select("id, versuche, webhooks(url, geheimnis, aktiv), ereignisse(id, typ, daten, erstellt_am)")
    .eq("status", "offen")
    .lte("naechster_versuch", new Date().toISOString())
    .order("id")
    .limit(limit);

  let zugestellt = 0;
  for (const z of offen ?? []) {
    const hook = z.webhooks as unknown as { url: string; geheimnis: string; aktiv: boolean } | null;
    const ereignis = z.ereignisse as unknown as { id: number; typ: string; daten: unknown; erstellt_am: string } | null;
    if (!hook || !ereignis || !hook.aktiv) {
      await db().from("webhook_zustellungen").update({ status: "fehler", letzte_antwort: "Webhook inaktiv" }).eq("id", z.id);
      continue;
    }
    const body = JSON.stringify({ id: ereignis.id, typ: ereignis.typ, zeit: ereignis.erstellt_am, daten: ereignis.daten });
    let antwort = "";
    let ok = false;
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-flc-ereignis": ereignis.typ, "x-flc-signatur": signatur(hook.geheimnis, body) },
        body,
        signal: AbortSignal.timeout(8000),
      });
      ok = res.ok;
      antwort = `HTTP ${res.status}`;
    } catch (error) {
      antwort = error instanceof Error ? error.message : "Fehler";
    }
    const versuche = z.versuche + 1;
    const warte = WARTEZEITEN_MIN[versuche - 1];
    await db()
      .from("webhook_zustellungen")
      .update({
        status: ok ? "ok" : warte === undefined ? "fehler" : "offen",
        versuche,
        letzte_antwort: antwort.slice(0, 300),
        naechster_versuch: new Date(Date.now() + (warte ?? 0) * 60000).toISOString(),
        aktualisiert_am: new Date().toISOString(),
      })
      .eq("id", z.id);
    if (ok) zugestellt++;
  }
  return zugestellt;
}

/** Eintrag im Verlauf eines Termins, einer Rechnung oder Bewerbung. */
export async function verlauf(bezugTyp: string, bezugId: string, text: string, von?: string | null) {
  await db().from("verlauf").insert({ bezug_typ: bezugTyp, bezug_id: bezugId, text, von: von ?? null });
}
