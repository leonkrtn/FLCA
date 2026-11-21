-- Zeitsteuerung jede Minute statt alle 10 Minuten.
--
-- Erinnerungen aus Notizen sollen zur eingestellten Uhrzeit kommen, nicht bis zu 10 Minuten später. Der Takt
-- ist idempotent (automatik_log) und leicht: Die schweren Aufgaben (Saison-Mail, DATEV, Aufräumen) laufen
-- weiterhin nur einmal am Tag bzw. im Monat.
--
-- Geändert wird nur der Zeitplan des bestehenden Jobs; Adresse und CRON_SECRET bleiben, wie sie in
-- 20261108100100_zeitsteuerung.sql eingetragen wurden. Gibt es den Job noch nicht, bitte zuerst jene
-- Migration (mit ersetzten Platzhaltern) ausführen und danach diese.

do $$
declare
  v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'flc-takt';
  if v_job is null then
    raise exception 'Die Zeitsteuerung ist noch nicht eingerichtet. Bitte zuerst 20261108100100_zeitsteuerung.sql mit Website-Adresse und CRON_SECRET ausführen, danach diese Migration.';
  end if;
  perform cron.alter_job(job_id := v_job, schedule := '* * * * *');
end;
$$;
