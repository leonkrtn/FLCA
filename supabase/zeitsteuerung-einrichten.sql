-- Zeitsteuerung einrichten: Supabase ruft jede Minute <adresse>/api/cron/takt auf.
--
-- Beliebig oft ausführbar. Ersetzt 20261108100100_zeitsteuerung.sql und
-- 20261121130000_zeitsteuerung_minuetlich.sql.
--
-- Geheimnis (CRON_SECRET): Gibt es den Job schon mit einem Geheimnis aus diesem Skript, bleibt es; sonst
-- wird ein neues erzeugt. Das Ergebnis zeigt es immer in der Spalte „cron_secret_fuer_vercel“.
--
-- Erstes Einrichten (oder Geheimnis verloren):
--   1. Ausführen und den Wert aus „cron_secret_fuer_vercel“ kopieren.
--   2. In Vercel unter Settings → Environment Variables bei CRON_SECRET eintragen (alten Wert überschreiben)
--      und neu deployen. Erst danach nimmt die Website die Aufrufe an.
--   3. Nach ein, zwei Minuten zeigt die Werkstatt-App unter „Mehr“: „Zeitsteuerung läuft“.
--
-- Adresse ändern (z. B. nach einem Domainwechsel): unten die Adresse anpassen und erneut ausführen.
-- Das Geheimnis bleibt dasselbe, in Vercel ist dafür nichts zu ändern.
--
-- Ganz neues Geheimnis erzwingen: vorher  select cron.unschedule('flc-takt');  ausführen.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule mit einem vorhandenen Namen ändert den Job, statt einen zweiten anzulegen.
select
  cron.schedule(
    'flc-takt',
    '* * * * *',
    format(
      $f$select net.http_post(url := %L, headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', %L), body := '{}'::jsonb, timeout_milliseconds := 55000);$f$,
      einstellung.adresse || '/api/cron/takt',
      einstellung.geheimnis
    )
  ) as job,
  einstellung.adresse as aufgerufen_wird,
  einstellung.geheimnis as cron_secret_fuer_vercel
from (
  select
    -- Adresse der Website, ohne Schrägstrich am Ende
    'https://flcautomotive.de' as adresse,
    coalesce(
      -- Geheimnis aus dem bestehenden Job (64 Hex-Zeichen, wie dieses Skript sie erzeugt)
      (select substring(command from '[0-9a-f]{64}') from cron.job where jobname = 'flc-takt'),
      -- sonst neu: 64 zufällige Hex-Zeichen aus zwei UUIDs
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    ) as geheimnis
) as einstellung;
