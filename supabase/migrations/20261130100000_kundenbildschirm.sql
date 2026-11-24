-- Kundenbildschirm: ein eigener Rechner im Büro, zum Kunden gedreht, mit Tastatur und Maus. Kunden tragen dort
-- ihre Daten selbst ein (neu oder als Bestandskunde über Kennzeichen oder Telefon) und unterschreiben den
-- Werkstattauftrag. Geöffnet wird er über einen Gerätelink mit geheimem Schlüssel (`/kundenbildschirm/<schluessel>`),
-- ohne Anmeldung; der Schlüssel lässt sich in der Verwaltung jederzeit sperren (Zeile löschen).

create table if not exists public.kundenbildschirme (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Kundenbildschirm' check (btrim(name) <> ''),
  schluessel text not null unique check (schluessel ~ '^[a-f0-9]{48}$'),
  -- Vom Büro geschickter Auftrag zum Unterschreiben; der Bildschirm fragt regelmäßig danach
  termin_id uuid references public.termine (id) on delete set null,
  geschickt_am timestamptz,
  -- Wann der Bildschirm zuletzt nachgefragt hat: zeigt in der Verwaltung, ob er läuft
  zuletzt_gesehen timestamptz,
  erstellt_am timestamptz not null default now()
);

-- Was Kunden am Bildschirm eingetragen haben: Hinweis in der Verwaltung, bis jemand es gesehen hat
create table if not exists public.kundenbildschirm_eingaben (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.kunden (id) on delete cascade,
  art text not null check (art in ('neu', 'geaendert', 'unterschrift')),
  text text not null default '',
  gesehen_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index if not exists kundenbildschirm_eingaben_offen_idx on public.kundenbildschirm_eingaben (erstellt_am desc) where gesehen_am is null;

-- Einwilligungen des Kunden, mit Zeitpunkt (null = nicht erteilt bzw. widerrufen)
alter table public.kunden add column if not exists datenschutz_am timestamptz;
alter table public.kunden add column if not exists whatsapp_ok_am timestamptz;
alter table public.kunden add column if not exists erinnerung_mail_ok_am timestamptz;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.kundenbildschirme enable row level security;
revoke all on public.kundenbildschirme from anon, authenticated;
alter table public.kundenbildschirm_eingaben enable row level security;
revoke all on public.kundenbildschirm_eingaben from anon, authenticated;
