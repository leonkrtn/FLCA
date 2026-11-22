-- Gestellte Rechnungen nachträglich korrigieren (Rechnung → „Rechnung korrigieren …“).
--
-- Eine gestellte Rechnung bleibt unveränderlich (GoBD). Korrigiert wird so:
-- 1. Aus dem Original entsteht ein Entwurf mit allen Angaben (korrektur_zu, Pflichtgrund in korrektur_grund),
--    der sich wie jeder Entwurf frei bearbeiten lässt.
-- 2. Beim Stellen wird das Original storniert (Stornorechnung mit eigener Nummer aus dem Nummernkreis) und
--    die Korrektur bekommt die Nummer des Originals mit Fassung: RE-2026-0001.1, beim nächsten Mal .2.
--    Die Fassung zieht keine Nummer aus dem Nummernkreis, es entsteht also keine Lücke.
--
-- bereits_bezahlt_cent: Was der Kunde auf das Original schon gezahlt hat. Die Korrektur verrechnet es (PDF,
-- E-Rechnung mit TotalPrepaidAmount, offene Beträge), und der DATEV-Export bucht diese Zahlung nicht ein
-- zweites Mal, sie steht schon beim Original.

alter table public.rechnungen
  add column if not exists korrektur_zu uuid references public.rechnungen (id) on delete restrict,
  add column if not exists korrektur_grund text not null default '',
  add column if not exists bereits_bezahlt_cent bigint not null default 0;

-- Je Original höchstens eine Korrektur (Entwurf oder gestellt). Nach dem Stellen ist das Original storniert
-- und lässt sich ohnehin nicht noch einmal korrigieren; korrigiert wird dann die neue Fassung.
create unique index if not exists rechnungen_korrektur_zu_idx on public.rechnungen (korrektur_zu) where korrektur_zu is not null;

-- Wie bisher, dazu die Felder der Korrektur und storno_zu: Auch der Bezug gehört zum Beleg.
create or replace function public.rechnung_schuetzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'entwurf' then raise exception 'Gestellte Rechnungen können nicht gelöscht werden.'; end if;
    return old;
  end if;
  if old.status <> 'entwurf' and (
    new.nummer is distinct from old.nummer or
    new.positionen is distinct from old.positionen or
    new.empfaenger is distinct from old.empfaenger or
    new.fahrzeug is distinct from old.fahrzeug or
    new.rechnungsdatum is distinct from old.rechnungsdatum or
    new.leistungsdatum is distinct from old.leistungsdatum or
    new.summe_brutto_cent is distinct from old.summe_brutto_cent or
    new.summe_netto_cent is distinct from old.summe_netto_cent or
    new.summe_mwst_cent is distinct from old.summe_mwst_cent or
    new.firma is distinct from old.firma or
    new.hinweis is distinct from old.hinweis or
    new.storno_zu is distinct from old.storno_zu or
    new.korrektur_zu is distinct from old.korrektur_zu or
    new.korrektur_grund is distinct from old.korrektur_grund or
    new.bereits_bezahlt_cent is distinct from old.bereits_bezahlt_cent or
    new.status = 'entwurf'
  ) then
    raise exception 'Gestellte Rechnungen sind unveränderlich.';
  end if;
  return new;
end;
$$;

-- Stellt eine Korrektur mit der Nummer des Originals und der nächsten Fassung. Die Zeile des Originals ist
-- dabei gesperrt, zwei gleichzeitige Aufrufe bekommen also nie dieselbe Fassung.
-- Die Wurzel ist die Nummer ohne Fassung: Wird RE-2026-0001.1 korrigiert, heißt die neue RE-2026-0001.2.
-- Abgeschnitten wird nur bei einem Original, das selbst eine Korrektur ist, denn ein Präfix wie „RE.“ ohne
-- Jahr ergäbe sonst „RE.0001“ → „RE“.
create or replace function public.rechnung_korrektur_stellen(p_id uuid, p_firma jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  r public.rechnungen;
  o public.rechnungen;
  v_wurzel text;
  v_fassung integer;
  v_nummer text;
begin
  select * into r from public.rechnungen where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if r.status <> 'entwurf' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;
  if r.korrektur_zu is null then raise exception 'KEINE_KORREKTUR' using errcode = 'P0001'; end if;
  if jsonb_array_length(r.positionen) = 0 then raise exception 'KEINE_POSITIONEN' using errcode = 'P0001'; end if;
  if btrim(r.korrektur_grund) = '' then raise exception 'KEIN_GRUND' using errcode = 'P0001'; end if;

  select * into o from public.rechnungen where id = r.korrektur_zu for update;
  if not found or o.nummer is null then raise exception 'ORIGINAL_FEHLT' using errcode = 'P0001'; end if;
  -- Das Original muss storniert sein, bevor die neue Fassung gilt (die Verwaltung storniert es vorher).
  if o.status <> 'storniert' then raise exception 'ORIGINAL_NICHT_STORNIERT' using errcode = 'P0001'; end if;

  v_wurzel := case when o.korrektur_zu is not null then regexp_replace(o.nummer, '\.[0-9]+$', '') else o.nummer end;
  select coalesce(max(substr(nummer, length(v_wurzel) + 2)::integer), 0) + 1 into v_fassung
  from public.rechnungen
  where nummer is not null
    and left(nummer, length(v_wurzel) + 1) = v_wurzel || '.'
    and substr(nummer, length(v_wurzel) + 2) ~ '^[0-9]{1,6}$';
  v_nummer := v_wurzel || '.' || v_fassung;

  update public.rechnungen
  set nummer = v_nummer,
      status = 'gestellt',
      firma = p_firma,
      rechnungsdatum = coalesce(rechnungsdatum, current_date),
      gestellt_am = now()
  where id = p_id;

  return v_nummer;
end;
$$;

revoke execute on function public.rechnung_korrektur_stellen(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.rechnung_korrektur_stellen(uuid, jsonb) to service_role;
