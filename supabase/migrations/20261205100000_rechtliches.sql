-- Rechtliches: Widerruf bei Online-Aufträgen, Freigabe von Mehrkosten, Archiv statt Löschen.
--
-- 1. Wer online (Terminlink oder Kostenvoranschlag) beauftragt, schließt als Verbraucher einen Fernabsatzvertrag
--    und hat 14 Tage Widerrufsrecht. Damit die Werkstatt trotzdem gleich anfangen darf, verlangt der Kunde das
--    ausdrücklich (§ 356 Abs. 4 BGB). Wann, steht hier als Nachweis.
-- 2. Liegt ein Auftrag über der Kostengrenze, schuldet der Kunde den Mehrbetrag nur, wenn er zugestimmt hat. Die
--    Werkstatt muss das beweisen können: Wie, wann, bis zu welcher Summe und wer es eingetragen hat.
-- 3. Was dem Kunden schon geschickt wurde, ist ein Geschäftsbrief und bleibt: Termin löschen legt verschickte
--    Kostenvoranschläge und den verschickten oder erteilten Werkstattauftrag ins Archiv (Einstellungen → Archiv),
--    Mails aus dem Papierkorb werden nicht mehr gelöscht, sondern aufbewahrt (6 Jahre, dann löscht der Takt).

alter table public.termine
  add column if not exists auftrag_vorab_am timestamptz,
  add column if not exists auftrag_freigabe_bis_cent integer check (auftrag_freigabe_bis_cent is null or auftrag_freigabe_bis_cent >= 0),
  add column if not exists auftrag_freigabe_am timestamptz,
  add column if not exists auftrag_freigabe_wie text not null default '',
  add column if not exists auftrag_freigabe_von uuid references public.profile (id) on delete set null;

alter table public.kostenvoranschlaege
  add column if not exists vorab_am timestamptz,
  add column if not exists archiviert_am timestamptz;
create index if not exists kostenvoranschlaege_archiv_idx on public.kostenvoranschlaege (archiviert_am desc) where archiviert_am is not null;

alter table public.mails add column if not exists aufbewahrt_am timestamptz;
create index if not exists mails_aufbewahrt_idx on public.mails (aufbewahrt_am desc) where aufbewahrt_am is not null;

-- Werkstattaufträge gelöschter Termine: das PDF, wie es beim Löschen aussah, und alle Daten als Nachweis
create table if not exists public.archiv_auftraege (
  id uuid primary key default gen_random_uuid(),
  termin_nummer integer,
  auftrag_nummer text not null default '',
  kunde_name text not null default '',
  kennzeichen text not null default '',
  summe_brutto_cent integer not null default 0,
  erteilt_am timestamptz,
  gesendet_am timestamptz,
  pdf_pfad text,
  daten jsonb not null default '{}'::jsonb,
  archiviert_von uuid references public.profile (id) on delete set null,
  archiviert_am timestamptz not null default now()
);
create index if not exists archiv_auftraege_zeit_idx on public.archiv_auftraege (archiviert_am desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archiv', 'archiv', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Neue Fassung mit PDF-Pfad und Person; die alte (nur p_id) fällt weg, sonst wäre der Aufruf mehrdeutig.
drop function if exists public.termin_loeschen(uuid);

create or replace function public.termin_loeschen(p_id uuid, p_pdf_pfad text default null, p_von uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_nummer integer;
  v_t public.termine%rowtype;
begin
  -- Dieselbe Sperre wie beim Anlegen: Solange gelöscht und nachnummeriert wird, vergibt niemand eine Nummer.
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  select * into v_t from public.termine where id = p_id;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;

  -- Verschickter oder erteilter Werkstattauftrag: mit Kunde, Fahrzeug, Unterschrift, Fotos und Verlauf ins Archiv
  if v_t.auftrag_nummer is not null and (v_t.auftrag_gesendet_am is not null or v_t.auftrag_erteilt_am is not null) then
    insert into public.archiv_auftraege
      (termin_nummer, auftrag_nummer, kunde_name, kennzeichen, summe_brutto_cent, erteilt_am, gesendet_am, pdf_pfad, daten, archiviert_von)
    select
      v_t.nummer,
      v_t.auftrag_nummer,
      coalesce(k.name, ''),
      coalesce(f.kennzeichen, ''),
      coalesce(v_t.auftrag_summe_brutto_cent, 0),
      v_t.auftrag_erteilt_am,
      v_t.auftrag_gesendet_am,
      p_pdf_pfad,
      jsonb_build_object(
        'termin', to_jsonb(v_t),
        'kunde', to_jsonb(k),
        'fahrzeug', to_jsonb(f),
        'unterschrift', (select u.bild from public.auftrag_unterschriften u where u.termin_id = p_id),
        'fotos', coalesce((select jsonb_agg(to_jsonb(x)) from public.termin_fotos x where x.termin_id = p_id), '[]'::jsonb),
        'verlauf', coalesce((select jsonb_agg(jsonb_build_object('text', v.text, 'von', v.von, 'am', v.erstellt_am) order by v.erstellt_am)
                             from public.verlauf v where v.bezug_typ = 'termin' and v.bezug_id = p_id), '[]'::jsonb)
      ),
      p_von
    from (select 1) eins
    left join public.kunden k on k.id = v_t.kunde_id
    left join public.fahrzeuge f on f.id = v_t.fahrzeug_id;
  end if;

  -- Verschickte Kostenvoranschläge bleiben, nur ohne Termin und im Archiv; Entwürfe gehen mit dem Termin.
  update public.kostenvoranschlaege set termin_id = null, archiviert_am = now() where termin_id = p_id and status <> 'entwurf';
  delete from public.kostenvoranschlaege where termin_id = p_id and status = 'entwurf';

  delete from public.termine where id = p_id returning nummer into v_nummer;

  -- In zwei Schritten über negative Zahlen: Rückt man direkt um eins nach, stößt je nach Reihenfolge der
  -- Zeilen eine Nummer kurz auf die noch belegte nächste und die Eindeutigkeit schlägt an.
  update public.termine set nummer = -nummer where nummer > v_nummer;
  update public.termine set nummer = -nummer - 1 where nummer < 0;

  -- Zähler hinter die höchste Nummer setzen (ohne Termine wieder auf 1001).
  perform setval(pg_get_serial_sequence('public.termine', 'nummer'), coalesce((select max(nummer) from public.termine), 1000));
  return v_nummer;
end;
$$;
revoke execute on function public.termin_loeschen(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.termin_loeschen(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.archiv_auftraege enable row level security;
revoke all on public.archiv_auftraege from anon, authenticated;
