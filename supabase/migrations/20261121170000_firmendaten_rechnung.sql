-- Firmendaten für Rechnungen aus den bisherigen Rechnungen (Word-Vorlage bis Nr. 0136): Steuernummer,
-- Bankverbindung und die richtige Schreibweise der Straße. Wer die Firmendaten einmal in den Einstellungen
-- gespeichert hat, hat dort leere Felder, die die Standardwerte im Code verdecken. Deshalb hier nur leere
-- Felder füllen, Eingetragenes bleibt.

update public.einstellungen
set daten = jsonb_set(
  coalesce(daten, '{}'::jsonb),
  '{firma}',
  coalesce(daten -> 'firma', '{}'::jsonb)
    || case when coalesce(daten #>> '{firma,steuernummer}', '') = '' then '{"steuernummer": "028 809 61487"}'::jsonb else '{}'::jsonb end
    || case when coalesce(daten #>> '{firma,iban}', '') = '' then '{"iban": "DE62 5085 2651 0148 0241 93"}'::jsonb else '{}'::jsonb end
    || case when coalesce(daten #>> '{firma,bic}', '') = '' then '{"bic": "HELADEF1DIE"}'::jsonb else '{}'::jsonb end
    || case when coalesce(daten #>> '{firma,bank}', '') = '' then '{"bank": "Sparkasse Dieburg"}'::jsonb else '{}'::jsonb end
    || case when daten #>> '{firma,strasse}' = 'Siemenstraße 15' then '{"strasse": "Siemensstraße 15"}'::jsonb else '{}'::jsonb end
)
where id = 1;
