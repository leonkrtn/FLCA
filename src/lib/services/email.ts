import "server-only";
import { Resend } from "resend";
import { ENV, KONFIGURIERT } from "../env";
import { fehlerMelden } from "../fehler";

export type Mail = {
  an: string | string[];
  betreff: string;
  html: string;
  text: string;
  antwortAn?: string;
  anhaenge?: { dateiname: string; inhalt: Buffer; typ?: string }[];
  /** Absender, sonst MAIL_FROM (Postfach in der Anwendung: Person oder Firmenadresse) */
  von?: string;
  cc?: string[];
  /** Zusätzliche Kopfzeilen (Message-ID, In-Reply-To, References für den Verlauf beim Empfänger) */
  kopfzeilen?: Record<string, string>;
};

export type Versandergebnis = { ok: true; id?: string } | { ok: false; fehler: string };

/** Schnittstelle für den Mailversand. Feature-Code kennt nur diese, nie Resend direkt. */
export interface Mailer {
  senden(mail: Mail): Promise<Versandergebnis>;
}

const resend: Mailer = {
  async senden(mail) {
    try {
      const { data, error } = await new Resend(ENV.resendApiKey).emails.send({
        from: mail.von ?? ENV.mailFrom,
        to: mail.an,
        cc: mail.cc?.length ? mail.cc : undefined,
        headers: mail.kopfzeilen,
        subject: mail.betreff,
        html: mail.html,
        text: mail.text,
        replyTo: mail.antwortAn,
        attachments: mail.anhaenge?.map((a) => ({ filename: a.dateiname, content: a.inhalt, contentType: a.typ })),
      });
      if (error) {
        await fehlerMelden(new Error(`Resend: ${error.message}`), "E-Mail senden");
        return { ok: false, fehler: error.message };
      }
      return { ok: true, id: data?.id };
    } catch (error) {
      await fehlerMelden(error, "E-Mail senden");
      return { ok: false, fehler: "E-Mail konnte nicht versendet werden." };
    }
  },
};

/** Ohne Resend-Schlüssel: Mail ins Server-Log, damit sich alle Abläufe lokal durchspielen lassen. */
const konsole: Mailer = {
  async senden(mail) {
    console.info(`[E-Mail, nicht versendet] An: ${[mail.an].flat().join(", ")}\nBetreff: ${mail.betreff}\n\n${mail.text}\n`);
    return { ok: false, fehler: "E-Mail-Versand ist noch nicht eingerichtet (RESEND_API_KEY, MAIL_FROM)." };
  },
};

export function mailer(): Mailer {
  return KONFIGURIERT.email ? resend : konsole;
}

// ---------------------------------------------------------------------------
// Eingang: Resend nimmt die Mails der Domain an (MX) und meldet jede per Webhook. Feature-Code kennt nur
// diese Funktionen, nie Resend direkt.
// ---------------------------------------------------------------------------

export type EingangsMail = {
  id: string;
  von: string;
  an: string[];
  cc: string[];
  /** Tatsächliche Empfänger, auch BCC und Weiterleitungen */
  fuer: string[];
  antwortAn: string | null;
  betreff: string;
  text: string | null;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  referenzen: string | null;
  erhalten: string;
  anhaenge: { id: string; name: string; typ: string; groesse: number; inline: boolean }[];
};

export type WebhookMeldung = { art: "eingang"; id: string } | { art: "gesendet"; id: string; messageId: string } | null;

/**
 * Prüft die Signatur des Webhooks (Svix) und sagt, was er meldet: eine eingegangene Mail oder die
 * Message-ID einer gesendeten (damit Antworten darauf ihr Gespräch finden). Wirft bei falscher Signatur.
 */
export function webhookPruefen(roh: string, kopf: Headers): WebhookMeldung {
  const ereignis = new Resend(ENV.resendApiKey).webhooks.verify({
    payload: roh,
    headers: { id: kopf.get("svix-id") ?? "", timestamp: kopf.get("svix-timestamp") ?? "", signature: kopf.get("svix-signature") ?? "" },
    webhookSecret: ENV.resendWebhookSecret,
  });
  if (ereignis.type === "email.received") return { art: "eingang", id: ereignis.data.email_id };
  if (ereignis.type === "email.sent" && ereignis.data.message_id) return { art: "gesendet", id: ereignis.data.email_id, messageId: ereignis.data.message_id };
  return null;
}

/** Ganze Mail mit Inhalt holen (der Webhook enthält nur Kopfdaten). Bilder im Text kommen als data:-Adressen. */
export async function eingangLaden(id: string): Promise<EingangsMail> {
  const { data, error } = await new Resend(ENV.resendApiKey).emails.receiving.get(id);
  if (error || !data) throw new Error(`Resend: Mail ${id} nicht lesbar (${error?.message ?? "leer"})`);
  // Kopfzeilen kommen je nach Absender groß oder klein geschrieben
  const kopf = (name: string) => Object.entries(data.headers ?? {}).find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
  return {
    id: data.id,
    von: data.from,
    an: data.to ?? [],
    cc: data.cc ?? [],
    fuer: data.received_for?.length ? data.received_for : [...(data.to ?? []), ...(data.cc ?? [])],
    antwortAn: data.reply_to?.[0] ?? null,
    betreff: data.subject ?? "",
    text: data.text,
    html: data.html,
    messageId: data.message_id || kopf("message-id"),
    inReplyTo: kopf("in-reply-to"),
    referenzen: kopf("references"),
    erhalten: data.created_at,
    anhaenge: (data.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.filename || "Anhang",
      typ: a.content_type,
      groesse: a.size,
      // Im Text eingebettete Bilder stehen schon als data:-Adresse im HTML
      inline: Boolean(a.content_id) && a.content_disposition !== "attachment",
    })),
  };
}

/** Inhalt eines Anhangs (über den kurzlebigen Link von Resend). */
export async function eingangAnhang(mailId: string, anhangId: string): Promise<Buffer> {
  const { data, error } = await new Resend(ENV.resendApiKey).emails.receiving.attachments.get({ emailId: mailId, id: anhangId });
  if (error || !data) throw new Error(`Resend: Anhang nicht lesbar (${error?.message ?? "leer"})`);
  const res = await fetch(data.download_url);
  if (!res.ok) throw new Error(`Resend: Anhang nicht ladbar (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
