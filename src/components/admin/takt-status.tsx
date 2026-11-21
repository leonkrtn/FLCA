import { letzterTakt, taktLaeuft } from "@/lib/automatik";
import { datumZeit, zeit } from "@/lib/format";
import { jetztMs } from "@/lib/zeit";

/**
 * Läuft die Zeitsteuerung (Supabase ruft jede Minute /api/cron/takt)? Ohne sie kommen Erinnerungen per
 * Push nur, wenn jemand die App öffnet. `knapp`: nur der Warnhinweis, nichts, solange alles läuft.
 */
export async function TaktStatus({ knapp = false }: { knapp?: boolean }) {
  const zuletzt = await letzterTakt();
  if (taktLaeuft(zuletzt, jetztMs())) {
    return knapp ? null : <p className="text-sm text-grau">Zeitsteuerung läuft, zuletzt um {zeit(zuletzt!)} Uhr. Erinnerungen kommen zur eingestellten Minute.</p>;
  }
  return (
    <p className="border-l-2 border-rot bg-weiss px-4 py-3 text-sm">
      <strong>Die Zeitsteuerung läuft nicht</strong> ({zuletzt ? `zuletzt ${datumZeit(zuletzt)}` : "noch nie gelaufen"}). Erinnerungen per Push kommen dann nur, wenn jemand die App öffnet.
      Einrichtung: Migration „zeitsteuerung“ in Supabase mit der Website-Adresse und demselben CRON_SECRET wie in Vercel ausführen (README, Abschnitt Supabase).
    </p>
  );
}
