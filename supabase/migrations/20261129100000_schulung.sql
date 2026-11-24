-- Schulung: Lektionen für die Team-App, gepflegt in der Verwaltung (Schulung).
--
-- Eine Lektion gehört zu genau einer Kategorie, hat Text (festes Format, siehe src/lib/schulung/inhalt.ts),
-- optional ein Video (YouTube- oder Vimeo-Link) und Bilder im privaten Speicher „schulung“.
-- Nur veröffentlichte und nicht archivierte Lektionen sieht das Team. Archivierte lassen sich zurückholen
-- oder aus dem Archiv endgültig löschen.

create table if not exists public.schulung_kategorien (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);

create table if not exists public.schulung_lektionen (
  id uuid primary key default gen_random_uuid(),
  -- Eine Kategorie mit Lektionen lässt sich nicht löschen (auch nicht mit archivierten): erst verschieben.
  kategorie_id uuid not null references public.schulung_kategorien (id) on delete restrict,
  titel text not null check (btrim(titel) <> ''),
  kurz text not null default '',
  inhalt text not null default '',
  video_url text,
  dauer_min integer check (dauer_min is null or dauer_min > 0),
  schlagwoerter text[] not null default '{}',
  werkzeug text not null default '',
  sicherheit text not null default '',
  -- Leistungen der Preisliste: Am Auftrag in der Team-App steht dann „Anleitung“ zur Lektion
  leistung_ids uuid[] not null default '{}',
  -- „Siehe auch“: andere Lektionen; gelöschte fallen beim Anzeigen heraus
  siehe_auch uuid[] not null default '{}',
  veroeffentlicht boolean not null default false,
  archiviert_am timestamptz,
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  aktualisiert_von uuid references public.profile (id) on delete set null
);
create index if not exists schulung_lektionen_kategorie_idx on public.schulung_lektionen (kategorie_id, sortierung);
create index if not exists schulung_lektionen_leistungen_idx on public.schulung_lektionen using gin (leistung_ids);

drop trigger if exists schulung_lektionen_aktualisiert on public.schulung_lektionen;
create trigger schulung_lektionen_aktualisiert
  before update on public.schulung_lektionen
  for each row execute function public.aktualisiert_setzen();

-- Zum Start zwei Kategorien, frei umbenennbar
insert into public.schulung_kategorien (name, sortierung)
select x.name, x.sortierung from (values ('Die App', 0), ('Werkstattarbeiten', 1)) as x (name, sortierung)
where not exists (select 1 from public.schulung_kategorien);

-- Privat: Bilder der Lektionen, angezeigt über kurzlebige signierte Links vom Server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('schulung', 'schulung', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.schulung_kategorien enable row level security;
revoke all on public.schulung_kategorien from anon, authenticated;
alter table public.schulung_lektionen enable row level security;
revoke all on public.schulung_lektionen from anon, authenticated;
