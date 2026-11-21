import { letzteAblehnung, letzterTakt, taktLaeuft } from "@/lib/automatik";
import { KONFIGURIERT } from "@/lib/env";
import { datumZeit, zeit } from "@/lib/format";
import { jetztMs } from "@/lib/zeit";

/**
 * Läuft die Zeitsteuerung (Supabase ruft jede Minute /api/cron/takt)? Ohne sie kommen Erinnerungen per
 * Push nur, wenn jemand die App öffnet. Läuft sie nicht, steht hier der wahrscheinliche Grund.
 * `knapp`: nur der Warnhinweis, nichts, solange alles läuft.
 */
export async function TaktStatus({ knapp = false }: { knapp?: boolean }) {
  const [zuletzt, abgelehnt] = await Promise.all([letzterTakt(), letzteAblehnung()]);
  const jetzt = jetztMs();
  if (taktLaeuft(zuletzt, jetzt)) {
    return knapp ? null : <p className="text-sm text-grau">Zeitsteuerung läuft, zuletzt um {zeit(zuletzt!)} Uhr. Erinnerungen kommen zur eingestellten Minute.</p>;
  }
  const grund = !KONFIGURIERT.cron
    ? "In Vercel fehlt die Umgebungsvariable CRON_SECRET. Bitte eintragen (derselbe Wert wie in der Migration „zeitsteuerung“) und neu deployen."
    : abgelehnt && jetzt - abgelehnt.getTime() < 10 * 60000
      ? `Supabase ruft an (zuletzt ${zeit(abgelehnt)} Uhr), aber das CRON_SECRET passt nicht zu dem in Vercel. Bitte in der Migration „zeitsteuerung“ denselben Wert eintragen und sie erneut ausführen.`
      : "Supabase ruft nicht an. Bitte im SQL-Editor die Migration „zeitsteuerung“ mit Website-Adresse und CRON_SECRET ausführen, danach „zeitsteuerung_minuetlich“ (README, Abschnitt Supabase).";
  return (
    <p className="border-l-2 border-rot bg-weiss px-4 py-3 text-sm">
      <strong>Die Zeitsteuerung läuft nicht</strong> ({zuletzt ? `zuletzt ${datumZeit(zuletzt)}` : "noch nie gelaufen"}). Erinnerungen per Push kommen dann nur, wenn jemand die App öffnet. {grund}
    </p>
  );
}
