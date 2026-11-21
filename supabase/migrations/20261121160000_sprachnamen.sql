-- Weitere Namen beim Sprechen: Wie man einen Eintrag der Preisliste im Alltag nennt, wenn es nicht die
-- Bezeichnung ist („Klima auffüllen“ für „Klimaanlagen-Service“). Die Werkstatt-App erkennt beim Sprechen
-- die Bezeichnung und diese Namen. Neue Einträge und Umbenennungen braucht sie nicht, die liest sie immer
-- frisch aus der Preisliste.

alter table public.leistungen add column if not exists sprachnamen text[] not null default '{}';

comment on column public.leistungen.sprachnamen is 'Weitere Namen, unter denen die Spracheingabe den Eintrag erkennt';
