-- Systemcheck (Einstellungen → Fehler): prüft auf Knopfdruck und jede Nacht, ob die Kernabläufe der Datenbank
-- sauber durchlaufen. Alles, was dabei angelegt wird, nimmt die Funktion am Ende selbst wieder zurück.
--
-- 1. systemcheck(): legt Kunde, Fahrzeug, Termine, Werkstattauftrag, Kostenvoranschlag und Rechnungen (mit Storno
--    und Korrektur) über dieselben Datenbankfunktionen an wie die App, löscht Termine und Kunde wieder und macht
--    zum Schluss alles per Rollback rückgängig. Die Nummernkreise liegen in einer Tabelle und gehen mit zurück,
--    es entsteht also keine Lücke bei Rechnungs-, Auftrags- oder KV-Nummern. Nur die Zähler für Termin- und
--    Kundennummern (Identity) laufen nicht mit zurück; die setzt die Funktion danach selbst zurück.
-- 2. systemcheck_laeufe: Ergebnis der letzten Läufe für die Anzeige (wird im Takt nach 30 Tagen gelöscht).

create table if not exists public.systemcheck_laeufe (
  id bigint generated always as identity primary key,
  gestartet_am timestamptz not null default now(),
  dauer_ms integer not null default 0,
  ausgeloest text not null default 'knopf' check (ausgeloest in ('knopf', 'nacht')),
  von uuid references public.profile (id) on delete set null,
  rot integer not null default 0,
  gelb integer not null default 0,
  pruefungen jsonb not null default '[]'
);

create index if not exists systemcheck_laeufe_zeit_idx on public.systemcheck_laeufe (gestartet_am desc);

create or replace function public.systemcheck_eintrag(p_schritt text, p_start timestamptz, p_ok boolean, p_text text, p_code text default null)
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object(
    'schritt', p_schritt,
    'ok', p_ok,
    'text', coalesce(p_text, ''),
    'code', p_code,
    'ms', round(extract(epoch from clock_timestamp() - p_start) * 1000)::integer
  );
$$;

create or replace function public.systemcheck()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ergebnis jsonb := '[]'::jsonb;
  v_schritt text := 'Vorbereitung';
  v_start timestamptz := clock_timestamp();
  -- Große Kapazität: Die Prüfung der Belegung läuft mit, scheitert aber nicht an echten Terminen.
  v_kap constant integer := 1000000;
  -- Weit in der Zukunft, damit kein echter Termin und keine Planung berührt wird
  v_beginn constant timestamptz := date_trunc('day', now()) + interval '10 years' + interval '3 hours';
  v_firma constant jsonb := jsonb_build_object('name', 'Systemcheck');
  v_empfaenger constant jsonb := jsonb_build_object('name', 'Systemcheck');
  v_pos constant jsonb := jsonb_build_array(jsonb_build_object('text', 'Systemcheck', 'menge', 1, 'einheit', 'Stk', 'einzel_netto_cent', 100, 'mwst_satz', 19));
  v_minus constant jsonb := jsonb_build_array(jsonb_build_object('text', 'Systemcheck', 'menge', -1, 'einheit', 'Stk', 'einzel_netto_cent', 100, 'mwst_satz', 19));
  v_kunde uuid;
  v_kunde_nr integer;
  v_fahrzeug uuid;
  v_termin uuid;
  v_termin_nr integer;
  v_ungeplant uuid;
  v_ungeplant_nr integer;
  v_kv uuid;
  v_rechnung uuid;
  v_storno uuid;
  v_korrektur uuid;
  v_text text;
  v_seq text;
  v_letzte bigint;
  v_geschuetzt boolean;
begin
  -- Dieselbe Sperre wie beim Anlegen und Löschen von Terminen, und zwar bis zum Ende: So vergibt niemand eine
  -- Terminnummer, während der Zähler unten zurückgesetzt wird.
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  begin
    v_schritt := 'Kunde anlegen';
    v_start := clock_timestamp();
    insert into public.kunden (name, notiz) values ('Systemcheck', 'Testdatensatz, wird sofort zurückgenommen')
    returning id, nummer into v_kunde, v_kunde_nr;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Kundennummer ' || v_kunde_nr);

    v_schritt := 'Fahrzeug anlegen';
    v_start := clock_timestamp();
    insert into public.fahrzeuge (kunde_id, kennzeichen) values (v_kunde, 'SC-TEST 1') returning id into v_fahrzeug;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    v_schritt := 'Termin anlegen';
    v_start := clock_timestamp();
    v_termin := public.termin_anlegen(
      jsonb_build_object(
        'status', 'angefragt',
        'beginn', v_beginn,
        'ende', v_beginn + interval '1 hour',
        'belegt_bis', v_beginn + interval '1 hour',
        'halten_bis', now() + interval '1 day',
        'leistung_name', 'Systemcheck',
        'kunde_id', v_kunde,
        'fahrzeug_id', v_fahrzeug,
        'quelle', 'admin'
      ),
      v_kap,
      false
    );
    select nummer into v_termin_nr from public.termine where id = v_termin;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Terminnummer ' || v_termin_nr);

    v_schritt := 'Termin bestätigen';
    v_start := clock_timestamp();
    perform public.termin_bestaetigen(v_termin, v_kap, false);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    -- Verschieben läuft in der App über termin_umplanen (termin_verschieben nutzt sie nicht mehr)
    v_schritt := 'Termin verschieben';
    v_start := clock_timestamp();
    perform public.termin_umplanen(v_termin, v_beginn + interval '1 day 2 hours', v_beginn + interval '1 day 3 hours', v_beginn + interval '1 day 3 hours', null, v_kap, false);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    v_schritt := 'Werkstattauftrag anlegen';
    v_start := clock_timestamp();
    v_text := public.auftrag_anlegen(v_termin);
    if v_text is null then raise exception 'Keine Auftragsnummer vergeben (Nummernkreis „auftrag“ fehlt?)'; end if;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Auftragsnummer ' || v_text);

    v_schritt := 'Auftrag ohne Termin anlegen und einplanen';
    v_start := clock_timestamp();
    insert into public.termine (status, beginn, ende, belegt_bis, leistung_name, kunde_id, fahrzeug_id, quelle)
    values ('ungeplant', null, null, null, 'Systemcheck', v_kunde, v_fahrzeug, 'admin')
    returning id, nummer into v_ungeplant, v_ungeplant_nr;
    perform public.termin_einplanen(v_ungeplant, v_beginn + interval '2 days', v_beginn + interval '2 days 1 hour', v_beginn + interval '2 days 1 hour', null, 'angefragt', now() + interval '1 day', v_kap, false);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    v_schritt := 'Kostenvoranschlag abschließen und annehmen';
    v_start := clock_timestamp();
    insert into public.kostenvoranschlaege (kunde_id, termin_id, empfaenger, positionen, summe_netto_cent, summe_mwst_cent, summe_brutto_cent)
    values (v_kunde, v_termin, v_empfaenger, v_pos, 100, 19, 119)
    returning id into v_kv;
    v_text := public.kostenvoranschlag_abschliessen(v_kv, v_firma);
    update public.kostenvoranschlaege set status = 'angenommen', beantwortet_am = now() where id = v_kv;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'KV-Nummer ' || coalesce(v_text, '–'));

    v_schritt := 'Rechnung stellen';
    v_start := clock_timestamp();
    insert into public.rechnungen (kunde_id, termin_id, empfaenger, positionen, leistungsdatum, summe_netto_cent, summe_mwst_cent, summe_brutto_cent)
    values (v_kunde, v_termin, v_empfaenger, v_pos, current_date, 100, 19, 119)
    returning id into v_rechnung;
    v_text := public.rechnung_stellen(v_rechnung, v_firma);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Rechnungsnummer ' || coalesce(v_text, '–'));

    v_schritt := 'Gestellte Rechnung ist geschützt';
    v_start := clock_timestamp();
    v_geschuetzt := false;
    begin
      update public.rechnungen set positionen = '[]'::jsonb where id = v_rechnung;
    exception when others then
      v_geschuetzt := true;
    end;
    if not v_geschuetzt then raise exception 'Eine gestellte Rechnung ließ sich ändern (Trigger rechnung_schuetzen fehlt).'; end if;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    v_schritt := 'Rechnung stornieren';
    v_start := clock_timestamp();
    insert into public.rechnungen (kunde_id, termin_id, storno_zu, empfaenger, positionen, leistungsdatum, summe_netto_cent, summe_mwst_cent, summe_brutto_cent)
    values (v_kunde, v_termin, v_rechnung, v_empfaenger, v_minus, current_date, -100, -19, -119)
    returning id into v_storno;
    v_text := public.rechnung_stellen(v_storno, v_firma);
    update public.rechnungen set status = 'storniert' where id = v_rechnung;
    update public.rechnungen set status = 'bezahlt', bezahlt_am = current_date, faellig_am = null where id = v_storno;
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Stornonummer ' || coalesce(v_text, '–'));

    v_schritt := 'Korrektur stellen';
    v_start := clock_timestamp();
    insert into public.rechnungen (kunde_id, termin_id, korrektur_zu, korrektur_grund, empfaenger, positionen, leistungsdatum, summe_netto_cent, summe_mwst_cent, summe_brutto_cent)
    values (v_kunde, v_termin, v_rechnung, 'Systemcheck', v_empfaenger, v_pos, current_date, 100, 19, 119)
    returning id into v_korrektur;
    v_text := public.rechnung_korrektur_stellen(v_korrektur, v_firma);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, 'Fassung ' || coalesce(v_text, '–'));

    v_schritt := 'Termine löschen';
    v_start := clock_timestamp();
    perform public.termin_loeschen(v_termin, null, null);
    perform public.termin_loeschen(v_ungeplant, null, null);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    v_schritt := 'Kunde löschen';
    v_start := clock_timestamp();
    perform public.kunde_loeschen(v_kunde);
    v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, true, null);

    -- Alles zurücknehmen: Die Ausnahme rollt den ganzen Block zurück, die Ergebnisse (Variablen) bleiben.
    v_schritt := 'Zurücknehmen';
    raise exception 'SYSTEMCHECK_ZURUECK' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'SYSTEMCHECK_ZURUECK' then
      v_ergebnis := v_ergebnis || public.systemcheck_eintrag(v_schritt, v_start, false, sqlerrm, sqlstate);
    end if;
  end;

  -- Identity-Zähler laufen beim Rollback nicht mit zurück. Nur zurücksetzen, wenn seitdem niemand eine Nummer
  -- gezogen hat (letzter Wert = unsere), sonst entstünde eine doppelte Nummer.
  if coalesce(v_termin_nr, v_ungeplant_nr) is not null then
    v_seq := pg_get_serial_sequence('public.termine', 'nummer');
    execute format('select last_value from %s', v_seq) into v_letzte;
    if v_letzte = greatest(v_termin_nr, v_ungeplant_nr) then
      perform setval(v_seq, least(v_termin_nr, v_ungeplant_nr) - 1);
    end if;
  end if;
  if v_kunde_nr is not null then
    v_seq := pg_get_serial_sequence('public.kunden', 'nummer');
    execute format('select last_value from %s', v_seq) into v_letzte;
    if v_letzte = v_kunde_nr then perform setval(v_seq, v_kunde_nr - 1); end if;
  end if;

  return v_ergebnis;
end;
$$;

revoke execute on function public.systemcheck() from public, anon, authenticated;
grant execute on function public.systemcheck() to service_role;
revoke execute on function public.systemcheck_eintrag(text, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.systemcheck_eintrag(text, timestamptz, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.systemcheck_laeufe enable row level security;
revoke all on public.systemcheck_laeufe from anon, authenticated;
