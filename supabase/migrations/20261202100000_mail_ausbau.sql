-- Postfach wie Outlook: Ordner, Kennzeichnen, Anheften, Kategorien, Zuweisen, Erinnern, Entwürfe,
-- Senden mit „Rückgängig“ und zu einem späteren Zeitpunkt, Zustellstatus von Resend.
-- Setzt 20261201100000_mail.sql voraus. Mehrfach ausführbar.

alter table public.mails
  -- eingang = Posteingang, sonstige = Mails an nicht festgelegte Adressen der Domain (nur Firmenpostfach),
  -- ausgang = geplant (Rückgängig-Frist oder später senden), gesendet, entwuerfe, archiv, papierkorb
  add column if not exists ordner text not null default 'eingang',
  -- Ordner vor dem Löschen, damit „Wiederherstellen“ dorthin zurückgeht
  add column if not exists ordner_vorher text,
  -- Seit wann im Papierkorb; nach 30 Tagen löscht der Takt endgültig
  add column if not exists geloescht_am timestamptz,
  add column if not exists gekennzeichnet boolean not null default false,
  add column if not exists angeheftet boolean not null default false,
  add column if not exists kategorien uuid[] not null default '{}',
  -- Mail im Firmenpostfach einer Person zum Erledigen gegeben (sieht sie dann auch ohne Zugriff aufs Firmenpostfach)
  add column if not exists zugewiesen_an uuid references public.profile (id) on delete set null,
  -- „Später erinnern“: bis dahin nicht im Posteingang, danach wieder oben und ungelesen
  add column if not exists erinnern_am timestamptz,
  -- Sortierung der Liste: Eingang, Senden oder Wiederauftauchen nach dem Erinnern
  add column if not exists oben_am timestamptz,
  -- Versand: geplant (Zeitpunkt in senden_am), laeuft (gerade abgeholt), fehler (versand_fehler)
  add column if not exists senden_am timestamptz,
  add column if not exists versand text,
  add column if not exists versand_fehler text,
  -- Zustellung laut Resend: zugestellt, verzoegert, abgewiesen, beschwerde
  add column if not exists zustellung text,
  add column if not exists zustellung_am timestamptz,
  add column if not exists bcc text[] not null default '{}',
  add column if not exists antwort_auf uuid references public.mails (id) on delete set null,
  -- Adresse der Domain, an die eine eingegangene Mail ging (Antworten gehen von dort)
  add column if not exists ziel_adresse text;

alter table public.mails drop constraint if exists mails_ordner_pruefen;
alter table public.mails add constraint mails_ordner_pruefen check (ordner in ('eingang', 'sonstige', 'ausgang', 'gesendet', 'entwuerfe', 'archiv', 'papierkorb'));
alter table public.mails drop constraint if exists mails_versand_pruefen;
alter table public.mails add constraint mails_versand_pruefen check (versand is null or versand in ('geplant', 'laeuft', 'fehler'));

-- Bestehende Mails einsortieren
update public.mails set ordner = 'gesendet' where richtung = 'ausgang' and ordner = 'eingang';
update public.mails set oben_am = erstellt_am where oben_am is null;
alter table public.mails alter column oben_am set default now();
alter table public.mails alter column oben_am set not null;

create index if not exists mails_ordner_idx on public.mails (postfach, ordner, oben_am desc);
create index if not exists mails_zugewiesen_idx on public.mails (zugewiesen_an) where zugewiesen_an is not null;
create index if not exists mails_erinnern_idx on public.mails (erinnern_am) where erinnern_am is not null;
create index if not exists mails_senden_idx on public.mails (senden_am) where versand = 'geplant';
create index if not exists mails_papierkorb_idx on public.mails (geloescht_am) where ordner = 'papierkorb';
create index if not exists mails_von_idx on public.mails (von);
create index if not exists mails_an_idx on public.mails using gin (an);

-- Kategorien mit Farbe (Einstellungen → E-Mail)
create table if not exists public.mail_kategorien (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  farbe text not null default 'grau',
  sortierung integer not null default 0,
  erstellt_am timestamptz not null default now()
);

-- Signatur je Person (pflegt der Inhaber) und Push für Mails pro Person abschaltbar
alter table public.profile
  add column if not exists jobbezeichnung text not null default '',
  add column if not exists signatur_telefon text not null default '',
  add column if not exists mail_push boolean not null default true;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.mail_kategorien enable row level security;
revoke all on public.mail_kategorien from anon, authenticated;
