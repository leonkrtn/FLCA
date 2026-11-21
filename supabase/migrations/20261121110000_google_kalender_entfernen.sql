-- Google-Kalender entfernt.
--
-- Termine leben nur noch im System (Wochenkalender in der Verwaltung). Bisher blockierten Einträge, die
-- direkt in Google gemacht wurden, freie Zeiten (Kopie in kalender_belegungen); das entfällt. Freie Zeiten
-- ergeben sich jetzt nur aus Öffnungszeiten, Kapazität und den Terminen im System.
--
-- Reihenfolge: zuerst belegung_max ohne kalender_belegungen neu anlegen (termin_anlegen, termin_bestaetigen
-- und termin_verschieben rufen sie auf), dann die Tabellen und die Spalte löschen. p_kapazitaet bleibt in der
-- Signatur, obwohl sie hier nicht mehr gebraucht wird: So bleiben Aufrufe und Rechte unverändert.

create or replace function public.belegung_max(p_beginn timestamptz, p_bis timestamptz, p_ausser uuid, p_kapazitaet integer)
returns integer language sql stable set search_path = '' as $$
  with belegt as (
    select t.beginn, t.belegt_bis as bis, 1 as gewicht
    from public.termine t
    where t.id is distinct from p_ausser
      and t.beginn < p_bis and t.belegt_bis > p_beginn
      and (t.status = 'bestaetigt' or (t.status = 'angefragt' and (t.halten_bis is null or t.halten_bis > now())))
  ),
  punkte as (
    select p_beginn as zeitpunkt
    union
    select b.beginn from belegt b where b.beginn > p_beginn and b.beginn < p_bis
  )
  select coalesce(max(summe), 0)::integer from (
    select (select coalesce(sum(b.gewicht), 0) from belegt b where b.beginn <= p.zeitpunkt and b.bis > p.zeitpunkt) as summe
    from punkte p
  ) s;
$$;

drop table if exists public.kalender_belegungen;
drop table if exists public.kalender_verbindung;
alter table public.termine drop column if exists google_event_id;
