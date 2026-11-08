-- Angebot: Leistungen der Website und Positionen für Rechnungen werden eine Liste.
--
-- Vorher gab es zwei Tabellen mit demselben Preis (leistungen für die Website, artikel für Rechnungen).
-- Wurde einer geändert, zeigte die Website etwas anderes als die Rechnung. Jetzt ist leistungen die
-- einzige Liste. Neu sind die Felder für Rechnungen (Nummer, Einheit, MwSt.), die Art und „aktiv“.
--
-- art = 'leistung': Arbeit mit Dauer. Kann auf die Website, kann gebucht und als Termin eingetragen werden.
-- art = 'position': Teil, Material, Zuschlag (Ventil, Arbeitszeit, Altreifen). Nur für Rechnungen.
--
-- Nach dieser Migration wird die Tabelle artikel nicht mehr benutzt. Sie bleibt zur Sicherheit stehen
-- und kann später gelöscht werden: drop table public.artikel;
-- Gestellte Rechnungen ändern sich nicht, sie speichern ihre Positionen selbst.

alter table public.leistungen
  add column if not exists nummer text not null default '',
  add column if not exists einheit text not null default 'Pauschal',
  add column if not exists mwst_satz numeric(4, 2) not null default 19 check (mwst_satz in (0, 7, 19)),
  add column if not exists art text not null default 'leistung' check (art in ('leistung', 'position')),
  add column if not exists aktiv boolean not null default true;

-- Mit einer Leistung verknüpfte Artikel: Nummer, Einheit und MwSt. übernehmen. Der Preis bleibt der
-- von der Website, nur wo die Website „auf Anfrage“ hatte, gilt der Artikelpreis.
update public.leistungen l
set nummer = a.nummer,
    einheit = a.einheit,
    mwst_satz = a.mwst_satz,
    preis_cent = coalesce(l.preis_cent, nullif(a.preis_brutto_cent, 0))
from (
  select distinct on (leistung_id) *
  from public.artikel
  where leistung_id is not null
  order by leistung_id, aktiv desc, sortierung
) a
where a.leistung_id = l.id;

-- Artikel ohne Leistung werden Positionen: nicht auf der Website, nicht buchbar.
insert into public.leistungen (slug, name, beschreibung, kategorie, preis_cent, preis_ab, dauer_min, online_anfragbar, sichtbar, sortierung, nummer, einheit, mwst_satz, art, aktiv)
select
  'position-' || substr(replace(a.id::text, '-', ''), 1, 10),
  a.name,
  a.beschreibung,
  'service',
  a.preis_brutto_cent,
  false,
  60,
  false,
  false,
  1000 + a.sortierung,
  a.nummer,
  a.einheit,
  a.mwst_satz,
  'position',
  a.aktiv
from public.artikel a
where a.leistung_id is null
on conflict (slug) do nothing;

comment on table public.artikel is 'Nicht mehr benutzt, ersetzt durch leistungen (Angebot). Kann gelöscht werden.';
