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
- **Dienste** hinter Schnittstellen in `src/lib/services/` (Mail, Push). Feature-Code ruft `mailer()` und `pushSenden()` auf, nie Resend direkt.
- **Termine:** `src/lib/termine.ts` ist der einzige Weg, Termine anzulegen, zu bestätigen, zu verschieben oder abzusagen oder zu löschen (Mails und Ereignisse hängen daran). Kapazitätsprüfung in der Datenbank (`termin_anlegen`, `termin_bestaetigen`, `termin_verschieben` mit Advisory-Lock); `src/lib/slots.ts` rechnet dieselbe Logik für die Anzeige freier Zeiten.
- **Zeit:** immer über `src/lib/zeit.ts` (Europe/Berlin per Intl, nie feste +01:00).
- **Geld:** Cent. Preisliste und Website brutto (runde Preise), Belege netto (`einzel_netto_cent`, auf Hundertstel Cent genau, damit runde Listenpreise brutto rund bleiben). Alte Belege haben `einzel_brutto_cent` und rechnen unverändert. Netto/Steuer/Rabatt rechnet nur `src/lib/rechnung/berechnung.ts`.
- **Gemerkte Preise:** `merken()` in `src/lib/rechnung/preisgedaechtnis.ts` läuft nach `stellen()`; Vergleich von Marke/Modell und Bezeichnungen nur über `src/lib/rechnung/aehnlich.ts`.
- **Rechnungen:** gestellte Rechnungen sind unveränderlich (Trigger `rechnung_schuetzen`), Nummern vergibt nur `rechnung_stellen`. Das PDF entsteht nur in `pdfErzeugen` (`src/lib/rechnung/rechnungen.ts`) aus den gespeicherten Daten, mit eingebetteter ZUGFeRD-XML.
- **Ereignisse:** jede fachliche Änderung ruft `melden(typ, daten)` (`src/lib/ereignisse.ts`). Neue Typen dort eintragen; Webhooks und `/api/v1/ereignisse` liefern sie automatisch aus.
- **Takt:** `/api/cron/takt` (jede Minute aus Supabase pg_cron) ruft `takt()` in `src/lib/automatik.ts`. Jede Aufgabe ist über `automatik_log` idempotent.
- **Sprache:** `src/lib/sprache/` versteht gesprochenen Text mit festen Regeln (kein KI-Dienst) und füllt nur vor: Notiz und Termin über die Adresse des Formulars (`vorgabe.ts`), Rechnung als Entwurf (`src/lib/aktionen/sprache.ts`). Läuft im Browser (Vorschau) und auf dem Server, deshalb ohne Abhängigkeiten. Neue Redewendungen mit Test in `verstehen.test.ts`.
- **Server Actions** für Formulare liegen in `src/lib/aktionen/*` und geben `Ergebnis` (`src/lib/forms.ts`) zurück; Admin und Handy-Apps teilen sie.
- **Migrationen** in `supabase/migrations/` werden vom Betreiber selbst im SQL-Editor ausgeführt. Neue Tabellen in den RLS-Block am Ende aufnehmen.

## Gestaltung

Öffentliche Website **dunkel** (Klasse `.dunkel` im Layout von `(site)` dreht die Farbwerte um), Verwaltung und Handy-Apps hell. Farbnamen sind semantisch: `boden` = Grund, `tinte` = Schrift, `flaeche` = Karte/Feld, `hell` = Weiß auf Foto/Video. Nie `weiss`/`schwarz` fest verdrahten, sonst kippt eine der beiden Welten. Auf der Website **kein Rot**: Akzent ist ein gedämpftes Hellgrau (der Token `rot` ist dort umgestellt), weiche Kontraste, Fehler in `text-fehler`. Wenig Rundung (Karten `rounded-lg`, Knöpfe und Chips 6 px). Website: große Barlow-Condensed-Überschriften (`.schmal`), Bildkacheln mit Preis-Chips statt Tabellen. In der hellen Verwaltung bleibt Verkehrsrot für Hinweise und Zähler. Zahlen in Barlow mit gleich breiten Ziffern (`.zahlen`). Keine Monospace-Schrift, keine Emojis, keine Deko-Icons. Startvideo unter `public/medien/start.{webm,mp4}`, Standbild `src/assets/start-standbild.jpg`; ein Video aus der Verwaltung (Website → Texte und Bilder) hat Vorrang. Logo: `src/components/logo.tsx`. Tokens in `src/app/globals.css`.
