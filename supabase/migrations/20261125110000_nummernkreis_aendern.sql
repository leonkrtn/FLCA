-- Nummernkreis der Rechnungen auch nach der ersten Rechnung änderbar (Einstellungen → Rechnungen).
--
-- Bisher war er gesperrt, sobald eine Rechnung gestellt war. Wer die Software mitten im Jahr einführt
-- oder Rechnungen eine Zeit lang woanders geschrieben hat, muss die nächste Nummer aber setzen können. Die
-- Verwaltung fragt dafür in einem Dialog mit Warnungen nach (Lücke, Rückschritt, Formatwechsel); hier wird
-- nur noch verhindert, was nie sein darf:
-- - eine Nummer, die es schon gibt: Ab der neuen Nummer darf im gleichen Format (Präfix und Jahr wie bei
--   der nächsten Rechnung) keine gestellte Rechnung mit gleicher oder höherer Nummer existieren, sonst
--   stieße `rechnung_stellen` später auf eine doppelte Nummer.
-- - mehr Ziffern als Stellen: `lpad` würde die Nummer abschneiden (12345 bei 4 Stellen → 1234).

create or replace function public.nummernkreis_einstellen(p_praefix text, p_mit_jahr boolean, p_stellen smallint, p_naechste bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_vorne text;
  v_hoechste bigint;
begin
  if length(p_naechste::text) > p_stellen then
    raise exception 'ZU_WENIG_STELLEN' using errcode = 'P0001';
  end if;

  -- Sperrt die Zeile, damit keine Rechnung dazwischen eine Nummer zieht.
  perform 1 from public.nummernkreise where art = 'rechnung' for update;

  v_vorne := p_praefix || case when p_mit_jahr then to_char(current_date, 'YYYY') || '-' else '' end;
  select max(substr(nummer, length(v_vorne) + 1)::bigint) into v_hoechste
  from public.rechnungen
  where nummer is not null
    and left(nummer, length(v_vorne)) = v_vorne
    and substr(nummer, length(v_vorne) + 1) ~ '^[0-9]{1,18}$';

  if v_hoechste is not null and v_hoechste >= p_naechste then
    raise exception 'NUMMER_VERGEBEN:%', v_hoechste + 1 using errcode = 'P0001';
  end if;

  update public.nummernkreise
  set praefix = p_praefix, mit_jahr = p_mit_jahr, stellen = p_stellen, naechste = p_naechste
  where art = 'rechnung';
end;
$$;

revoke execute on function public.nummernkreis_einstellen(text, boolean, smallint, bigint) from public, anon, authenticated;
grant execute on function public.nummernkreis_einstellen(text, boolean, smallint, bigint) to service_role;
