-- Zeitsteuerung (neu) einrichten, mit neu erzeugtem CRON_SECRET.
--
-- Für den Fall, dass das CRON_SECRET unbekannt ist (Vercel zeigt geheime Variablen nicht mehr an) oder die
-- Zeitsteuerung nie eingerichtet wurde. Ersetzt 20261108100100_zeitsteuerung.sql und
-- 20261121130000_zeitsteuerung_minuetlich.sql, beliebig oft ausführbar.
--
-- So geht's:
--   1. Unten die Adresse prüfen: dieselbe, unter der die Website läuft (ohne Schrägstrich am Ende).
--   2. Im Supabase-SQL-Editor ausführen. Das Ergebnis zeigt in der Spalte „cron_secret_fuer_vercel“ das
--      neue Geheimnis.
--   3. Diesen Wert in Vercel unter Settings → Environment Variables bei CRON_SECRET eintragen (alten Wert
--      überschreiben) und neu deployen. Erst danach nimmt die Website die Aufrufe an.
--   4. Nach ein, zwei Minuten zeigt die Werkstatt-App unter „Mehr“: „Zeitsteuerung läuft“.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('flc-takt') where exists (select 1 from cron.job where jobname = 'flc-takt');

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
  einstellung.geheimnis as cron_secret_fuer_vercel
from (
  select
    'https://flc-automotive.de' as adresse,
    -- 64 zufällige Hex-Zeichen aus zwei UUIDs (ohne zusätzliche Erweiterung)
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as geheimnis
) as einstellung;
