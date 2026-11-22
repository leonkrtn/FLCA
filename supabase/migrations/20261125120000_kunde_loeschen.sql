-- Kunden löschen (Kundenakte → Löschen, mit Bestätigung im Dialog).
--
-- Alles in einer Funktion, damit Prüfung und Löschen zusammen gelingen oder gar nicht: Ein halb gelöschter
-- Kunde ohne Fahrzeuge wäre schlechter als keiner.
--
-- Gelöscht werden der Kunde, seine Fahrzeuge (sonst blieben Kennzeichen ohne Halter stehen, und ein
-- neuer Kunde mit demselben Auto bekäme es nie angehängt, siehe `kundeAusBeleg`) und seine früheren
-- Rechnungen aus der Datenübernahme (nur Kopien zum Nachschlagen, das Original-PDF ist der Beleg).
--
-- Bleiben, nur ohne Verknüpfung (Fremdschlüssel „on delete set null“): gestellte Rechnungen und
-- Kostenvoranschläge mit der Anschrift, die auf dem Beleg steht (Aufbewahrungspflicht, sie sind ohnehin
-- unveränderlich), vergangene Termine, Notizen und ausgelagerte Räder.
--
-- Abgelehnt wird, solange noch etwas läuft: ein angefragter oder bestätigter Termin, der noch kommt oder
-- in Arbeit ist, oder Räder, die noch eingelagert sind.

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
    where kunde_id = p_id and status in ('angefragt', 'bestaetigt') and (belegt_bis >= now() or auftrag_status = 'in_arbeit')
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
