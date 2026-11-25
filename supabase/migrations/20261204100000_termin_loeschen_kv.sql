-- Termin löschen nimmt seine Kostenvoranschläge mit.
--
-- Bisher blieb ein KV nach dem Löschen des Termins ohne Termin stehen (termin_id → null), auch der, aus dem
-- der Auftrag wurde. Jetzt gehen alle mit dem Termin verknüpften KVs mit, in jedem Stand. Rechnungen bleiben
-- wie bisher (rechnungen.termin_id → null); der Verweis KV → Rechnung liegt beim KV und verschwindet mit ihm.
--
-- Abgeschlossene KVs schützt der Trigger kostenvoranschlag_schuetzen vor dem Löschen. Ausnahme nur innerhalb
-- von termin_loeschen: Die Funktion setzt dafür eine Einstellung, die bis zum Ende ihrer Transaktion gilt.

create or replace function public.kostenvoranschlag_schuetzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'entwurf' and coalesce(current_setting('flca.termin_loeschen', true), '') <> 'an' then
      raise exception 'Abgeschlossene Kostenvoranschläge können nicht gelöscht werden.';
    end if;
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

create or replace function public.termin_loeschen(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_nummer integer;
begin
  -- Dieselbe Sperre wie beim Anlegen: Solange gelöscht und nachnummeriert wird, vergibt niemand eine Nummer.
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  -- Erst die Kostenvoranschläge, sonst setzt der Fremdschlüssel ihre termin_id auf null und sie bleiben stehen.
  perform set_config('flca.termin_loeschen', 'an', true);
  delete from public.kostenvoranschlaege where termin_id = p_id;
  perform set_config('flca.termin_loeschen', '', true);

  delete from public.termine where id = p_id returning nummer into v_nummer;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;

  -- In zwei Schritten über negative Zahlen: Rückt man direkt um eins nach, stößt je nach Reihenfolge der
  -- Zeilen eine Nummer kurz auf die noch belegte nächste und die Eindeutigkeit schlägt an.
  update public.termine set nummer = -nummer where nummer > v_nummer;
  update public.termine set nummer = -nummer - 1 where nummer < 0;

  -- Zähler hinter die höchste Nummer setzen (ohne Termine wieder auf 1001).
  perform setval(pg_get_serial_sequence('public.termine', 'nummer'), coalesce((select max(nummer) from public.termine), 1000));
  return v_nummer;
end;
$$;
revoke execute on function public.termin_loeschen(uuid) from public, anon, authenticated;
grant execute on function public.termin_loeschen(uuid) to service_role;
