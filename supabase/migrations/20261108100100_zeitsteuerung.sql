-- Zeitsteuerung: Supabase ruft alle 10 Minuten /api/cron/takt auf.
--
-- Warum nicht Vercel Cron? Auf dem kostenlosen Vercel-Tarif läuft ein Cron höchstens einmal am Tag. Die
-- Erinnerung 24 Stunden vor dem Termin, das Erneuern der Google-Kalender-Verbindung und die Webhook-
-- Wiederholungen brauchen einen dichteren Takt. pg_cron und pg_net gibt es auch im kostenlosen Supabase-Tarif.
-- Die Route ist idempotent (automatik_log), ein doppelter Aufruf schadet nicht.
--
-- VOR DEM AUSFÜHREN die beiden Platzhalter ersetzen:
--   <<WEBSITE_URL>>   z. B. https://flc-automotive.de  (ohne Schrägstrich am Ende)
--   <<CRON_SECRET>>   derselbe Wert wie die Umgebungsvariable CRON_SECRET in Vercel

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('flc-takt') where exists (select 1 from cron.job where jobname = 'flc-takt');

select cron.schedule(
  'flc-takt',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := '<<WEBSITE_URL>>/api/cron/takt',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<<CRON_SECRET>>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
