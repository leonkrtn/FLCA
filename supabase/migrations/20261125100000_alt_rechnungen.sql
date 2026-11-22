-- Frühere Rechnungen aus der Zeit vor dem System (Datenübernahme in Einstellungen → Datenübernahme).
--
-- Bewusst eine eigene Tabelle und nicht `rechnungen`: Diese Belege sind längst gestellt und versendet. In
-- `rechnungen` bekämen sie Nummern aus dem Nummernkreis, landeten im DATEV-Export (der Steuerberater hätte
-- sie doppelt) und würden als PDF neu erzeugt, obwohl das Original das gültige ist. Hier stehen sie nur
-- zum Nachschlagen in der Kundenakte: was wann gemacht wurde und was es gekostet hat.
--
-- `datei` (Name des Original-PDFs) ist eindeutig: Dieselbe Datei zweimal einlesen legt nichts doppelt an.

create table if not exists public.alt_rechnungen (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.kunden (id) on delete set null,
  fahrzeug_id uuid references public.fahrzeuge (id) on delete set null,
  -- Nummer wie auf dem Beleg; im Altbestand nicht eindeutig
  nummer text not null default '',
  -- Neufassung einer schon geschriebenen Rechnung (Dateiname mit „.1“), zählt nicht zum Umsatz
  korrektur boolean not null default false,
  rechnungsdatum date,
  leistungsdatum date,
  -- Anschrift wie auf dem Beleg: { name, strasse, plz, ort, land }
  empfaenger jsonb not null default '{}',
  kennzeichen text not null default '',
  km_stand integer,
  steuer text not null default '19' check (steuer in ('19', 'kleinunternehmer')),
  netto_cent bigint,
  mwst_cent bigint,
  brutto_cent bigint,
  -- Was zu zahlen war: Sonderpreis, mit durchlaufenden Posten (TÜV) oder brutto
  endbetrag_cent bigint,
  regulaer_cent bigint,
  zahlart text not null default '',
  -- [{ "pos", "text", "menge", "einzel_cent", "summe_cent" }] wie auf dem Beleg (netto bzw. ohne USt)
  positionen jsonb not null default '[]',
  datei text not null unique,
  importiert_am timestamptz not null default now()
);

create index if not exists alt_rechnungen_kunde_idx on public.alt_rechnungen (kunde_id, rechnungsdatum desc);
create index if not exists alt_rechnungen_fahrzeug_idx on public.alt_rechnungen (fahrzeug_id);

-- Zugriff: alles nur über den Server (wie im RLS-Block der Grundmigration)
alter table public.alt_rechnungen enable row level security;
revoke all on public.alt_rechnungen from anon, authenticated;
