-- Stornorechnungen, bei denen nichts zu erstatten ist, gelten als erledigt.
--
-- Bisher blieb jedes Storno auf „gestellt“ mit negativem Betrag und Fälligkeit. War das Original nicht bezahlt
-- (oder hat eine Korrektur die Zahlung übernommen), zog es die Summe „offen“ ein zweites Mal ab und wurde nach
-- dem Zahlungsziel als „überfällig“ angezeigt. Neue Stornos setzt die App gleich so (stornieren() in
-- src/lib/rechnung/rechnungen.ts); hier werden die vorhandenen einmal nachgezogen.
--
-- Offen bleibt nur das Storno einer bezahlten Rechnung ohne Korrektur: Dort ist der Betrag zu erstatten.
-- zahlungsart bleibt leer, daran erkennt die Verwaltung „erledigt ohne Zahlung“. Der Trigger
-- rechnung_schuetzen erlaubt Status, bezahlt_am und faellig_am.

update public.rechnungen s
set status = 'bezahlt', bezahlt_am = coalesce(s.rechnungsdatum, current_date), faellig_am = null
from public.rechnungen o
where s.storno_zu = o.id
  and s.status = 'gestellt'
  and (
    o.bezahlt_am is null
    or exists (select 1 from public.rechnungen k where k.korrektur_zu = o.id and k.status <> 'entwurf')
  );
