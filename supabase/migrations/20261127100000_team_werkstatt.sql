-- Team-App für die Werkstatt.
--
-- 1. Planbar ist, wen die Werkstatt einplant, nicht wer sich selbst meldet. Personen mit der Rolle Mitarbeiter
--    sind deshalb immer planbar (die App setzt nimmt_auftraege beim Speichern); Inhaber und Büro nur, wenn die
--    Werkstatt sie zuschaltet. Bestehende Mitarbeiter werden hier einmal nachgezogen.
-- 2. Arbeitszeit je Auftrag (Start/Stopp am Termin), fließt als Lohnstunden in den Rechnungsentwurf.
-- 3. Meldungen aus der Werkstatt an das Büro: Befund (gefundener Mangel) oder Teil anfordern.
-- 4. Pausen beim Stempeln.

update public.profile set nimmt_auftraege = true where rolle = 'mitarbeiter' and aktiv and not nimmt_auftraege;

-- ---------------------------------------------------------------------------
-- Arbeitszeit je Auftrag
-- ---------------------------------------------------------------------------
create table if not exists public.auftrag_zeiten (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references public.termine (id) on delete cascade,
  profil_id uuid not null references public.profile (id) on delete cascade,
  beginn timestamptz not null default now(),
  ende timestamptz,
  check (ende is null or ende >= beginn)
);
create index if not exists auftrag_zeiten_termin_idx on public.auftrag_zeiten (termin_id);
-- Eine Person arbeitet immer nur an einem Auftrag zur Zeit: Ein zweiter Start schlägt fehl, die App stoppt
-- den laufenden vorher.
create unique index if not exists auftrag_zeiten_eine_laufend on public.auftrag_zeiten (profil_id) where ende is null;

-- ---------------------------------------------------------------------------
-- Meldungen aus der Werkstatt
-- ---------------------------------------------------------------------------
create table if not exists public.auftrag_meldungen (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references public.termine (id) on delete cascade,
  profil_id uuid references public.profile (id) on delete set null,
  art text not null check (art in ('befund', 'teil')),
  text text not null check (btrim(text) <> ''),
  menge numeric not null default 1 check (menge > 0),
  dringend boolean not null default false,
  -- offen → bestellt (nur Teile) → erledigt
  status text not null default 'offen' check (status in ('offen', 'bestellt', 'erledigt')),
  erledigt_von uuid references public.profile (id) on delete set null,
  erledigt_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index if not exists auftrag_meldungen_termin_idx on public.auftrag_meldungen (termin_id);
create index if not exists auftrag_meldungen_offen_idx on public.auftrag_meldungen (erstellt_am) where status <> 'erledigt';

-- ---------------------------------------------------------------------------
-- Pausen beim Stempeln: Summe der beendeten Pausen und Beginn der laufenden
-- ---------------------------------------------------------------------------
alter table public.zeiteintraege add column if not exists pause_minuten integer not null default 0;
alter table public.zeiteintraege add column if not exists pause_seit timestamptz;

-- ---------------------------------------------------------------------------
-- Freien Auftrag übernehmen (Team-App): nur, wenn er noch niemandem gehört. Unter derselben Sperre wie
-- termin_umplanen, damit zwei, die gleichzeitig tippen, nicht beide denselben Auftrag bekommen.
-- ---------------------------------------------------------------------------
create or replace function public.termin_uebernehmen(p_id uuid, p_person uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.termine;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select * into v from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v.status <> 'bestaetigt' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;
  if v.zugewiesen_an is not null then raise exception 'SCHON_VERGEBEN' using errcode = 'P0001'; end if;
  if public.person_belegt(p_person, v.beginn, v.belegt_bis, p_id) then raise exception 'PERSON_BELEGT' using errcode = 'P0001'; end if;
  update public.termine set zugewiesen_an = p_person where id = p_id;
end;
$$;
revoke execute on function public.termin_uebernehmen(uuid, uuid) from public, anon, authenticated;
grant execute on function public.termin_uebernehmen(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.auftrag_zeiten enable row level security;
revoke all on public.auftrag_zeiten from anon, authenticated;
alter table public.auftrag_meldungen enable row level security;
revoke all on public.auftrag_meldungen from anon, authenticated;
