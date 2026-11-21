-- Jede Zeit anfragbar, Antwort mit Ja, Nein oder Gegenvorschlag.
--
-- Kunden können auf der Website jede Uhrzeit innerhalb der Öffnungszeiten anfragen, auch wenn sie belegt ist.
-- Solche Anfragen halten nichts frei (halten_bis = Zeitpunkt der Anfrage) und sind mit wunschzeit_frei = false
-- markiert. Der Betrieb sagt zu, lehnt ab oder schlägt eine andere Zeit vor: Dann rückt der Termin auf die
-- vorgeschlagene Zeit (die er wie jede Anfrage bis halten_bis hält), die Wunschzeit bleibt in wunsch_beginn, und
-- der Kunde nimmt den Vorschlag über seinen Link an oder lehnt ihn ab.

alter table public.termine add column if not exists wunschzeit_frei boolean not null default true;
alter table public.termine add column if not exists wunsch_beginn timestamptz;
alter table public.termine add column if not exists vorschlag_am timestamptz;
alter table public.termine add column if not exists vorschlag_nachricht text not null default '';

comment on column public.termine.wunschzeit_frei is 'War die Wunschzeit bei der Anfrage frei (sonst: Anfrage trotz belegter Zeit)';
comment on column public.termine.wunsch_beginn is 'Ursprüngliche Wunschzeit des Kunden, wenn ein Gegenvorschlag gemacht wurde';
comment on column public.termine.vorschlag_am is 'Wann der letzte Gegenvorschlag an den Kunden ging (offen, solange der Termin angefragt ist)';
