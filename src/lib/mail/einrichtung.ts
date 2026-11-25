import "server-only";
import { resolveMx } from "node:dns/promises";
import { ENV, KONFIGURIERT } from "../env";
import { db } from "../supabase/admin";
import { mailDomain } from "./postfach";

export type Pruefung = { name: string; ok: boolean | null; text: string };

/**
 * Stand der Einrichtung für Einstellungen → E-Mail: Schlüssel in Vercel, MX-Eintrag der Domain, letzte
 * eingegangene Mail und letzter Fehler beim Empfang. `ok: null` = nicht prüfbar.
 */
export async function einrichtungPruefen(): Promise<Pruefung[]> {
  const domain = mailDomain();
  const liste: Pruefung[] = [
    { name: "Resend-Schlüssel", ok: Boolean(ENV.resendApiKey), text: ENV.resendApiKey ? "RESEND_API_KEY ist gesetzt." : "RESEND_API_KEY fehlt in Vercel." },
    { name: "Absender", ok: Boolean(ENV.mailFrom && domain), text: ENV.mailFrom ? `MAIL_FROM: ${ENV.mailFrom}` : "MAIL_FROM fehlt in Vercel." },
    {
      name: "Webhook",
      ok: Boolean(ENV.resendWebhookSecret),
      text: ENV.resendWebhookSecret ? `RESEND_WEBHOOK_SECRET ist gesetzt. Endpunkt: ${ENV.siteUrl}/api/mail/eingang` : "RESEND_WEBHOOK_SECRET fehlt in Vercel.",
    },
  ];

  if (domain) {
    try {
      const mx = await resolveMx(domain);
      const resend = mx.some((m) => /rmta\.net$|resend/i.test(m.exchange));
      liste.push({
        name: "MX-Eintrag",
        ok: resend,
        text: mx.length ? `${mx.map((m) => `${m.exchange} (${m.priority})`).join(", ")}${resend ? "" : ": zeigt nicht auf Resend, Mails kommen woanders an."}` : "Kein MX-Eintrag gefunden.",
      });
    } catch {
      liste.push({ name: "MX-Eintrag", ok: false, text: `Für ${domain} ist kein MX-Eintrag zu finden.` });
    }
  }

  const [{ data: letzte }, { data: fehler }] = await Promise.all([
    db().from("mails").select("erstellt_am, von").eq("richtung", "eingang").order("erstellt_am", { ascending: false }).limit(1),
    db().from("fehlerprotokoll").select("ort, meldung").is("erledigt_am", null).ilike("ort", "%Mail%").order("zuletzt_am", { ascending: false }).limit(1),
  ]);
  const l = letzte?.[0];
  liste.push({
    name: "Empfang",
    ok: l ? true : KONFIGURIERT.mailEingang ? null : false,
    text: l ? `Zuletzt eingegangen: ${new Date(l.erstellt_am as string).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} von ${l.von}` : "Noch keine Mail eingegangen. „Testmail senden“ prüft den ganzen Weg.",
  });
  const f = fehler?.[0];
  if (f) liste.push({ name: "Letzter Fehler", ok: null, text: `${String(f.ort)}: ${String(f.meldung).slice(0, 200)}` });
  return liste;
}
