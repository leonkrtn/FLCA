-- Angebote: zeitlich begrenzte Preisnachlässe auf die Preisliste (z. B. „Reifensaison −20 %“).
--
-- Ein Angebot trifft ganze Kategorien (nur Leistungen, keine Teile) und/oder einzeln gewählte Positionen.
-- Es ändert die Preisliste nicht: Website, Terminbuchung und Belege rechnen den Angebotspreis beim Anzeigen
-- aus dem Listenpreis aus (src/lib/angebote/preise.ts). Läuft es ab, gilt ohne weiteres Zutun wieder der
-- Listenpreis. Treffen mehrere Angebote dieselbe Leistung, gilt der günstigste Preis, nichts wird addiert.

create table public.angebote (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(titel) between 1 and 80),
  kurztext text not null default '',
  bedingungen text not null default '',
  bild_pfad text,
  -- prozent: wert in ganzen Prozent; euro: wert in Cent weniger; festpreis: wert = Bruttopreis in Cent
  art text not null check (art in ('prozent', 'euro', 'festpreis')),
  wert integer not null check (wert >= 0),
  kategorien text[] not null default '{}',
  leistung_ids uuid[] not null default '{}',
  -- Ganze Tage in Berlin. bis = null: läuft, bis es ausgeschaltet wird.
  von date not null,
  bis date,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  check (bis is null or bis >= von),
  check (art <> 'prozent' or wert between 1 and 100)
);

create index angebote_laufzeit on public.angebote (von, bis) where aktiv;

create trigger angebote_aktualisiert
  before update on public.angebote
  for each row execute function public.aktualisiert_setzen();

-- Stichtag ist der Tag der Anfrage: Der Angebotspreis wird am Termin festgehalten und gilt für die Rechnung,
-- auch wenn der Termin nach dem Ende des Angebots liegt. Schlüssel = leistungen.id.
alter table public.termine
  add column if not exists angebot_preise jsonb not null default '{}';

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.angebote enable row level security;
revoke all on public.angebote from anon, authenticated;
