-- FLC Automotive: Grundsystem.
--
-- Zugriffsmodell: Jede Tabelle hat Row Level Security AN und KEINE Richtlinie für anon/authenticated.
-- Gelesen und geschrieben wird ausschließlich vom Server mit dem Secret Key, nachdem der Server selbst
-- Anmeldung und Rolle geprüft hat (src/lib/auth.ts). Das ist bewusst so gebaut: Eine vergessene oder zu
-- weite Richtlinie wäre ein Datenleck; eine fehlende Richtlinie ist nur eine Fehlermeldung.

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------

create type public.rolle as enum ('inhaber', 'buero', 'mitarbeiter');

create type public.termin_status as enum (
  'angefragt',        -- vom Kunden angefragt, hält den Slot bis halten_bis
  'bestaetigt',       -- angenommen, steht im Google-Kalender
  'abgelehnt',
  'storniert',
  'erledigt',
  'nicht_erschienen'
);

create type public.auftrag_status as enum ('offen', 'in_arbeit', 'fertig');
create type public.rechnung_status as enum ('entwurf', 'gestellt', 'bezahlt', 'storniert');
create type public.abwesenheit_art as enum ('urlaub', 'krank', 'sonstiges');
create type public.abwesenheit_status as enum ('beantragt', 'genehmigt', 'abgelehnt');
create type public.bewerbung_status as enum ('neu', 'in_pruefung', 'gespraech', 'zusage', 'absage');

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create function public.aktualisiert_setzen()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

-- Zufälliger Link-Schlüssel (64 Hex-Zeichen) für Kundenlinks ohne Login.
create function public.zufallstoken()
returns text language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- ---------------------------------------------------------------------------
-- Benutzer (1:1 zu auth.users)
-- ---------------------------------------------------------------------------

create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  telefon text not null default '',
  -- Ohne Rolle kein Zugriff, bis der Inhaber das Konto freischaltet.
  rolle public.rolle,
  aktiv boolean not null default true,
  -- Zeiterfassung ist pro Person einschaltbar (nicht Pflicht für alle).
  zeiterfassung boolean not null default false,
  -- Urlaubsanspruch pro Jahr, nur zur Anzeige im Team-Bereich.
  urlaubstage integer not null default 0,
  erstellt_am timestamptz not null default now()
);

create function public.neues_profil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id, name, email, rolle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    (new.raw_app_meta_data ->> 'rolle')::public.rolle
  );
  return new;
end;
$$;

create trigger nach_neuem_benutzer
  after insert on auth.users
  for each row execute function public.neues_profil();

create function public.email_abgleichen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profile set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger nach_email_aenderung
  after update of email on auth.users
  for each row execute function public.email_abgleichen();

-- ---------------------------------------------------------------------------
-- Einstellungen (genau eine Zeile). Die Struktur von `daten` und alle Standardwerte stehen in
-- src/lib/einstellungen.ts; hier liegt nur, was im Admin geändert wurde.
-- ---------------------------------------------------------------------------

create table public.einstellungen (
  id smallint primary key default 1 check (id = 1),
  daten jsonb not null default '{}',
  aktualisiert_am timestamptz not null default now()
);

insert into public.einstellungen (id) values (1);

create trigger einstellungen_aktualisiert
  before update on public.einstellungen
  for each row execute function public.aktualisiert_setzen();

-- ---------------------------------------------------------------------------
-- Leistungen (Website + Terminvergabe)
-- ---------------------------------------------------------------------------

create table public.leistungen (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  kurz text not null default '',
  beschreibung text not null default '',
  kategorie text not null default 'service',
  -- Bruttopreis in Cent. null = Preis nach Absprache.
  preis_cent integer check (preis_cent >= 0),
  preis_ab boolean not null default false,
  -- Arbeitszeit in Minuten. Belegt die Werkstatt so lange, Pausen werden übersprungen.
  dauer_min integer not null default 60 check (dauer_min between 5 and 720),
  online_anfragbar boolean not null default true,
  sichtbar boolean not null default true,
  sortierung integer not null default 0,
  bild_pfad text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create trigger leistungen_aktualisiert
  before update on public.leistungen
  for each row execute function public.aktualisiert_setzen();

insert into public.leistungen (slug, name, kurz, beschreibung, kategorie, preis_cent, preis_ab, dauer_min, sortierung) values
  ('radwechsel', 'Radwechsel', 'Sommer auf Winter oder zurück, inkl. Auswuchten',
   'Radwechsel von Sommer- auf Winterreifen oder zurück, inklusive Auswuchten und Anzug mit dem Drehmomentschlüssel.',
   'reifen', 4000, false, 30, 10),
  ('reifenmontage', 'Reifenmontage', 'Neue Reifen auf die Felge, inkl. Ventil',
   'Montage neuer Reifen auf Ihre Felgen, inklusive Auswuchten, Ventilwechsel und Dichtigkeitsprüfung.',
   'reifen', 10000, false, 60, 20),
  ('raedereinlagerung', 'Rädereinlagerung', 'Ihre Räder lagern sauber bei uns',
   'Wir lagern Ihre Räder trocken und sicher ein, mit Profiltiefe und Zustand dokumentiert. Zum Saisonwechsel erinnern wir Sie.',
   'reifen', null, false, 15, 30),
  ('oelwechsel', 'Ölwechsel inkl. Filter', 'Markenöl, Ölfilter, Service zurückgesetzt',
   'Motorölwechsel mit Markenöl inklusive Ölfilter und Rückstellung der Serviceanzeige.',
   'service', 9500, true, 45, 40),
  ('inspektion', 'Inspektion', 'Wartung nach Herstellervorgabe',
   'Inspektion nach Herstellervorgabe. Den Preis nennen wir Ihnen vorab, abhängig von Fahrzeug und Umfang.',
   'service', null, false, 120, 50),
  ('reparatur', 'Reparatur', 'Bremsen, Fahrwerk, Auspuff und mehr',
   'Reparaturen an Bremsen, Fahrwerk, Abgasanlage und mehr. Beschreiben Sie kurz das Problem, wir melden uns mit einer Einschätzung.',
   'service', null, false, 120, 60),
  ('klimaservice', 'Klimaservice', 'Klimaanlage prüfen und befüllen',
   'Prüfung der Klimaanlage auf Dichtheit, Absaugen, Befüllen mit der vorgeschriebenen Menge Kältemittel.',
   'service', null, false, 60, 70),
  ('hu-vorbereitung', 'HU/AU-Vorbereitung', 'Ihr Auto fit für die Prüfung',
   'Wir prüfen Ihr Fahrzeug vor der Hauptuntersuchung und beheben Mängel, damit die Plakette beim ersten Mal kommt.',
   'service', null, false, 90, 80),
  ('innenraumaufbereitung', 'Innenraumaufbereitung', 'Tiefenreinigung innen, inkl. Polster und Leder',
   'Tiefenreinigung des gesamten Innenraums inklusive Polster- und Lederreinigung, Geruchsbeseitigung und Pflege.',
   'aufbereitung', 17500, false, 180, 90),
  ('aufbereitung-basis', 'Fahrzeugaufbereitung Basis', 'Innen und außen, Handwäsche, Felgen',
   'Komplette Außen- und Innenreinigung inklusive Polster- und Lederreinigung, Handwäsche, Felgenreinigung und Kunststoffpflege.',
   'aufbereitung', 25000, false, 240, 100),
  ('aufbereitung-premium', 'Fahrzeugaufbereitung Premium', 'Politur, Versiegelung, Ozonbehandlung',
   'Komplett-Aufbereitung in Showroom-Qualität inklusive Polster- und Lederreinigung, Lackpolitur, Versiegelung und Ozonbehandlung.',
   'aufbereitung', 50000, false, 480, 110),
  ('hohlraumversiegelung', 'Hohlraumversiegelung', 'Langzeit-Rostschutz für Türen und Schweller',
   'Professioneller Langzeit-Rostschutz für Türen, Schweller und Hohlräume Ihres Fahrzeugs.',
   'schutz', 20000, true, 480, 120),
  ('unterbodenschutz', 'Unterbodenschutz', 'Unterboden reinigen und versiegeln',
   'Reinigung und Versiegelung des Unterbodens.',
   'schutz', 9000, true, 180, 130);

-- ---------------------------------------------------------------------------
-- Kunden und Fahrzeuge
-- ---------------------------------------------------------------------------

create table public.kunden (
  id uuid primary key default gen_random_uuid(),
  nummer integer generated always as identity (start with 10001) unique,
  name text not null,
  firma text not null default '',
  email text not null default '',
  telefon text not null default '',
  strasse text not null default '',
  plz text not null default '',
  ort text not null default '',
  -- Geschäftskunden: USt-IdNr. bzw. Leitweg-ID für E-Rechnungen
  ust_id text not null default '',
  leitweg_id text not null default '',
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index kunden_email_idx on public.kunden (lower(email));
create index kunden_telefon_idx on public.kunden (telefon);

create trigger kunden_aktualisiert
  before update on public.kunden
  for each row execute function public.aktualisiert_setzen();

create table public.fahrzeuge (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.kunden (id) on delete set null,
  kennzeichen text not null,
  -- Für die Suche ohne Leerzeichen und Bindestriche: „OF-AB 123“ = „OFAB123“
  kennzeichen_norm text generated always as (upper(regexp_replace(kennzeichen, '[^A-Za-z0-9ÄÖÜäöü]', '', 'g'))) stored,
  marke_modell text not null default '',
  hsn text not null default '',
  tsn text not null default '',
  fin text not null default '',
  reifengroesse text not null default '',
  km_stand integer,
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create unique index fahrzeuge_kennzeichen_idx on public.fahrzeuge (kennzeichen_norm);
create index fahrzeuge_kunde_idx on public.fahrzeuge (kunde_id);

create trigger fahrzeuge_aktualisiert
  before update on public.fahrzeuge
  for each row execute function public.aktualisiert_setzen();

-- ---------------------------------------------------------------------------
-- Termine (Anfragen, bestätigte Termine und Werkstattaufträge in einem)
-- ---------------------------------------------------------------------------

create table public.termine (
  id uuid primary key default gen_random_uuid(),
  nummer integer generated always as identity (start with 1001) unique,
  status public.termin_status not null default 'angefragt',
  beginn timestamptz not null,
  -- Ende der Arbeit (Pausen sind mitgerechnet) und Ende der Belegung (inkl. Puffer)
  ende timestamptz not null,
  belegt_bis timestamptz not null,
  leistung_id uuid references public.leistungen (id) on delete set null,
  leistung_name text not null,
  kunde_id uuid references public.kunden (id) on delete set null,
  fahrzeug_id uuid references public.fahrzeuge (id) on delete set null,
  notiz_kunde text not null default '',
  notiz_intern text not null default '',
  quelle text not null default 'website' check (quelle in ('website', 'admin', 'api')),
  token text not null unique default public.zufallstoken(),
  -- Unbestätigte Anfragen halten ihren Slot bis zu diesem Zeitpunkt
  halten_bis timestamptz,
  google_event_id text,
  zugewiesen_an uuid references public.profile (id) on delete set null,
  auftrag_status public.auftrag_status not null default 'offen',
  km_stand integer,
  absage_grund text not null default '',
  bestaetigt_am timestamptz,
  erinnerung_am timestamptz,
  bewertung_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  check (ende > beginn and belegt_bis >= ende)
);

create index termine_zeit_idx on public.termine (beginn, belegt_bis);
create index termine_status_idx on public.termine (status, beginn);
create index termine_kunde_idx on public.termine (kunde_id);
create index termine_zugewiesen_idx on public.termine (zugewiesen_an, beginn);

create trigger termine_aktualisiert
  before update on public.termine
  for each row execute function public.aktualisiert_setzen();

create table public.termin_fotos (
  id uuid primary key default gen_random_uuid(),
  termin_id uuid not null references public.termine (id) on delete cascade,
  pfad text not null,
  notiz text not null default '',
  erstellt_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now()
);

create index termin_fotos_termin_idx on public.termin_fotos (termin_id);

-- ---------------------------------------------------------------------------
-- Google-Kalender
-- ---------------------------------------------------------------------------

create table public.kalender_verbindung (
  id smallint primary key default 1 check (id = 1),
  refresh_token text,
  kalender_id text not null default 'primary',
  konto_email text not null default '',
  kanal_id text,
  kanal_resource_id text,
  kanal_token text,
  kanal_ablauf timestamptz,
  letzter_sync timestamptz,
  letzter_fehler text not null default '',
  verbunden_am timestamptz
);

insert into public.kalender_verbindung (id) values (1);

-- Fremde Einträge aus dem Google-Kalender (eigene Termine sind markiert und fehlen hier, sonst zählten
-- sie doppelt). Ganztägige Einträge sperren die ganze Werkstatt, alle anderen einen Arbeitsplatz.
create table public.kalender_belegungen (
  event_id text primary key,
  beginn timestamptz not null,
  ende timestamptz not null,
  ganztaegig boolean not null default false,
  titel text not null default '',
  aktualisiert_am timestamptz not null default now()
);

create index kalender_belegungen_zeit_idx on public.kalender_belegungen (beginn, ende);

-- Höchste gleichzeitige Belegung im Zeitraum [p_beginn, p_bis), ohne den Termin p_ausser.
create function public.belegung_max(p_beginn timestamptz, p_bis timestamptz, p_ausser uuid, p_kapazitaet integer)
returns integer language sql stable set search_path = '' as $$
  with belegt as (
    select t.beginn, t.belegt_bis as bis, 1 as gewicht
    from public.termine t
    where t.id is distinct from p_ausser
      and t.beginn < p_bis and t.belegt_bis > p_beginn
      and (t.status = 'bestaetigt' or (t.status = 'angefragt' and (t.halten_bis is null or t.halten_bis > now())))
    union all
    select k.beginn, k.ende, case when k.ganztaegig then p_kapazitaet else 1 end
    from public.kalender_belegungen k
    where k.beginn < p_bis and k.ende > p_beginn
  ),
  punkte as (
    select p_beginn as zeitpunkt
    union
    select b.beginn from belegt b where b.beginn > p_beginn and b.beginn < p_bis
  )
  select coalesce(max(summe), 0)::integer from (
    select (select coalesce(sum(b.gewicht), 0) from belegt b where b.beginn <= p.zeitpunkt and b.bis > p.zeitpunkt) as summe
    from punkte p
  ) s;
$$;

-- Legt einen Termin an, wenn im Zeitraum noch ein Arbeitsplatz frei ist. Läuft unter einer Sperre,
-- damit zwei gleichzeitige Anfragen nicht beide den letzten Platz bekommen.
create function public.termin_anlegen(p jsonb, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_beginn timestamptz := (p ->> 'beginn')::timestamptz;
  v_bis timestamptz := (p ->> 'belegt_bis')::timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));

  if not p_ueberbuchen and public.belegung_max(v_beginn, v_bis, null, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;

  insert into public.termine (
    status, beginn, ende, belegt_bis, leistung_id, leistung_name, kunde_id, fahrzeug_id,
    notiz_kunde, notiz_intern, quelle, halten_bis, zugewiesen_an, bestaetigt_am
  ) values (
    coalesce((p ->> 'status')::public.termin_status, 'angefragt'),
    v_beginn,
    (p ->> 'ende')::timestamptz,
    v_bis,
    (p ->> 'leistung_id')::uuid,
    p ->> 'leistung_name',
    (p ->> 'kunde_id')::uuid,
    (p ->> 'fahrzeug_id')::uuid,
    coalesce(p ->> 'notiz_kunde', ''),
    coalesce(p ->> 'notiz_intern', ''),
    coalesce(p ->> 'quelle', 'website'),
    (p ->> 'halten_bis')::timestamptz,
    (p ->> 'zugewiesen_an')::uuid,
    case when p ->> 'status' = 'bestaetigt' then now() end
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Bestätigt eine Anfrage. Ist die Haltezeit abgelaufen und der Platz inzwischen weg, schlägt es fehl,
-- außer p_ueberbuchen ist gesetzt (der Inhaber entscheidet bewusst).
create function public.termin_bestaetigen(p_id uuid, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.termine;
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  select * into v from public.termine where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if v.status <> 'angefragt' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;

  if not p_ueberbuchen and public.belegung_max(v.beginn, v.belegt_bis, v.id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;

  update public.termine set status = 'bestaetigt', halten_bis = null, bestaetigt_am = now() where id = p_id;
end;
$$;

-- Verschiebt einen Termin (gleiche Prüfung wie beim Anlegen).
create function public.termin_verschieben(p_id uuid, p_beginn timestamptz, p_ende timestamptz, p_bis timestamptz, p_kapazitaet integer, p_ueberbuchen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('termine', 0));
  if not p_ueberbuchen and public.belegung_max(p_beginn, p_bis, p_id, p_kapazitaet) >= p_kapazitaet then
    raise exception 'SLOT_BELEGT' using errcode = 'P0001';
  end if;
  update public.termine set beginn = p_beginn, ende = p_ende, belegt_bis = p_bis where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rädereinlagerung
-- ---------------------------------------------------------------------------

create table public.einlagerungen (
  id uuid primary key default gen_random_uuid(),
  nummer integer generated always as identity (start with 1) unique,
  kunde_id uuid references public.kunden (id) on delete set null,
  fahrzeug_id uuid references public.fahrzeuge (id) on delete set null,
  lagerplatz text not null default '',
  -- Was eingelagert ist: Sommer- oder Winterräder
  saison text not null default 'sommer' check (saison in ('sommer', 'winter', 'ganzjahr')),
  reifen_marke text not null default '',
  reifengroesse text not null default '',
  dot text not null default '',
  mit_felgen boolean not null default true,
  anzahl smallint not null default 4,
  profil_vl numeric(3, 1),
  profil_vr numeric(3, 1),
  profil_hl numeric(3, 1),
  profil_hr numeric(3, 1),
  preis_cent integer,
  eingelagert_am date not null default current_date,
  ausgelagert_am date,
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index einlagerungen_aktiv_idx on public.einlagerungen (ausgelagert_am, lagerplatz);

create trigger einlagerungen_aktualisiert
  before update on public.einlagerungen
  for each row execute function public.aktualisiert_setzen();

-- ---------------------------------------------------------------------------
-- Artikel und Rechnungen
-- ---------------------------------------------------------------------------

create table public.artikel (
  id uuid primary key default gen_random_uuid(),
  nummer text not null default '',
  name text not null,
  beschreibung text not null default '',
  einheit text not null default 'Stk',
  -- Bruttopreis in Cent (Privatkunden sehen Bruttopreise; netto rechnet die Rechnung).
  preis_brutto_cent integer not null default 0 check (preis_brutto_cent >= 0),
  mwst_satz numeric(4, 2) not null default 19,
  leistung_id uuid references public.leistungen (id) on delete set null,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);

insert into public.artikel (nummer, name, einheit, preis_brutto_cent, leistung_id, sortierung)
select 'L-' || upper(substr(l.slug, 1, 6)), l.name, 'Pauschal', l.preis_cent, l.id, l.sortierung
from public.leistungen l where l.preis_cent is not null;

insert into public.artikel (nummer, name, einheit, preis_brutto_cent, sortierung) values
  ('AW', 'Arbeitszeit', 'Std', 0, 900),
  ('ENT', 'Altreifen-Entsorgung', 'Stk', 0, 910);

-- Nummernkreis: lückenlos fortlaufend. Die Startnummer ist einstellbar, bis die erste Rechnung gestellt ist.
create table public.nummernkreise (
  art text primary key,
  praefix text not null default 'RE-',
  mit_jahr boolean not null default true,
  stellen smallint not null default 4 check (stellen between 1 and 8),
  naechste bigint not null default 1 check (naechste >= 1)
);

insert into public.nummernkreise (art) values ('rechnung');

create table public.rechnungen (
  id uuid primary key default gen_random_uuid(),
  nummer text unique,
  status public.rechnung_status not null default 'entwurf',
  -- Storno: eine eigene Rechnung mit negativen Beträgen, die auf das Original verweist
  storno_zu uuid references public.rechnungen (id) on delete restrict,
  termin_id uuid references public.termine (id) on delete set null,
  kunde_id uuid references public.kunden (id) on delete set null,
  empfaenger jsonb not null default '{}',
  fahrzeug jsonb not null default '{}',
  -- [{ "text", "menge", "einheit", "einzel_brutto_cent", "mwst_satz", "artikel_id" }]
  positionen jsonb not null default '[]',
  rechnungsdatum date,
  leistungsdatum date,
  faellig_am date,
  hinweis text not null default '',
  summe_netto_cent bigint not null default 0,
  summe_mwst_cent bigint not null default 0,
  summe_brutto_cent bigint not null default 0,
  -- Firmendaten zum Zeitpunkt der Rechnungsstellung (Adresse, Bank, Steuernummer)
  firma jsonb,
  token text not null unique default public.zufallstoken(),
  gesendet_am timestamptz,
  gesendet_an text,
  bezahlt_am date,
  zahlungsart text check (zahlungsart in ('bar', 'ueberweisung')),
  erstellt_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  gestellt_am timestamptz,
  aktualisiert_am timestamptz not null default now()
);

create index rechnungen_status_idx on public.rechnungen (status, rechnungsdatum desc);
create index rechnungen_termin_idx on public.rechnungen (termin_id);

create trigger rechnungen_aktualisiert
  before update on public.rechnungen
  for each row execute function public.aktualisiert_setzen();

-- Eine gestellte Rechnung ist unveränderlich (GoBD). Erlaubt bleiben nur Zahlungs- und Versandvermerke
-- sowie der Statuswechsel auf bezahlt/storniert. Korrekturen laufen über eine Stornorechnung.
create function public.rechnung_schuetzen()
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
    new.status = 'entwurf'
  ) then
    raise exception 'Gestellte Rechnungen sind unveränderlich.';
  end if;
  return new;
end;
$$;

create trigger rechnungen_schutz
  before update or delete on public.rechnungen
  for each row execute function public.rechnung_schuetzen();

-- Vergibt die nächste Nummer und stellt die Rechnung. Die Zeile im Nummernkreis ist dabei gesperrt,
-- zwei gleichzeitige Aufrufe bekommen also nie dieselbe Nummer und es entsteht keine Lücke.
create function public.rechnung_stellen(p_id uuid, p_firma jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  k public.nummernkreise;
  r public.rechnungen;
  v_nummer text;
begin
  select * into r from public.rechnungen where id = p_id for update;
  if not found then raise exception 'NICHT_GEFUNDEN' using errcode = 'P0001'; end if;
  if r.status <> 'entwurf' then raise exception 'FALSCHER_STATUS' using errcode = 'P0001'; end if;
  if jsonb_array_length(r.positionen) = 0 then raise exception 'KEINE_POSITIONEN' using errcode = 'P0001'; end if;

  select * into k from public.nummernkreise where art = 'rechnung' for update;
  v_nummer := k.praefix
    || case when k.mit_jahr then to_char(coalesce(r.rechnungsdatum, current_date), 'YYYY') || '-' else '' end
    || lpad(k.naechste::text, k.stellen, '0');
  update public.nummernkreise set naechste = naechste + 1 where art = 'rechnung';

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

-- Startnummer und Format ändern: nur solange noch keine Rechnung gestellt ist.
create function public.nummernkreis_einstellen(p_praefix text, p_mit_jahr boolean, p_stellen smallint, p_naechste bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.rechnungen where nummer is not null) then
    raise exception 'NUMMERNKREIS_GESPERRT' using errcode = 'P0001';
  end if;
  update public.nummernkreise
  set praefix = p_praefix, mit_jahr = p_mit_jahr, stellen = p_stellen, naechste = p_naechste
  where art = 'rechnung';
end;
$$;

-- ---------------------------------------------------------------------------
-- Team: Arbeitszeiten, Abwesenheiten, Zeiterfassung
-- ---------------------------------------------------------------------------

create table public.arbeitszeiten (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profile (id) on delete cascade,
  -- 1 = Montag … 7 = Sonntag
  wochentag smallint not null check (wochentag between 1 and 7),
  beginn time not null,
  ende time not null,
  check (ende > beginn)
);

create index arbeitszeiten_profil_idx on public.arbeitszeiten (profil_id, wochentag);

create table public.abwesenheiten (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profile (id) on delete cascade,
  art public.abwesenheit_art not null default 'urlaub',
  von date not null,
  bis date not null,
  -- Krankmeldungen sind eine Meldung, keine Bitte: sie gelten sofort als genehmigt.
  status public.abwesenheit_status not null default 'beantragt',
  notiz text not null default '',
  entschieden_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  check (bis >= von)
);

create index abwesenheiten_zeit_idx on public.abwesenheiten (von, bis);

create table public.zeiteintraege (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profile (id) on delete cascade,
  beginn timestamptz not null,
  ende timestamptz,
  notiz text not null default '',
  korrigiert_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  check (ende is null or ende > beginn)
);

-- Pro Person höchstens ein laufender Eintrag
create unique index zeiteintraege_offen_idx on public.zeiteintraege (profil_id) where ende is null;
create index zeiteintraege_zeit_idx on public.zeiteintraege (profil_id, beginn desc);

-- ---------------------------------------------------------------------------
-- Karriere
-- ---------------------------------------------------------------------------

create table public.stellen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(titel) between 1 and 160),
  umfang text not null default 'Vollzeit',
  einleitung text not null default '',
  aufgaben text not null default '',
  profil text not null default '',
  wir_bieten text not null default '',
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create trigger stellen_aktualisiert
  before update on public.stellen
  for each row execute function public.aktualisiert_setzen();

insert into public.stellen (titel, umfang, einleitung, aufgaben, profil, wir_bieten, sortierung) values
  ('Kfz-Mechatroniker (m/w/d)', 'Vollzeit',
   'Für unsere Werkstatt in Dietzenbach suchen wir Verstärkung. Kleiner Betrieb, direkter Draht zum Meister.',
   'Reifenservice, Ölwechsel und Inspektionen' || chr(10) || 'Reparaturen an Bremsen und Fahrwerk' || chr(10) || 'Fehlersuche mit dem Diagnosegerät',
   'Abgeschlossene Ausbildung als Kfz-Mechatroniker oder vergleichbar' || chr(10) || 'Führerschein Klasse B',
   'Feste Arbeitszeiten, samstags nur bis 13 Uhr' || chr(10) || 'Moderne Ausstattung' || chr(10) || 'Kurze Wege, schnelle Entscheidungen',
   1);

create table public.bewerbungen (
  id uuid primary key default gen_random_uuid(),
  nummer integer generated always as identity (start with 1001) unique,
  status public.bewerbung_status not null default 'neu',
  stelle_id uuid references public.stellen (id) on delete set null,
  stelle text not null,
  name text not null,
  telefon text not null,
  email text not null default '',
  nachricht text not null default '',
  lebenslauf_pfad text,
  lebenslauf_name text,
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  abgeschlossen_am timestamptz
);

create index bewerbungen_status_idx on public.bewerbungen (status, erstellt_am desc);

create trigger bewerbungen_aktualisiert
  before update on public.bewerbungen
  for each row execute function public.aktualisiert_setzen();

-- Setzt abgeschlossen_am bei Zusage/Absage (Grundlage für die automatische Löschung nach 6 Monaten).
create function public.bewerbung_abschluss()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('zusage', 'absage') then
    if tg_op = 'INSERT' or old.status is distinct from new.status then new.abgeschlossen_am = now(); end if;
  else
    new.abgeschlossen_am = null;
  end if;
  return new;
end;
$$;

create trigger bewerbungen_abschluss
  before insert or update of status on public.bewerbungen
  for each row execute function public.bewerbung_abschluss();

-- ---------------------------------------------------------------------------
-- Website: Galerie und Bewertungen
-- ---------------------------------------------------------------------------

create table public.galerie (
  id uuid primary key default gen_random_uuid(),
  titel text not null default '',
  beschreibung text not null default '',
  vorher_pfad text not null,
  nachher_pfad text not null,
  sichtbar boolean not null default true,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);

create table public.bewertungen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  sterne smallint not null default 5 check (sterne between 1 and 5),
  quelle text not null default 'Google',
  sichtbar boolean not null default true,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);

insert into public.bewertungen (name, text, sortierung) values
  ('Ruan Sonnen', 'Super Service rund ums Auto, einfache unkomplizierte Terminvereinbarung und qualitativ hochwertige Arbeit. Dringend weiterzuempfehlen!', 1),
  ('Sam Paxton', 'Sehr professionelle und kompetente Werkstatt. Die Mitarbeiter sind freundlich und wissen genau, was sie tun. Die Arbeiten wurden schnell und sauber erledigt.', 2),
  ('A. F.', 'War schon mehrfach mit meinem Auto dort und immer sehr zufrieden. Besonders der freundliche Service und die ehrliche Beratung zeichnen den Betrieb aus.', 3);

-- ---------------------------------------------------------------------------
-- Offenheit: Ereignisse, Webhooks, API-Schlüssel, Push
-- ---------------------------------------------------------------------------

-- Jede fachliche Änderung schreibt ein Ereignis (z. B. termin.bestaetigt). Externe Dienste bekommen es
-- über Webhooks oder holen es über /api/v1/ereignisse ab.
create table public.ereignisse (
  id bigint generated always as identity primary key,
  typ text not null,
  daten jsonb not null default '{}',
  erstellt_am timestamptz not null default now()
);

create index ereignisse_typ_idx on public.ereignisse (typ, id);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null check (url ~ '^https://'),
  geheimnis text not null default public.zufallstoken(),
  -- Ereignistypen, z. B. {termin.angefragt, rechnung.gestellt}; {*} = alle
  typen text[] not null default '{*}',
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);

create table public.webhook_zustellungen (
  id bigint generated always as identity primary key,
  webhook_id uuid not null references public.webhooks (id) on delete cascade,
  ereignis_id bigint not null references public.ereignisse (id) on delete cascade,
  status text not null default 'offen' check (status in ('offen', 'ok', 'fehler')),
  versuche smallint not null default 0,
  naechster_versuch timestamptz not null default now(),
  letzte_antwort text not null default '',
  aktualisiert_am timestamptz not null default now(),
  unique (webhook_id, ereignis_id)
);

create index webhook_zustellungen_offen_idx on public.webhook_zustellungen (naechster_versuch) where status = 'offen';

create table public.api_schluessel (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Die ersten Zeichen zum Wiedererkennen; gespeichert wird nur der SHA-256-Hash des Schlüssels.
  praefix text not null,
  hash text not null unique,
  rechte text[] not null default '{lesen}',
  erstellt_am timestamptz not null default now(),
  zuletzt_benutzt timestamptz,
  widerrufen_am timestamptz
);

create table public.push_abos (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profile (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  geraet text not null default '',
  erstellt_am timestamptz not null default now()
);

-- Merkt sich, was eine Automatik schon erledigt hat (Erinnerung, Bewertungsbitte, Saison-Mail …),
-- damit ein wiederholter Lauf nichts doppelt verschickt.
create table public.automatik_log (
  art text not null,
  bezug text not null,
  erstellt_am timestamptz not null default now(),
  primary key (art, bezug)
);

-- Verlauf für Termine, Rechnungen und Bewerbungen
create table public.verlauf (
  id bigint generated always as identity primary key,
  bezug_typ text not null,
  bezug_id uuid not null,
  text text not null,
  von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now()
);

create index verlauf_bezug_idx on public.verlauf (bezug_typ, bezug_id, erstellt_am desc);

-- ---------------------------------------------------------------------------
-- Schutz der öffentlichen Formulare (wie im Projekt davidtnl)
-- ---------------------------------------------------------------------------

create table public.formular_versuche (
  id bigint generated always as identity primary key,
  schluessel text not null,
  erstellt_am timestamptz not null default now()
);

create index formular_versuche_schluessel_idx on public.formular_versuche (schluessel, erstellt_am);

create function public.versuch_zaehlen(schluessel text, maximal integer, fenster_sekunden integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(versuch_zaehlen.schluessel, 0));
  if (
    select count(*) from public.formular_versuche v
    where v.schluessel = versuch_zaehlen.schluessel
      and v.erstellt_am > now() - make_interval(secs => fenster_sekunden)
  ) >= maximal then
    return false;
  end if;
  insert into public.formular_versuche (schluessel) values (versuch_zaehlen.schluessel);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zugriff: alles nur über den Server
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'einstellungen', 'leistungen', 'kunden', 'fahrzeuge', 'termine', 'termin_fotos',
    'kalender_verbindung', 'kalender_belegungen', 'einlagerungen', 'artikel', 'nummernkreise', 'rechnungen',
    'arbeitszeiten', 'abwesenheiten', 'zeiteintraege', 'stellen', 'bewerbungen', 'galerie', 'bewertungen',
    'ereignisse', 'webhooks', 'webhook_zustellungen', 'api_schluessel', 'push_abos', 'automatik_log',
    'verlauf', 'formular_versuche'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.belegung_max(timestamptz, timestamptz, uuid, integer)',
    'public.termin_anlegen(jsonb, integer, boolean)',
    'public.termin_bestaetigen(uuid, integer, boolean)',
    'public.termin_verschieben(uuid, timestamptz, timestamptz, timestamptz, integer, boolean)',
    'public.rechnung_stellen(uuid, jsonb)',
    'public.nummernkreis_einstellen(text, boolean, smallint, bigint)',
    'public.versuch_zaehlen(text, integer, integer)',
    'public.zufallstoken()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Speicher
-- ---------------------------------------------------------------------------

-- Öffentlich: Bilder und Videos der Website (Galerie, Leistungen, Startseite)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website', 'website', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

-- Privat: Lebensläufe und Fotos aus der Werkstatt. Zugriff nur über kurzlebige signierte Links vom Server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bewerbungen', 'bewerbungen', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('auftragsfotos', 'auftragsfotos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;
