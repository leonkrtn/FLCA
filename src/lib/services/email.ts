import "server-only";
import { Resend } from "resend";
import { ENV, KONFIGURIERT } from "../env";

export type Mail = {
  an: string | string[];
  betreff: string;
  html: string;
  text: string;
  antwortAn?: string;
  anhaenge?: { dateiname: string; inhalt: Buffer; typ?: string }[];
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
        from: ENV.mailFrom,
        to: mail.an,
        subject: mail.betreff,
        html: mail.html,
        text: mail.text,
        replyTo: mail.antwortAn,
        attachments: mail.anhaenge?.map((a) => ({ filename: a.dateiname, content: a.inhalt, contentType: a.typ })),
      });
      if (error) return { ok: false, fehler: error.message };
      return { ok: true, id: data?.id };
    } catch (error) {
      console.error("E-Mail konnte nicht versendet werden", error);
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
