# CLAUDE.md

@AGENTS.md

## Projekt

FLC Automotive (Kfz-Service Ciurli, Dietzenbach): öffentliche Website mit Terminanfrage, Verwaltung (`/admin`), Werkstatt-App (`/app`) und Team-App (`/team`) als Web-Apps fürs iPhone. Einrichtung und Funktionsumfang stehen in der README.

Alles ist **deutsch**: UI-Texte, Code-Bezeichner, Kommentare, Routen (`termin`, `rechnungen`, `einlagerung`). Kommentare erklären das *Warum*. Neuer Code folgt dieser Konvention.

## Befehle

```bash
npm run dev | build | lint | typecheck | test
```

## Architektur

- **Zugriff:** Alle Tabellen haben RLS ohne Richtlinien. Gelesen und geschrieben wird nur serverseitig mit `db()` (`src/lib/supabase/admin.ts`, Secret Key), und zwar erst nach `benutzerMitRecht(bereich)` (`src/lib/auth.ts`). Rollen und Rechte: `src/lib/rollen.ts`. `src/proxy.ts` leitet nur nicht Angemeldete um, die Rolle prüft jede Seite und Server Action selbst.
- **Umgebungsvariablen** nur über `src/lib/env.ts` (`ENV`, `KONFIGURIERT`).
- **Dienste** hinter Schnittstellen in `src/lib/services/` (Mail, Kalender, Push). Feature-Code ruft `mailer()`, `kalender()`, `pushSenden()` auf, nie Resend oder Google direkt.
- **Termine:** `src/lib/termine.ts` ist der einzige Weg, Termine anzulegen, zu bestätigen, zu verschieben oder abzusagen (Mails, Kalender, Ereignisse hängen daran). Kapazitätsprüfung in der Datenbank (`termin_anlegen`, `termin_bestaetigen`, `termin_verschieben` mit Advisory-Lock); `src/lib/slots.ts` rechnet dieselbe Logik für die Anzeige freier Zeiten.
- **Zeit:** immer über `src/lib/zeit.ts` (Europe/Berlin per Intl, nie feste +01:00).
- **Geld:** Cent als Ganzzahl, Preise brutto. Netto/Steuer rechnet nur `src/lib/rechnung/berechnung.ts`.
- **Rechnungen:** gestellte Rechnungen sind unveränderlich (Trigger `rechnung_schuetzen`), Nummern vergibt nur `rechnung_stellen`. Das PDF entsteht nur in `pdfErzeugen` (`src/lib/rechnung/rechnungen.ts`) aus den gespeicherten Daten, mit eingebetteter ZUGFeRD-XML.
- **Ereignisse:** jede fachliche Änderung ruft `melden(typ, daten)` (`src/lib/ereignisse.ts`). Neue Typen dort eintragen; Webhooks und `/api/v1/ereignisse` liefern sie automatisch aus.
- **Takt:** `/api/cron/takt` (alle 10 Minuten aus Supabase pg_cron) ruft `takt()` in `src/lib/automatik.ts`. Jede Aufgabe ist über `automatik_log` idempotent.
- **Server Actions** für Formulare liegen in `src/lib/aktionen/*` und geben `Ergebnis` (`src/lib/forms.ts`) zurück; Admin und Handy-Apps teilen sie.
- **Migrationen** in `supabase/migrations/` werden vom Betreiber selbst im SQL-Editor ausgeführt. Neue Tabellen in den RLS-Block am Ende aufnehmen.

## Gestaltung

Richtung „Auftragskarte“: warmes Hellgrau (`boden`), Schwarz, **Verkehrsrot nur für die Termin-Handlung**. Schrift: Barlow Condensed für Überschriften (`.schmal`, passt zur schmalen Grotesk im Logo), Barlow für Text, Zahlen in Barlow mit gleich breiten Ziffern (`.zahlen`, rechtsbündig). Keine Monospace-Schrift, keine Ziermuster, keine Emojis, keine Deko-Icons, keine Karten-Raster. Logo: `src/components/logo.tsx`, Vektor aus der Originaldatei nachgezeichnet (`src/assets/logo-pfade.json`). Tokens in `src/app/globals.css`.
