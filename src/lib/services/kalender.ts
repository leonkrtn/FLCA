import "server-only";
import { randomUUID } from "node:crypto";
import { ENV, KONFIGURIERT } from "../env";
import { einstellungen } from "../einstellungen";
import { db } from "../supabase/admin";
import { berlin, plusTage, berlinDatum } from "../zeit";

/**
 * Kalender-Schnittstelle. Der Google-Kalender ist die Wahrheit für alles, was Flavio dort selbst einträgt
 * (Urlaub, private Termine, Telefonkunden). Die Datenbank hält davon eine Kopie (kalender_belegungen),
 * damit die freien Slots ohne Google-Aufruf berechnet werden. Bestätigte Termine aus dem System werden in
 * Google eingetragen und dort markiert, damit sie beim Abgleich nicht doppelt zählen.
 *
 * Regeln für Einträge, die Flavio direkt in Google anlegt:
 *  - ganztägig (z. B. „Betriebsurlaub“) sperrt die ganze Werkstatt
 *  - mit Uhrzeit belegt einen Arbeitsplatz
 *  - als „Verfügbar“ markiert (transparent) blockiert nichts
 */
export type KalenderTermin = {
  id: string;
  titel: string;
  beschreibung: string;
  beginn: Date;
  ende: Date;
};

export interface Kalender {
  readonly name: string;
  verbunden(): Promise<boolean>;
  eintragen(t: KalenderTermin): Promise<string | null>;
  aendern(eventId: string, t: KalenderTermin): Promise<void>;
  entfernen(eventId: string): Promise<void>;
  /** Fremde Einträge der nächsten Wochen in die Datenbank übernehmen. */
  abgleichen(): Promise<{ anzahl: number }>;
  /** Push-Kanal anlegen bzw. vor Ablauf erneuern. */
  beobachten(erzwingen?: boolean): Promise<void>;
}

const API = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];
export const GOOGLE_REDIRECT = () => `${ENV.siteUrl}/api/google/rueckruf`;

type Verbindung = {
  refresh_token: string | null;
  kalender_id: string;
  kanal_id: string | null;
  kanal_resource_id: string | null;
  kanal_ablauf: string | null;
  letzter_sync: string | null;
};

async function verbindung(): Promise<Verbindung | null> {
  const { data } = await db().from("kalender_verbindung").select("*").eq("id", 1).maybeSingle();
  return data?.refresh_token ? (data as Verbindung) : null;
}

let zugang: { token: string; bis: number } | null = null;

async function zugangstoken(refreshToken: string): Promise<string> {
  if (zugang && zugang.bis > Date.now() + 60000) return zugang.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    const fehler = `Google-Anmeldung abgelaufen (${json.error ?? res.status}). Bitte in den Einstellungen neu verbinden.`;
    await db().from("kalender_verbindung").update({ letzter_fehler: fehler }).eq("id", 1);
    throw new Error(fehler);
  }
  zugang = { token: json.access_token, bis: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return zugang.token;
}

async function anfrage<T>(v: Verbindung, pfad: string, init: RequestInit = {}): Promise<T> {
  const token = await zugangstoken(v.refresh_token!);
  const res = await fetch(`${API}${pfad}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 204 || res.status === 410) return undefined as T;
  if (!res.ok) throw new Error(`Google Kalender: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

function ereignis(t: KalenderTermin) {
  return {
    summary: t.titel,
    description: t.beschreibung,
    start: { dateTime: t.beginn.toISOString(), timeZone: "Europe/Berlin" },
    end: { dateTime: t.ende.toISOString(), timeZone: "Europe/Berlin" },
    extendedProperties: { private: { flcTerminId: t.id } },
  };
}

type GoogleEreignis = {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

const google: Kalender = {
  name: "Google Kalender",

  async verbunden() {
    return Boolean(await verbindung());
  },

  async eintragen(t) {
    const v = await verbindung();
    if (!v) return null;
    const e = await anfrage<{ id: string }>(v, `/calendars/${encodeURIComponent(v.kalender_id)}/events`, {
      method: "POST",
      body: JSON.stringify(ereignis(t)),
    });
    return e.id;
  },

  async aendern(eventId, t) {
    const v = await verbindung();
    if (!v) return;
    await anfrage(v, `/calendars/${encodeURIComponent(v.kalender_id)}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(ereignis(t)),
    });
  },

  async entfernen(eventId) {
    const v = await verbindung();
    if (!v) return;
    try {
      await anfrage(v, `/calendars/${encodeURIComponent(v.kalender_id)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
    } catch (error) {
      // Schon in Google gelöscht: nichts zu tun
      if (!String(error).includes("HTTP 404")) throw error;
    }
  },

  async abgleichen() {
    const v = await verbindung();
    if (!v) return { anzahl: 0 };
    const { buchung } = await einstellungen();
    const heute = berlinDatum();
    const von = berlin(plusTage(heute, -1));
    const bis = berlin(plusTage(heute, buchung.maxTage + 2));

    const eintraege: GoogleEreignis[] = [];
    let seite: string | undefined;
    do {
      const q = new URLSearchParams({
        timeMin: von.toISOString(),
        timeMax: bis.toISOString(),
        singleEvents: "true",
        showDeleted: "false",
        maxResults: "2500",
        ...(seite ? { pageToken: seite } : {}),
      });
      const antwort = await anfrage<{ items?: GoogleEreignis[]; nextPageToken?: string }>(
        v,
        `/calendars/${encodeURIComponent(v.kalender_id)}/events?${q}`,
      );
      eintraege.push(...(antwort.items ?? []));
      seite = antwort.nextPageToken;
    } while (seite);

    const zeilen = eintraege
      .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent" && !e.extendedProperties?.private?.flcTerminId)
      .map((e) => {
        const ganztaegig = Boolean(e.start?.date);
        return {
          event_id: e.id,
          ganztaegig,
          titel: (e.summary ?? "").slice(0, 200),
          beginn: (ganztaegig ? berlin(e.start!.date!) : new Date(e.start!.dateTime!)).toISOString(),
          ende: (ganztaegig ? berlin(e.end!.date!) : new Date(e.end!.dateTime!)).toISOString(),
          aktualisiert_am: new Date().toISOString(),
        };
      })
      .filter((z) => z.ende > z.beginn);

    if (zeilen.length) {
      const { error } = await db().from("kalender_belegungen").upsert(zeilen, { onConflict: "event_id" });
      if (error) throw new Error(error.message);
    }
    // Was im Zeitraum nicht mehr in Google steht, ist gelöscht oder verschoben worden
    const behalten = zeilen.map((z) => z.event_id);
    let loeschen = db().from("kalender_belegungen").delete().lt("beginn", bis.toISOString()).gt("ende", von.toISOString());
    if (behalten.length) loeschen = loeschen.not("event_id", "in", `(${behalten.map((id) => `"${id}"`).join(",")})`);
    await loeschen;
    await db().from("kalender_belegungen").delete().lt("ende", von.toISOString());

    await db().from("kalender_verbindung").update({ letzter_sync: new Date().toISOString(), letzter_fehler: "" }).eq("id", 1);
    return { anzahl: zeilen.length };
  },

  async beobachten(erzwingen = false) {
    const v = await verbindung();
    if (!v || !ENV.siteUrl.startsWith("https://")) return;
    const laeuftNoch = v.kanal_ablauf && new Date(v.kanal_ablauf).getTime() > Date.now() + 2 * 86400000;
    if (laeuftNoch && !erzwingen) return;

    if (v.kanal_id && v.kanal_resource_id) {
      await anfrage(v, "/channels/stop", { method: "POST", body: JSON.stringify({ id: v.kanal_id, resourceId: v.kanal_resource_id }) }).catch(
        () => undefined,
      );
    }
    const kanalToken = randomUUID();
    const kanal = await anfrage<{ id: string; resourceId: string; expiration: string }>(
      v,
      `/calendars/${encodeURIComponent(v.kalender_id)}/events/watch`,
      {
        method: "POST",
        body: JSON.stringify({
          id: randomUUID(),
          type: "web_hook",
          address: `${ENV.siteUrl}/api/google/webhook`,
          token: kanalToken,
          params: { ttl: String(7 * 24 * 3600) },
        }),
      },
    );
    await db()
      .from("kalender_verbindung")
      .update({
        kanal_id: kanal.id,
        kanal_resource_id: kanal.resourceId,
        kanal_token: kanalToken,
        kanal_ablauf: new Date(Number(kanal.expiration)).toISOString(),
      })
      .eq("id", 1);
  },
};

/** Ohne Google-Zugangsdaten: Termine leben nur in der Datenbank. */
const ohne: Kalender = {
  name: "Kein Kalender",
  verbunden: async () => false,
  eintragen: async () => null,
  aendern: async () => undefined,
  entfernen: async () => undefined,
  abgleichen: async () => ({ anzahl: 0 }),
  beobachten: async () => undefined,
};

export function kalender(): Kalender {
  return KONFIGURIERT.google ? google : ohne;
}

/** Abgleich, wenn der letzte länger als `minuten` her ist. Fehler blockieren die Terminvergabe nicht. */
export async function abgleichWennAlt(minuten = 5): Promise<void> {
  if (!KONFIGURIERT.google) return;
  try {
    const { data } = await db().from("kalender_verbindung").select("refresh_token, letzter_sync").eq("id", 1).maybeSingle();
    if (!data?.refresh_token) return;
    if (data.letzter_sync && Date.now() - new Date(data.letzter_sync).getTime() < minuten * 60000) return;
    await kalender().abgleichen();
  } catch (error) {
    console.error("Kalender-Abgleich fehlgeschlagen", error);
  }
}
