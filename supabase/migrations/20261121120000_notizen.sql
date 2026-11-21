-- Notizen mit optionaler Erinnerung per Push.
--
-- Eine Notiz ist privat (sehen nur die Person, die sie angelegt hat, und die Person, an die erinnert wird)
-- oder fürs Büro (Inhaber und Büro). Sie kann an einem Kunden oder Termin hängen und erscheint dann auch dort.
--
-- Erinnerung: erinnern_am ist der nächste fällige Zeitpunkt. Der 10-Minuten-Takt schickt den Push und trägt
-- erinnert_am ein. Bei einer Wiederholung rückt erinnern_am danach auf den nächsten Zeitpunkt vor (gleiche
-- Uhrzeit in Berlin, auch über die Zeitumstellung). „Erledigt“ beendet die Notiz samt Wiederholung.

create table public.notizen (
  id uuid primary key default gen_random_uuid(),
  titel text not null default '' check (char_length(titel) <= 200),
  text text not null default '' check (char_length(text) <= 5000),
  sichtbar text not null default 'privat' check (sichtbar in ('privat', 'buero')),
  erstellt_von uuid references public.profile (id) on delete set null,
  kunde_id uuid references public.kunden (id) on delete set null,
  termin_id uuid references public.termine (id) on delete set null,
  erinnern_am timestamptz,
  wiederholung text not null default 'keine' check (wiederholung in ('keine', 'taeglich', 'woechentlich', 'monatlich')),
  -- Empfänger der Push-Nachricht; leer = die Person, die die Notiz angelegt hat
  erinnern_an uuid references public.profile (id) on delete set null,
  erinnert_am timestamptz,
  erledigt_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  check (wiederholung = 'keine' or erinnern_am is not null)
);

create index notizen_faellig_idx on public.notizen (erinnern_am) where erledigt_am is null and erinnern_am is not null;
create index notizen_kunde_idx on public.notizen (kunde_id) where kunde_id is not null;
create index notizen_termin_idx on public.notizen (termin_id) where termin_id is not null;
create index notizen_person_idx on public.notizen (erstellt_von, erinnern_an);

create trigger notizen_aktualisiert
  before update on public.notizen
  for each row execute function public.aktualisiert_setzen();

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.notizen enable row level security;
revoke all on public.notizen from anon, authenticated;
