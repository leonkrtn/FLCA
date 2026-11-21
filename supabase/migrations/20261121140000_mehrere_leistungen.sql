-- Mehrere Leistungen pro Termin.
--
-- Kunden bringen das Auto oft für mehreres auf einmal (Radwechsel und Ölwechsel). Bisher musste dafür ein
-- Termin pro Leistung angefragt werden, die dann auch noch gleichzeitig zwei Arbeitsplätze belegten.
-- Jetzt trägt ein Termin eine Liste von Leistungen; die Dauer ist die Summe, belegt wird ein Arbeitsplatz.
--
-- leistung_id bleibt (erste Leistung) und leistung_name enthält alle Namen mit Komma getrennt: So zeigen
-- Listen, Kalender, Mails und die API ohne Änderung alles an.

alter table public.termine add column if not exists leistung_ids uuid[] not null default '{}';

update public.termine set leistung_ids = array[leistung_id] where leistung_id is not null and leistung_ids = '{}';

-- Gleiche Signatur wie bisher, damit Rechte und Aufrufe bleiben. Neu ist nur leistung_ids im JSON; fehlt es,
-- gilt leistung_id allein.
create or replace function public.termin_anlegen(p jsonb, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_beginn timestamptz := (p ->> 'beginn')::timestamptz;
  v_bis timestamptz := (p ->> 'belegt_bis')::timestamptz;
  v_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  if not p_ueberbuchen and public.belegung_max(v_beginn, v_bis, null, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p -> 'leistung_ids') = 'array' then
    select coalesce(array_agg(x::uuid order by n), '{}') into v_ids from jsonb_array_elements_text(p -> 'leistung_ids') with ordinality as e(x, n);
  elsif p ->> 'leistung_id' is not null then
    v_ids := array[(p ->> 'leistung_id')::uuid];
  else
    v_ids := '{}';
  end if;

  insert into public.termine (
    status, beginn, ende, belegt_bis, leistung_id, leistung_ids, leistung_name, kunde_id, fahrzeug_id,
    notiz_kunde, notiz_intern, quelle, halten_bis, zugewiesen_an, bestaetigt_am
  ) values (
    coalesce((p ->> 'status')::public.termin_status, 'angefragt'),
    v_beginn,
    (p ->> 'ende')::timestamptz,
    v_bis,
    coalesce((p ->> 'leistung_id')::uuid, v_ids[1]),
    v_ids,
    p ->> 'leistung_name',
    (p ->> 'kunde_id')::uuid,
    (p ->> 'fahrzeug_id')::uuid,
    coalesce(p ->> 'notiz_kunde', ''),
    coalesce(p ->> 'notiz_intern', ''),
    coalesce(p ->> 'quelle', 'website'),
    (p ->> 'halten_bis')::timestamptz,
    (p ->> 'zugewiesen_an')::uuid,
    case when p ->> 'status' = 'bestaetigt' then now() end
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.termin_anlegen(jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.termin_anlegen(jsonb, integer, boolean) to service_role;
