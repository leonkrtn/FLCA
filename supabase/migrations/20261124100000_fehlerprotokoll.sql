-- Fehlerprotokoll: Fehler, die auf dem Server passieren (Seiten, Formulare, Takt), landen hier und sind in der
-- Verwaltung unter Einstellungen → Fehler zu sehen. Vorher standen sie nur im Server-Log, und eine kaputte
-- Abfrage fiel erst auf, wenn jemand sich über eine leere Liste wunderte.
--
-- Gleiche Fehler (gleicher Ort, gleiche Meldung ohne IDs und Zahlen) werden zu einer Zeile zusammengefasst
-- und gezählt, damit ein Fehler im Minutentakt das Protokoll nicht flutet.

create table if not exists public.fehlerprotokoll (
  id bigint generated always as identity primary key,
  schluessel text not null unique,
  ort text not null default '',
  meldung text not null default '',
  code text,
  -- Fehlercode, den die Fehlerseite anzeigt (Next.js „digest“), zuletzt gesehener
  digest text,
  anzahl integer not null default 1,
  zuerst_am timestamptz not null default now(),
  zuletzt_am timestamptz not null default now(),
  erledigt_am timestamptz
);

create index if not exists fehlerprotokoll_zuletzt_idx on public.fehlerprotokoll (zuletzt_am desc);
create index if not exists fehlerprotokoll_digest_idx on public.fehlerprotokoll (digest) where digest is not null;

-- Ein Aufruf je Fehler: neu anlegen oder hochzählen. Tritt ein als erledigt markierter Fehler wieder auf,
-- ist er wieder offen.
create or replace function public.fehler_melden(p_schluessel text, p_ort text, p_meldung text, p_code text, p_digest text)
returns void language sql security definer set search_path = '' as $$
  insert into public.fehlerprotokoll (schluessel, ort, meldung, code, digest)
  values (p_schluessel, left(p_ort, 300), left(p_meldung, 4000), p_code, p_digest)
  on conflict (schluessel) do update set
    anzahl = public.fehlerprotokoll.anzahl + 1,
    zuletzt_am = now(),
    meldung = excluded.meldung,
    code = excluded.code,
    digest = coalesce(excluded.digest, public.fehlerprotokoll.digest),
    erledigt_am = null;
$$;

revoke execute on function public.fehler_melden(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fehler_melden(text, text, text, text, text) to service_role;

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.fehlerprotokoll enable row level security;
revoke all on public.fehlerprotokoll from anon, authenticated;
