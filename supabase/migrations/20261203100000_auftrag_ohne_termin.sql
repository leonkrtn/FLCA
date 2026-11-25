-- Werkstattauftrag ohne Termin.
--
-- Ein angenommener Kostenvoranschlag ist sofort ein erteilter Auftrag, auch wenn noch niemand weiß, wann das
-- Auto kommt. Der Auftrag hängt weiter an einer Zeile in `termine` (Uhr, Befunde, Fotos, Rechnung, PDF und
-- Kundenbildschirm bauen darauf), nur eben ohne Uhrzeit: Stand „ungeplant“, beginn/ende/belegt_bis leer.
-- Eingeplant wird später über `termin_einplanen` (Büro: gleich bestätigt; Kunde über seinen Link: als
-- Anfrage), mit derselben Prüfung der Arbeitsplätze und Personen wie bei jedem Termin.
--
-- Ein ungeplanter Auftrag belegt nichts: belegung_max und person_belegt zählen nur 'bestaetigt' und
-- 'angefragt', Kalender und Listen fragen nach Zeiträumen und sehen ihn deshalb nicht.
--
-- Der neue Wert wird in diesem Skript nur als Text verglichen (status::text), nie als Enum-Literal: Postgres
-- erlaubt einen frisch angelegten Enum-Wert erst nach dem Abschluss der Transaktion, und der SQL-Editor führt
-- das ganze Skript in einer aus.

alter type public.termin_status add value if not exists 'ungeplant';

alter table public.termine
  alter column beginn drop not null,
  alter column ende drop not null,
  alter column belegt_bis drop not null;

-- Zeiten gibt es nur zusammen. Ohne Zeit ist ein Termin ungeplant oder (als ungeplanter Auftrag) abgesagt.
alter table public.termine drop constraint if exists termine_zeit_pruefen;
alter table public.termine add constraint termine_zeit_pruefen check (
  (beginn is null) = (ende is null)
  and (beginn is null) = (belegt_bis is null)
  and (status::text <> 'ungeplant' or beginn is null)
  and (beginn is not null or status::text in ('ungeplant', 'storniert'))
);

create index if not exists termine_ungeplant_idx on public.termine (auftrag_angelegt_am) where beginn is null;

-- Einen ungeplanten Auftrag einplanen. `p_status`: 'bestaetigt' (Büro trägt die Zeit ein) oder 'angefragt'
-- (Kunde wählt über seinen Link, hält die Zeit bis `p_halten_bis` wie jede Anfrage). Prüfung wie termin_anlegen.
create or replace function public.termin_einplanen(
  p_id uuid,
  p_beginn timestamptz,
  p_ende timestamptz,
  p_bis timestamptz,
  p_person uuid,
  p_status text,
  p_halten_bis timestamptz,
  p_kapazitaet integer,
  p_ueberbuchen boolean default false
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.termine;
begin
  if p_status not in ('angefragt', 'bestaetigt') then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select * into v from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v.status::text <> 'ungeplant' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;

  if not p_ueberbuchen and public.belegung_max(p_beginn, p_bis, p_id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  if not p_ueberbuchen and p_person is not null and public.person_belegt(p_person, p_beginn, p_bis, p_id) then
    raise exception 'PERSON_BELEGT' using errcode = 'P0001';
  end if;

  update public.termine
  set status = p_status::public.termin_status,
      beginn = p_beginn,
      ende = p_ende,
      belegt_bis = p_bis,
      zugewiesen_an = p_person,
      halten_bis = case when p_status = 'angefragt' then p_halten_bis end,
      bestaetigt_am = case when p_status = 'bestaetigt' then now() end
  where id = p_id;
end;
$$;

revoke execute on function public.termin_einplanen(uuid, timestamptz, timestamptz, timestamptz, uuid, text, timestamptz, integer, boolean) from public, anon, authenticated;
grant execute on function public.termin_einplanen(uuid, timestamptz, timestamptz, timestamptz, uuid, text, timestamptz, integer, boolean) to service_role;

-- Ein Kunde mit einem Auftrag, der noch auf seinen Termin wartet, hat etwas Laufendes: nicht löschen.
create or replace function public.kunde_loeschen(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nummer integer;
  v_fahrzeuge integer;
  v_alt integer;
begin
  select nummer into v_nummer from public.kunden where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;

  if exists (
    select 1 from public.termine
    where kunde_id = p_id
      and (
        status::text = 'ungeplant'
        or (status::text in ('angefragt', 'bestaetigt') and (belegt_bis >= now() or auftrag_status = 'in_arbeit'))
      )
  ) then
    raise exception 'KUNDE_HAT_TERMINE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.einlagerungen where kunde_id = p_id and ausgelagert_am is null) then
    raise exception 'KUNDE_HAT_EINLAGERUNG' using errcode = 'P0001';
  end if;

  delete from public.alt_rechnungen where kunde_id = p_id;
  get diagnostics v_alt = row_count;
  delete from public.fahrzeuge where kunde_id = p_id;
  get diagnostics v_fahrzeuge = row_count;
  delete from public.kunden where id = p_id;

  return jsonb_build_object('nummer', v_nummer, 'fahrzeuge', v_fahrzeuge, 'fruehere_rechnungen', v_alt);
end;
$$;

revoke execute on function public.kunde_loeschen(uuid) from public, anon, authenticated;
grant execute on function public.kunde_loeschen(uuid) to service_role;
