"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { einstellungen } from "@/lib/einstellungen";
import { ENV } from "@/lib/env";
import { melden } from "@/lib/ereignisse";
import { type Ergebnis, istEmail, istSpam, istTelefon, sicher, text, werteAus } from "@/lib/forms";
import { imLimit } from "@/lib/limit";
import { mail } from "@/lib/email/vorlagen";
import { mailer } from "@/lib/services/email";
import { pushSenden } from "@/lib/services/push";
import { db } from "@/lib/supabase/admin";

const TYPEN: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 10 * 1024 * 1024;

/** Signierte Upload-Adresse für den Lebenslauf: Die Datei geht direkt vom Browser in den privaten Speicher. */
export async function uploadVorbereiten(typ: string, groesse: number): Promise<{ ok: true; pfad: string; url: string } | { ok: false; meldung: string }> {
  if (!TYPEN[typ]) return { ok: false, meldung: "Bitte eine PDF-, JPG- oder PNG-Datei wählen." };
  if (groesse > MAX_BYTES) return { ok: false, meldung: "Die Datei ist größer als 10 MB." };
  if ((await imLimit("upload")) !== "ok") return { ok: false, meldung: "Zu viele Uploads. Bitte später noch einmal versuchen." };
  const pfad = `eingang/${randomUUID()}.${TYPEN[typ]}`;
  const { data, error } = await db().storage.from("bewerbungen").createSignedUploadUrl(pfad);
  if (error || !data) return { ok: false, meldung: "Der Upload konnte nicht vorbereitet werden." };
  return { ok: true, pfad, url: data.signedUrl };
}

export async function bewerben(_v: Ergebnis, formData: FormData): Promise<Ergebnis> {
  return sicher(formData, async () => {
    const e = {
      stelle: text(formData, "stelle", 60),
      name: text(formData, "name", 120),
      telefon: text(formData, "telefon", 40),
      email: text(formData, "email", 160).toLowerCase(),
      nachricht: text(formData, "nachricht", 3000),
      lebenslauf: text(formData, "lebenslauf", 120),
      lebenslaufName: text(formData, "lebenslauf_name", 160),
    };
    const fehler: Record<string, string> = {};
    if (!e.name) fehler.name = "Bitte Ihren Namen angeben.";
    if (!istTelefon(e.telefon)) fehler.telefon = "Bitte eine Telefonnummer angeben, wir rufen Sie zurück.";
    if (e.email && !istEmail(e.email)) fehler.email = "Bitte eine gültige E-Mail-Adresse angeben oder das Feld leer lassen.";
    if (Object.keys(fehler).length) return { status: "fehler", fehler, werte: werteAus(formData), versuch: Date.now() };
    if (istSpam(formData)) return { status: "ok" };
    if ((await imLimit("bewerbung")) !== "ok") return { status: "fehler", meldung: "Zu viele Bewerbungen in kurzer Zeit. Bitte rufen Sie uns an.", werte: werteAus(formData), versuch: Date.now() };

    let stelleTitel = "Initiativbewerbung";
    let stelleId: string | null = null;
    if (e.stelle && e.stelle !== "initiativ") {
      const { data } = await db().from("stellen").select("id, titel").eq("id", e.stelle).eq("aktiv", true).maybeSingle();
      if (data) {
        stelleTitel = data.titel;
        stelleId = data.id;
      }
    }

    // Nur Pfade aus dem Eingangsordner, die es wirklich gibt
    let lebenslauf: string | null = null;
    if (/^eingang\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(e.lebenslauf)) {
      const { data } = await db().storage.from("bewerbungen").list("eingang", { search: e.lebenslauf.slice(8) });
      if (data?.length) lebenslauf = e.lebenslauf;
    }

    const { data: neu, error } = await db()
      .from("bewerbungen")
      .insert({
        stelle_id: stelleId,
        stelle: stelleTitel,
        name: e.name,
        telefon: e.telefon,
        email: e.email,
        nachricht: e.nachricht,
        lebenslauf_pfad: lebenslauf,
        lebenslauf_name: lebenslauf ? e.lebenslaufName || "Lebenslauf" : null,
      })
      .select("id, nummer")
      .single();
    if (error) throw new Error(error.message);

    after(async () => {
      const { firma, benachrichtigung } = await einstellungen();
      const intern = mail(firma, {
        ueberschrift: `Neue Bewerbung: ${stelleTitel}`,
        gruss: false,
        bausteine: [
          { art: "fakten", zeilen: [["Name", e.name], ["Telefon", e.telefon], ["E-Mail", e.email || "–"], ["Lebenslauf", lebenslauf ? "ja" : "nein"], ...(e.nachricht ? ([["Nachricht", e.nachricht]] as [string, string][]) : [])] },
          { art: "knopf", text: "Bewerbung öffnen", url: `${ENV.siteUrl}/admin/karriere/${neu.id}` },
        ],
      });
      await Promise.all([
        mailer().senden({ an: benachrichtigung.emails.length ? benachrichtigung.emails : [firma.email], betreff: `Neue Bewerbung: ${e.name}`, ...intern, antwortAn: e.email || undefined }),
        e.email
          ? mailer().senden({
              an: e.email,
              betreff: `Ihre Bewerbung bei ${firma.name}`,
              antwortAn: firma.email,
              ...mail(firma, {
                ueberschrift: "Danke für Ihre Bewerbung.",
                bausteine: [{ art: "absatz", text: `Hallo ${e.name},\nwir haben Ihre Bewerbung als ${stelleTitel} erhalten und melden uns in den nächsten Tagen telefonisch bei Ihnen.` }],
              }),
            })
          : Promise.resolve(),
        pushSenden({ rollen: ["inhaber"] }, { titel: "Neue Bewerbung", text: `${e.name} · ${stelleTitel}`, url: `/admin/karriere/${neu.id}` }),
        melden("bewerbung.eingegangen", { bewerbung_id: neu.id, nummer: neu.nummer, stelle: stelleTitel, name: e.name }),
      ]);
    });
    return { status: "ok" };
  });
}
