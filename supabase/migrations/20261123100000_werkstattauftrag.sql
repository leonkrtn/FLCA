-- Werkstattauftrag: Der Kunde erteilt den Auftrag, bevor gearbeitet wird.
--
-- Der Auftrag gehört zum Termin (ein Termin = ein Auto = ein Auftrag) und wird am Termin von Hand angelegt,
-- auch an einer Anfrage. Er hat eine eigene, feste Nummer (WA-…): Die Terminnummer rückt beim Löschen nach
-- und taugt deshalb nicht für einen unterschriebenen Beleg. Inhalt: Positionen wie im Kostenvoranschlag
-- (netto, mit Preisliste und gemerkten Preisen), eine optionale Kostengrenze und was der Kunde beanstandet.
--
-- Erteilt wird per Unterschrift auf dem Gerät, online über den Terminlink oder durch einen angenommenen
-- Kostenvoranschlag, der mit dem Termin verknüpft ist. Die Positionen bleiben danach änderbar (Mehrarbeit),
-- die Summe bei Erteilung steht in auftrag_erteilt_brutto_cent. Bei „fertig“ entsteht der Rechnungsentwurf.

insert into public.nummernkreise (art, praefix) values ('auftrag', 'WA-') on conflict (art) do nothing;

alter table public.termine
  add column if not exists auftrag_nummer text unique,
  add column if not exists auftrag_angelegt_am timestamptz,
  add column if not exists auftrag_positionen jsonb not null default '[]',
  add column if not exists auftrag_summe_brutto_cent bigint not null default 0,
  add column if not exists auftrag_kostengrenze_cent bigint check (auftrag_kostengrenze_cent is null or auftrag_kostengrenze_cent >= 0),
  add column if not exists auftrag_beschreibung text not null default '',
  -- Fahrzeugannahme: { tank, schluessel, vorschaeden } (alles freiwillig); km steht in km_stand,
  -- FIN, HSN, TSN und Erstzulassung am Fahrzeug.
  add column if not exists annahme jsonb not null default '{}',
  add column if not exists auftrag_gesendet_am timestamptz,
  add column if not exists auftrag_gesendet_an text,
  add column if not exists auftrag_erteilt_am timestamptz,
  add column if not exists auftrag_erteilt_wie text check (auftrag_erteilt_wie in ('unterschrift', 'online', 'kostenvoranschlag')),
  add column if not exists auftrag_erteilt_name text not null default '',
  add column if not exists auftrag_erteilt_brutto_cent bigint,
  add column if not exists auftrag_erteilt_von uuid references public.profile (id) on delete set null;

comment on column public.termine.auftrag_nummer is 'Nummer des Werkstattauftrags (Kreis „auftrag“); gesetzt = Auftrag angelegt';
comment on column public.termine.auftrag_erteilt_am is 'Wann der Kunde den Auftrag erteilt hat (null = noch nicht)';
comment on column public.termine.auftrag_erteilt_brutto_cent is 'Summe des Auftrags im Moment der Erteilung';

create index if not exists termine_auftrag_idx on public.termine (auftrag_angelegt_am desc) where auftrag_angelegt_am is not null;

-- Unterschrift des Kunden als PNG (data:-URL), in einer eigenen Tabelle: Termine werden in Listen mit allen
-- Spalten geladen, das Bild braucht nur das PDF und die Detailseite.
create table if not exists public.auftrag_unterschriften (
  termin_id uuid primary key references public.termine (id) on delete cascade,
  bild text not null check (length(bild) < 400000),
  erstellt_am timestamptz not null default now()
);

alter table public.fahrzeuge add column if not exists erstzulassung text not null default '';

-- Fotos vom Fahrzeug: bei der Arbeit oder Vorschäden bei der Annahme
alter table public.termin_fotos add column if not exists art text not null default 'arbeit' check (art in ('arbeit', 'vorschaden'));

-- Kostenvoranschläge am Termin finden (Terminseite, Rechnung ohne Doppelung)
create index if not exists kostenvoranschlaege_termin_idx on public.kostenvoranschlaege (termin_id) where termin_id is not null;

-- Legt den Auftrag an und vergibt seine Nummer. Ein zweiter Aufruf (Doppelklick, zwei Geräte) ändert nichts
-- und liefert dieselbe Nummer; die Zeile des Termins ist dabei gesperrt.
create or replace function public.auftrag_anlegen(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  k public.nummernkreise;
  v_vorhanden text;
  v_nummer text;
begin
  select auftrag_nummer into v_vorhanden from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v_vorhanden is not null then return v_vorhanden; end if;

  select * into k from public.nummernkreise where art = 'auftrag' for update;
  v_nummer := k.praefix
    || case when k.mit_jahr then to_char(current_date, 'YYYY') || '-' else '' end
    || lpad(k.naechste::text, k.stellen, '0');
  update public.nummernkreise set naechste = naechste + 1 where art = 'auftrag';

  update public.termine set auftrag_nummer = v_nummer, auftrag_angelegt_am = now() where id = p_id;
  return v_nummer;
end;
$$;

revoke execute on function public.auftrag_anlegen(uuid) from public, anon, authenticated;
grant execute on function public.auftrag_anlegen(uuid) to service_role;

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.auftrag_unterschriften enable row level security;
revoke all on public.auftrag_unterschriften from anon, authenticated;
