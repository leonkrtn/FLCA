import "server-only";
import { Resend } from "resend";
import { einstellungen } from "../einstellungen";
import { ENV, KONFIGURIERT } from "../env";
import { fehlerMelden, fehlerText, weich } from "../fehler";
import { absender, adresseZerlegen, MAIL_NAME_MUSTER } from "../mail/adressen";
import { mailPruefen, Warnung } from "../systemcheck/regeln";
import { testmodus } from "./testmodus";

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
  bcc?: string[];
  /** Zusätzliche Kopfzeilen (Message-ID, In-Reply-To, References für den Verlauf beim Empfänger) */
  kopfzeilen?: Record<string, string>;
  /** Liegt schon im Postfach (Versand aus dem Postfach selbst): nicht noch einmal unter „Gesendet“ ablegen */
  abgelegt?: boolean;
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
        from: mail.von ?? (await standardAbsenderText()),
        to: mail.an,
        cc: mail.cc?.length ? mail.cc : undefined,
        bcc: mail.bcc?.length ? mail.bcc : undefined,
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

/**
 * Absender für Systemmails und neue Mails aus dem Firmenpostfach: Name und Adresse aus Einstellungen → E-Mail,
 * sonst aus MAIL_FROM. Die Adresse liegt immer auf der Domain von MAIL_FROM (nur die ist bei Resend verifiziert).
 */
export async function standardAbsender(): Promise<{ name: string; adresse: string }> {
  const { mail, firma } = await einstellungen();
  const von = adresseZerlegen(ENV.mailFrom);
  const domain = von.adresse.split("@")[1] ?? "";
  const lokal = mail.standardAdresse.trim().toLowerCase();
  return {
    name: mail.absenderName.trim() || firma.name || von.name,
    adresse: lokal && MAIL_NAME_MUSTER.test(lokal) && domain ? `${lokal}@${domain}` : von.adresse,
  };
}

async function standardAbsenderText(): Promise<string> {
  const a = await standardAbsender();
  return absender(a.name, a.adresse);
}

/** Ohne Resend-Schlüssel: Mail ins Server-Log, damit sich alle Abläufe lokal durchspielen lassen. */
const konsole: Mailer = {
  async senden(mail) {
    console.info(`[E-Mail, nicht versendet] An: ${[mail.an].flat().join(", ")}\nBetreff: ${mail.betreff}\n\n${mail.text}\n`);
    return { ok: false, fehler: "E-Mail-Versand ist noch nicht eingerichtet (RESEND_API_KEY, MAIL_FROM)." };
  },
};

/**
 * Testmodus (Systemcheck): prüft Empfänger, Absender, Betreff, Inhalt und Anhänge und schreibt auf, was
 * gesendet worden wäre. Ruft Resend nie auf.
 */
const probe: Mailer = {
  async senden(mail) {
    let von = mail.von;
    const vorab: string[] = [];
    try {
      von ??= await standardAbsenderText();
    } catch (e) {
      vorab.push(`Absender: ${fehlerText(e)}`);
    }
    const fehler = [...vorab, ...mailPruefen({ ...mail, von })];
    const anhaenge = mail.anhaenge?.length ? ` (${mail.anhaenge.map((a) => a.dateiname).join(", ")})` : "";
    testmodus()?.push({ kanal: "mail", an: [mail.an].flat(), text: `${mail.betreff}${anhaenge}`, fehler });
    return fehler.length ? { ok: false, fehler: fehler.join(" ") } : { ok: true, id: "testmodus" };
  },
};

/**
 * Jede Mail, die die Anwendung von sich aus verschickt (Rechnung, Termin, Erinnerung, Hinweis ans Büro), steht
 * danach im Firmenpostfach unter „Gesendet“, gescheitert im Postausgang. So sieht das Büro an einer Stelle, was
 * rausging, und Antworten der Kunden landen im selben Gespräch. Das Ablegen darf den Versand nie umwerfen.
 */
const mitAblage: Mailer = {
  async senden(mail) {
    const ergebnis = await resend.senden(mail);
    if (!mail.abgelegt) {
      // Dynamisch, weil das Postfach selbst über diese Datei sendet
      await weich(async () => (await import("../mail/postfach")).versandAblegen(mail, ergebnis), undefined, "Gesendete Mail ablegen");
    }
    return ergebnis;
  },
};

export function mailer(): Mailer {
  if (testmodus()) return probe;
  return KONFIGURIERT.email ? mitAblage : konsole;
}

/**
 * Nur lesend (Systemcheck): Ist der Resend-Schlüssel gültig und die Domain von MAIL_FROM verifiziert? Sendet
 * nichts. Ein Schlüssel, der nur senden darf, kann die Domains nicht lesen: dann Gelb statt Rot.
 */
export async function resendPruefen(): Promise<string> {
  if (!KONFIGURIERT.email) throw new Warnung("E-Mail-Versand ist nicht eingerichtet (RESEND_API_KEY, MAIL_FROM fehlen in Vercel).");
  const domain = adresseZerlegen(ENV.mailFrom).adresse.split("@")[1] ?? "";
  const { data, error } = await new Resend(ENV.resendApiKey).domains.list();
  if (error) {
    if (error.name === "restricted_api_key") throw new Warnung("Der Resend-Schlüssel darf nur senden. Ob die Domain verifiziert ist, lässt sich damit nicht prüfen.");
    throw new Error(`Resend: ${error.message}`);
  }
  const eintrag = data?.data.find((d) => d.name.toLowerCase() === domain);
  if (!eintrag) throw new Error(`Die Domain ${domain || "(leer)"} aus MAIL_FROM ist bei Resend nicht angelegt.`);
  if (eintrag.status !== "verified") throw new Error(`Die Domain ${domain} ist bei Resend nicht verifiziert (Stand: ${eintrag.status}).`);
  return `Schlüssel gültig, ${domain} ist verifiziert.`;
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

export type WebhookMeldung =
  | { art: "eingang"; id: string }
  | { art: "gesendet"; id: string; messageId: string }
  | { art: "zustellung"; id: string; stand: "zugestellt" | "verzoegert" | "abgewiesen" | "beschwerde"; grund?: string }
  | null;

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
  // Zustellstatus für „Gesendet“: zugestellt, verzögert, abgewiesen (Adresse falsch, Postfach voll), als Spam gemeldet
  if (ereignis.type === "email.delivered") return { art: "zustellung", id: ereignis.data.email_id, stand: "zugestellt" };
  if (ereignis.type === "email.delivery_delayed") return { art: "zustellung", id: ereignis.data.email_id, stand: "verzoegert" };
  if (ereignis.type === "email.bounced") return { art: "zustellung", id: ereignis.data.email_id, stand: "abgewiesen", grund: ereignis.data.bounce?.message };
  if (ereignis.type === "email.complained") return { art: "zustellung", id: ereignis.data.email_id, stand: "beschwerde" };
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
