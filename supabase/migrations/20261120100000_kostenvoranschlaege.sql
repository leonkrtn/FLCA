-- Kostenvoranschläge: ein Angebot an einen Kunden mit Positionen, bevor gearbeitet wird.
--
-- Aufbau wie bei Rechnungen: Entwurf frei bearbeiten, beim Abschließen bekommt er eine fortlaufende
-- Nummer (eigener Nummernkreis „KV-“) und wird eingefroren. Der Kunde sieht ihn über einen Link und
-- kann ihn dort annehmen oder ablehnen. Aus einem Kostenvoranschlag entsteht per Knopf ein
-- Rechnungsentwurf mit denselben Positionen.
--
-- Anders als eine Rechnung ist ein Kostenvoranschlag kein Buchungsbeleg. Eingefroren wird er trotzdem,
-- damit der Kunde genau das annimmt, was er gesehen hat. Für eine Änderung gibt es „Als neuen Entwurf kopieren“.

insert into public.nummernkreise (art, praefix) values ('kostenvoranschlag', 'KV-') on conflict (art) do nothing;

create table public.kostenvoranschlaege (
  id uuid primary key default gen_random_uuid(),
  nummer text unique,
  status text not null default 'entwurf' check (status in ('entwurf', 'offen', 'angenommen', 'abgelehnt')),
  termin_id uuid references public.termine (id) on delete set null,
  kunde_id uuid references public.kunden (id) on delete set null,
  empfaenger jsonb not null default '{}',
  fahrzeug jsonb not null default '{}',
  -- [{ "text", "menge", "einheit", "einzel_brutto_cent", "mwst_satz", "artikel_id" }], wie bei Rechnungen
  positionen jsonb not null default '[]',
  datum date,
  gueltig_bis date,
  hinweis text not null default '',
  summe_netto_cent bigint not null default 0,
  summe_mwst_cent bigint not null default 0,
  summe_brutto_cent bigint not null default 0,
  -- Firmendaten zum Zeitpunkt des Abschließens
  firma jsonb,
  token text not null unique default public.zufallstoken(),
  gesendet_am timestamptz,
  gesendet_an text,
  beantwortet_am timestamptz,
  -- Rechnungsentwurf, der aus diesem Kostenvoranschlag entstanden ist
  rechnung_id uuid references public.rechnungen (id) on delete set null,
  erstellt_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  abgeschlossen_am timestamptz,
  aktualisiert_am timestamptz not null default now()
);

create index kostenvoranschlaege_status_idx on public.kostenvoranschlaege (status, erstellt_am desc);
create index kostenvoranschlaege_kunde_idx on public.kostenvoranschlaege (kunde_id);

create trigger kostenvoranschlaege_aktualisiert
  before update on public.kostenvoranschlaege
  for each row execute function public.aktualisiert_setzen();

-- Nach dem Abschließen bleibt der Inhalt stehen. Erlaubt sind nur Versand- und Antwortvermerke,
-- der Wechsel auf angenommen/abgelehnt und der Verweis auf die Rechnung.
create function public.kostenvoranschlag_schuetzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'entwurf' then raise exception 'Abgeschlossene Kostenvoranschläge können nicht gelöscht werden.'; end if;
    return old;
  end if;
  if old.status <> 'entwurf' and (
    new.nummer is distinct from old.nummer or
    new.positionen is distinct from old.positionen or
    new.empfaenger is distinct from old.empfaenger or
    new.fahrzeug is distinct from old.fahrzeug or
    new.datum is distinct from old.datum or
    new.gueltig_bis is distinct from old.gueltig_bis or
    new.summe_brutto_cent is distinct from old.summe_brutto_cent or
    new.firma is distinct from old.firma or
    new.hinweis is distinct from old.hinweis or
    new.status = 'entwurf'
  ) then
    raise exception 'Abgeschlossene Kostenvoranschläge sind unveränderlich.';
  end if;
  return new;
end;
$$;

create trigger kostenvoranschlaege_schutz
  before update or delete on public.kostenvoranschlaege
  for each row execute function public.kostenvoranschlag_schuetzen();

-- Vergibt die nächste Nummer und schließt ab. Die Zeile im Nummernkreis ist dabei gesperrt,
-- gleichzeitige Aufrufe bekommen nie dieselbe Nummer.
create function public.kostenvoranschlag_abschliessen(p_id uuid, p_firma jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  k public.nummernkreise;
  r public.kostenvoranschlaege;
  v_nummer text;
begin
  select * into r from public.kostenvoranschlaege where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if r.status <> 'entwurf' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;
  if jsonb_array_length(r.positionen) = 0 then raise exception 'KEINE_POSITIONEN' using errcode = 'P0001'; end if;

  select * into k from public.nummernkreise where art = 'kostenvoranschlag' for update;
  v_nummer := k.praefix
    || case when k.mit_jahr then to_char(coalesce(r.datum, current_date), 'YYYY') || '-' else '' end
    || lpad(k.naechste::text, k.stellen, '0');
  update public.nummernkreise set naechste = naechste + 1 where art = 'kostenvoranschlag';

  update public.kostenvoranschlaege
  set nummer = v_nummer,
      status = 'offen',
      firma = p_firma,
      datum = coalesce(datum, current_date),
      abgeschlossen_am = now()
  where id = p_id;

  return v_nummer;
end;
$$;

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.kostenvoranschlaege enable row level security;
revoke all on public.kostenvoranschlaege from anon, authenticated;
revoke execute on function public.kostenvoranschlag_abschliessen(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kostenvoranschlag_abschliessen(uuid, jsonb) to service_role;
