-- Gemerkte Preise je Fahrzeugtyp und Pakete.
--
-- Produkte und Arbeiten kosten je Auto unterschiedlich viel. Beim Stellen einer Rechnung merkt sich jede
-- Position ihren Preis für Marke + Modell des Fahrzeugs (VW Golf). Beim nächsten Golf setzt der Editor den
-- jüngsten Preis direkt ein. Eine Zeile je Marke, Modell und Bezeichnung: Der jüngste Preis überschreibt
-- den älteren (Vergleich unscharf, siehe src/lib/rechnung/aehnlich.ts).
--
-- Pakete sind benannte Gruppen von Positionen (Bremsen vorne = Lohn + Scheiben + Beläge), ebenfalls je
-- Marke + Modell. Benannt werden sie beim Stellen der Rechnung.
--
-- Belege werden ab jetzt netto erfasst. Das ändert nur die gespeicherten Positionen neuer Belege
-- (einzel_netto_cent statt einzel_brutto_cent), gestellte Rechnungen bleiben, wie sie sind.

-- Marke und Modell getrennt, damit „so ein Auto“ zuverlässig erkannt wird. marke_modell bleibt als
-- zusammengesetzter Text für alle Anzeigen bestehen und wird von der App mitgeschrieben.
alter table public.fahrzeuge
  add column if not exists marke text not null default '',
  add column if not exists modell text not null default '';

create table public.preis_gedaechtnis (
  id uuid primary key default gen_random_uuid(),
  marke text not null,
  modell text not null,
  marke_norm text not null,
  modell_norm text not null,
  text text not null,
  text_norm text not null,
  einheit text not null default 'Stk',
  menge numeric(12, 3) not null default 1,
  -- Netto in Cent, auf Hundertstel Cent genau (wie im Beleg)
  einzel_netto_cent numeric(14, 2) not null,
  mwst_satz numeric(4, 2) not null default 19,
  lohnart text,
  ek_cent numeric(14, 2),
  aufschlag numeric(7, 2),
  artikel_id uuid references public.leistungen (id) on delete set null,
  rechnung_id uuid references public.rechnungen (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (marke_norm, modell_norm, text_norm)
);

create index preis_gedaechtnis_typ_idx on public.preis_gedaechtnis (marke_norm, modell_norm);

create trigger preis_gedaechtnis_aktualisiert
  before update on public.preis_gedaechtnis
  for each row execute function public.aktualisiert_setzen();

create table public.pakete (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_norm text not null,
  -- leer = ohne Fahrzeugbezug
  marke text not null default '',
  modell text not null default '',
  marke_norm text not null default '',
  modell_norm text not null default '',
  -- Positionen wie im Beleg (netto), ohne Rabattzeilen
  positionen jsonb not null default '[]',
  rechnung_id uuid references public.rechnungen (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (name_norm, marke_norm, modell_norm)
);

create trigger pakete_aktualisiert
  before update on public.pakete
  for each row execute function public.aktualisiert_setzen();

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.preis_gedaechtnis enable row level security;
revoke all on public.preis_gedaechtnis from anon, authenticated;
alter table public.pakete enable row level security;
revoke all on public.pakete from anon, authenticated;
