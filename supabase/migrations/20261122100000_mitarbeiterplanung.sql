-- Mitarbeiterplanung.
--
-- Bisher zählte für freie Termine nur die Zahl der Arbeitsplätze (Einstellung „Fahrzeuge gleichzeitig“). Jetzt
-- muss zusätzlich ein Mitarbeiter frei sein, der zu der Zeit arbeitet, nicht abwesend ist und alle gewählten
-- Leistungen machen darf. Wer Aufträge annimmt, steht am Profil (nimmt_auftraege). Solange niemand so markiert
-- ist, bleibt alles wie bisher (nur Arbeitsplätze), damit nach dem Einspielen keine Lücke auf der Website entsteht.
--
-- Arbeitszeiten, Ausnahmen, Abwesenheiten und Fähigkeiten rechnet die App (src/lib/planung.ts); die Datenbank
-- prüft unter derselben Sperre wie bisher zusätzlich, dass die zugeteilte Person zu der Zeit keinen anderen Termin
-- hat. So bekommen zwei gleichzeitige Anfragen nie dieselbe Person.

-- Häkchen „nimmt Aufträge an“ (auch für den Inhaber setzbar)
alter table public.profile add column if not exists nimmt_auftraege boolean not null default false;

-- Wechselnde Wochen: ein Zeitfenster gilt jede Woche oder nur in geraden bzw. ungeraden Kalenderwochen (ISO).
alter table public.arbeitszeiten add column if not exists woche text not null default 'jede';
alter table public.arbeitszeiten drop constraint if exists arbeitszeiten_woche_check;
alter table public.arbeitszeiten add constraint arbeitszeiten_woche_check check (woche in ('jede', 'gerade', 'ungerade'));

-- Halbe Tage: Abwesenheit mit Uhrzeit, dann nur für einen einzelnen Tag (Arzttermin, halber Urlaubstag).
alter table public.abwesenheiten add column if not exists von_zeit time;
alter table public.abwesenheiten add column if not exists bis_zeit time;
alter table public.abwesenheiten drop constraint if exists abwesenheiten_stunden_check;
alter table public.abwesenheiten add constraint abwesenheiten_stunden_check check (
  (von_zeit is null and bis_zeit is null)
  or (von = bis and von_zeit is not null and bis_zeit is not null and bis_zeit > von_zeit)
);

-- Abweichende Arbeitszeit an einem einzelnen Datum. fenster wie die Öffnungszeiten: [["08:00","12:00"], …];
-- eine leere Liste heißt „an dem Tag frei“.
create table if not exists public.arbeitszeit_ausnahmen (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profile (id) on delete cascade,
  datum date not null,
  fenster jsonb not null default '[]',
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  unique (profil_id, datum),
  check (jsonb_typeof(fenster) = 'array')
);

-- Was jemand NICHT machen darf. Gespeichert wird die Ausnahme, damit neue Leistungen und neue Mitarbeiter
-- ohne weiteres Zutun für alle gelten (Standard „darf alles“).
create table if not exists public.leistung_sperren (
  profil_id uuid not null references public.profile (id) on delete cascade,
  leistung_id uuid not null references public.leistungen (id) on delete cascade,
  primary key (profil_id, leistung_id)
);

-- Abstand zur Werkstatt beim Einstempeln in Metern (Einstempeln nur vor Ort), zum Nachvollziehen.
alter table public.zeiteintraege add column if not exists abstand_m integer;

create index if not exists termine_offen_ohne_person_idx on public.termine (beginn) where zugewiesen_an is null;

-- ---------------------------------------------------------------------------
-- Prüfungen in der Datenbank
-- ---------------------------------------------------------------------------

-- Hat die Person im Zeitraum [p_beginn, p_bis) schon einen Termin (ohne p_ausser)? Es zählt, was auch
-- Arbeitsplätze belegt: bestätigte Termine und Anfragen, deren Haltezeit noch läuft.
create or replace function public.person_belegt(p_profil uuid, p_beginn timestamptz, p_bis timestamptz, p_ausser uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.termine t
    where t.zugewiesen_an = p_profil
      and t.id is distinct from p_ausser
      and t.beginn < p_bis and t.belegt_bis > p_beginn
      and (t.status = 'bestaetigt' or (t.status = 'angefragt' and (t.halten_bis is null or t.halten_bis > now())))
  );
$$;

-- Wie bisher, dazu: Die zugeteilte Person darf zu der Zeit nichts anderes haben (Fehler PERSON_BELEGT).
create or replace function public.termin_anlegen(p jsonb, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_beginn timestamptz := (p ->> 'beginn')::timestamptz;
  v_bis timestamptz := (p ->> 'belegt_bis')::timestamptz;
  v_person uuid := (p ->> 'zugewiesen_an')::uuid;
  v_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  if not p_ueberbuchen and public.belegung_max(v_beginn, v_bis, null, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  if not p_ueberbuchen and v_person is not null and public.person_belegt(v_person, v_beginn, v_bis, null) then
    raise exception 'PERSON_BELEGT' using errcode = 'P0001';
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
    v_person,
    case when p ->> 'status' = 'bestaetigt' then now() end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.termin_bestaetigen(p_id uuid, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.termine;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select * into v from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v.status <> 'angefragt' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;

  if not p_ueberbuchen and public.belegung_max(v.beginn, v.belegt_bis, v.id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  if not p_ueberbuchen and v.zugewiesen_an is not null and public.person_belegt(v.zugewiesen_an, v.beginn, v.belegt_bis, v.id) then
    raise exception 'PERSON_BELEGT' using errcode = 'P0001';
  end if;

  update public.termine set status = 'bestaetigt', halten_bis = null, bestaetigt_am = now() where id = p_id;
end;
$$;

-- Bleibt für ältere Aufrufe; die App nutzt termin_umplanen.
create or replace function public.termin_verschieben(p_id uuid, p_beginn timestamptz, p_ende timestamptz, p_bis timestamptz, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_person uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select zugewiesen_an into v_person from public.termine where id = p_id;
  if not p_ueberbuchen and public.belegung_max(p_beginn, p_bis, p_id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  if not p_ueberbuchen and v_person is not null and public.person_belegt(v_person, p_beginn, p_bis, p_id) then
    raise exception 'PERSON_BELEGT' using errcode = 'P0001';
  end if;
  update public.termine set beginn = p_beginn, ende = p_ende, belegt_bis = p_bis where id = p_id;
end;
$$;

-- Zeit und Person eines offenen Termins in einem Schritt ändern (Verschieben, Zuteilen, Ziehen im Kalender).
-- Die Arbeitsplätze werden nur geprüft, wenn sich die Zeit ändert: Ein reiner Personenwechsel belegt keinen
-- Platz zusätzlich.
create or replace function public.termin_umplanen(p_id uuid, p_beginn timestamptz, p_ende timestamptz, p_bis timestamptz, p_person uuid, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.termine;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select * into v from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v.status not in ('angefragt', 'bestaetigt') then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;

  if not p_ueberbuchen and (v.beginn <> p_beginn or v.belegt_bis <> p_bis)
     and public.belegung_max(p_beginn, p_bis, p_id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  if not p_ueberbuchen and p_person is not null and public.person_belegt(p_person, p_beginn, p_bis, p_id) then
    raise exception 'PERSON_BELEGT' using errcode = 'P0001';
  end if;

  update public.termine
  set beginn = p_beginn, ende = p_ende, belegt_bis = p_bis, zugewiesen_an = p_person
  where id = p_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.person_belegt(uuid, timestamptz, timestamptz, uuid)',
    'public.termin_anlegen(jsonb, integer, boolean)',
    'public.termin_bestaetigen(uuid, integer, boolean)',
    'public.termin_verschieben(uuid, timestamptz, timestamptz, timestamptz, integer, boolean)',
    'public.termin_umplanen(uuid, timestamptz, timestamptz, timestamptz, uuid, integer, boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Neue Tabellen: wie alle anderen nur über den Server (RLS ohne Richtlinien)
do $$
declare
  t text;
begin
  foreach t in array array['arbeitszeit_ausnahmen', 'leistung_sperren'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
