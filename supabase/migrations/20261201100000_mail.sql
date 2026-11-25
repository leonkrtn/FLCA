-- Mail in der Anwendung: Empfangen über Resend (MX der Domain zeigt auf Resend, Webhook „email.received“
-- an /api/mail/eingang), Lesen und Antworten in Verwaltung, Werkstatt-App und Team-App.
--
-- Jede Person hat ein eigenes Postfach (vorname.nachname@domain, siehe src/lib/mail/adressen.ts), dazu gibt
-- es das Firmenpostfach (postfach = null) für info@, termine@ und alle anderen Adressen der Domain.
-- Inhaber und Büro sehen das Firmenpostfach, jede Person nur ihr eigenes.

-- Eigener Teil vor dem @, wenn er nicht aus dem Namen kommen soll (leer = vorname.nachname)
alter table public.profile add column if not exists mail_name text;
alter table public.profile drop constraint if exists profile_mail_name_muster;
alter table public.profile add constraint profile_mail_name_muster check (mail_name is null or mail_name ~ '^[a-z0-9]+([._-][a-z0-9]+)*$');
create unique index if not exists profile_mail_name_idx on public.profile (mail_name) where mail_name is not null;

create table if not exists public.mails (
  id uuid primary key default gen_random_uuid(),
  -- null = Firmenpostfach. Eine Mail an zwei Postfächer steht zweimal da (je Postfach gelesen, gelöscht).
  postfach uuid references public.profile (id) on delete cascade,
  richtung text not null check (richtung in ('eingang', 'ausgang')),
  -- Kennung bei Resend: verhindert doppelte Ablage, wenn Resend den Webhook wiederholt
  resend_id text,
  -- Für den Verlauf: Antworten finden ihr Gespräch über In-Reply-To/References, sonst über den Betreff
  message_id text,
  referenzen text not null default '',
  gespraech uuid not null default gen_random_uuid(),
  von text not null,
  von_name text not null default '',
  an text[] not null default '{}',
  cc text[] not null default '{}',
  antwort_an text,
  betreff text not null default '',
  text text not null default '',
  html text,
  -- [{ "name": "...", "typ": "application/pdf", "groesse": 12345, "pfad": "eingang/…" }] im Speicher „mail“
  anhaenge jsonb not null default '[]',
  gelesen_am timestamptz,
  gesendet_von uuid references public.profile (id) on delete set null,
  erstellt_am timestamptz not null default now()
);
create unique index if not exists mails_resend_idx on public.mails (resend_id, postfach) nulls not distinct where resend_id is not null;
create index if not exists mails_postfach_idx on public.mails (postfach, erstellt_am desc);
create index if not exists mails_gespraech_idx on public.mails (gespraech, erstellt_am);
create index if not exists mails_message_idx on public.mails (message_id) where message_id is not null;
create index if not exists mails_ungelesen_idx on public.mails (postfach) where gelesen_am is null and richtung = 'eingang';

-- Privat: Anhänge ein- und ausgehender Mails, angezeigt über kurzlebige signierte Links vom Server
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail', 'mail', false, 41943040)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Zugriff nur serverseitig (wie alle Tabellen)
-- ---------------------------------------------------------------------------
alter table public.mails enable row level security;
revoke all on public.mails from anon, authenticated;
