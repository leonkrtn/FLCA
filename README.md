# FLC Automotive: Website und Betriebssystem

Website, Terminvergabe, Werkstatt-Verwaltung, Rechnungen, Team und Karriere für FLC Automotive (Kfz-Service Ciurli, Dietzenbach). Next.js 16 auf Vercel, Supabase als Datenbank, Resend für Mails.

## Was drin ist

| Bereich | Adresse | Für wen |
| --- | --- | --- |
| Website | `/`, `/leistungen`, `/galerie`, `/karriere`, `/impressum`, `/datenschutz`, `/agb` | Kunden |
| Terminanfrage | `/termin` | Kunden: Leistung → freie Zeit → Name, Telefon, E-Mail, Kennzeichen |
| Kundenlink | `/t/<token>` (Termin ansehen, absagen), `/r/<token>` (Rechnungs-PDF), `/k/<token>` (Kostenvoranschlag ansehen, annehmen) | Kunden, ohne Login |
| Verwaltung | `/admin` | Inhaber und Büro, am Rechner |
| Werkstatt-App | `/app` | Inhaber und Büro, als Web-App auf dem Handy |
| Team-App | `/team` | Mitarbeiter, als Web-App auf dem Handy |
| Schnittstelle | `/api/v1/…`, Webhooks | n8n, Make, Zapier, eigene Skripte |

**Termine.** Kunden sehen nur Zeiten, die frei sind: Öffnungszeiten minus bestätigte Termine minus offene Anfragen. Wie viele Autos gleichzeitig gehen, steht in den Einstellungen. Eine Anfrage hält ihren Termin 48 Stunden (einstellbar), bis sie angenommen oder abgelehnt wird. Doppelbuchungen verhindert die Datenbank selbst (`termin_anlegen` mit Sperre), nicht nur die Oberfläche. Alle Termine stehen im Wochenkalender der Verwaltung; einen externen Kalender gibt es nicht.

**Preisliste.** Eine Liste für alles mit Preis: Leistungen (mit Dauer, auf der Website, online buchbar oder nicht) und Teile, Material, Zuschläge (nur für Rechnungen). Jeder Preis steht nur dort; Website, Terminbuchung und die Rechnung zum Termin lesen ihn von da.

**Rechnungen.** Entwurf aus dem Termin (Leistung mit Festpreis ist schon eingetragen), Positionen aus der Preisliste, aus einem Paket oder frei. Preise werden **netto** eingegeben (brutto steht klein daneben); Leistungen aus der Preisliste kommen netto in den Beleg und ergeben brutto wieder den runden Listenpreis. Einheit „Std“ ist Lohn: Lohnart wählen, Stunden eintragen, der Stundensatz kommt aus *Einstellungen → Rechnungen*. Teile (Stk, l, Satz) können einen Einkaufspreis haben, der Verkaufspreis entsteht mit dem Standard-Aufschlag, je Position änderbar; Einkauf und Rohertrag stehen nur im Editor. Ein Rabatt (Prozent oder Euro) ist eine eigene Zeile und gilt für alle Positionen. Beim Stellen bekommt die Rechnung eine lückenlose Nummer und ist danach unveränderlich (Datenbank-Trigger). Korrektur nur über eine Stornorechnung. Das PDF (PDF/A-3) enthält einen GiroCode und die E-Rechnung als `factur-x.xml` (ZUGFeRD, Profil EN 16931). Steht beim Empfänger eine Leitweg-ID (Behörde), wird daraus eine XRechnung 3.0; die reine XML gibt es dann zusätzlich als Mail-Anhang und als Download für die Rechnungsportale von Bund und Ländern. Vor dem Stellen prüft das System die Pflichtangaben der E-Rechnung. DATEV-Export als ZIP (Buchungsstapel + PDFs) unter Rechnungen oder automatisch am Monatsersten an den Steuerberater.

**Kostenvoranschläge.** Wie eine Rechnung aufgebaut (gleicher Editor, Preise netto). Beim Abschließen gibt es eine eigene Nummer (`KV-`) und der Inhalt ist eingefroren; für Änderungen „Als neuen Entwurf kopieren“. Der Kunde bekommt PDF und Link per Mail und nimmt online an oder lehnt ab (Push an Inhaber und Büro), alternativ vermerkt man seine Antwort von Hand. „In Rechnung übernehmen“ legt einen Rechnungsentwurf mit denselben Positionen an. Gültigkeit, Einleitung und Fußtext unter *Einstellungen → Rechnungen*.

**Gemerkte Preise.** Produkte und Arbeiten kosten je Auto unterschiedlich viel. Beim Stellen einer Rechnung merkt sich jede Position Preis, Menge bzw. Stunden und Einkauf für Marke + Modell des Fahrzeugs (VW Golf). Beim nächsten Auto dieser Art setzt der Editor den jüngsten Preis direkt ein und schreibt darunter, woher er kommt. Bezeichnungen werden unscharf verglichen („Bremsscheiben VA“ = „Bremsscheibe vorne“), Marken auch („VW“ = „Volkswagen“). Ohne Marke und Modell gilt nur die Preisliste. Beim Stellen lassen sich Positionen als **Paket** benennen („Bremsen vorne“); im Editor fügt „+ Paket“ alle Positionen ein, von einem anderen Modell mit Warnung. Übersicht, Korrektur und Löschen unter *Gemerkte Preise*. Marke und Modell sind in der Kundenkartei zwei Felder mit Vorschlägen; ältere Fahrzeuge mit nur einem Feld werden geschätzt getrennt und beim ersten Beleg nachgetragen.

**Kundenauswahl.** Neue Rechnungen und Kostenvoranschläge beginnen mit einer Suche (Name, Firma, Telefon, E-Mail, Kennzeichen, Kundennummer); ein Tipp übernimmt Empfänger und Fahrzeug. Im Entwurf geht das über „Kunden übernehmen“ jederzeit nachträglich.

**Werkstatt-App.** Das „+“ in der Leiste öffnet eine kurze Auswahl: Termin, Kostenvoranschlag, Rechnung oder Kunde (mit erstem Fahrzeug) anlegen.

**Notizen.** In der Verwaltung, in der Werkstatt-App (auch über das „+“) und an Kunden und Terminen. Jede Notiz ist „nur ich“ oder „Büro“ (Inhaber und Büro) und kann eine Erinnerung haben: Datum und Uhrzeit, einmalig oder täglich, wöchentlich, monatlich, an sich selbst oder eine andere Person (Mitarbeiter sehen ihre Erinnerungen in der Team-App). Der Minutentakt schickt den Push zur eingestellten Minute; fällige Erinnerungen stehen bis „Erledigt“ oben in der App und zählen im Menü.

**Team.** Arbeitszeiten je Person, Urlaub beantragen und genehmigen, krank melden, Zeiterfassung (pro Person einschaltbar), Aufträge zuweisen, Status und Fotos aus der Team-App.

**Offen für mehr.** Jede fachliche Änderung erzeugt ein Ereignis (`termin.angefragt`, `rechnung.bezahlt` …, Liste in `src/lib/ereignisse.ts`). Ereignisse gehen an Webhooks (HMAC-signiert, mit Wiederholungen) und sind über `GET /api/v1/ereignisse?nach=<id>` abrufbar. Externe Dienste (Mail, Push) stecken hinter Schnittstellen in `src/lib/services/`; ein anderer Anbieter ist eine neue Datei, kein Umbau.

## Einrichtung

### 1. Supabase

1. Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. Im SQL-Editor nacheinander ausführen:
   - `supabase/migrations/20261108100000_grundsystem.sql`
   - `supabase/migrations/20261109100000_angebot.sql` (Leistungen und Rechnungspositionen in einer Liste)
   - `supabase/migrations/20261120100000_kostenvoranschlaege.sql` (Kostenvoranschläge mit eigenem Nummernkreis)
   - `supabase/migrations/20261121100000_termine_loeschen.sql` (Termine endgültig löschen, Auftragsnummern rücken nach)
   - `supabase/migrations/20261121110000_google_kalender_entfernen.sql` (Google-Kalender entfernt)
   - `supabase/migrations/20261121120000_notizen.sql` (Notizen mit Erinnerung per Push)
   - `supabase/migrations/20261121140000_preisgedaechtnis.sql` (Marke/Modell getrennt, gemerkte Preise je Fahrzeugtyp, Pakete)
   - Zuletzt die Zeitsteuerung: `supabase/zeitsteuerung-einrichten.sql` (Adresse darin prüfen, derzeit `https://flca.vercel.app`). Das Skript richtet den Takt jede Minute ein und zeigt in der Spalte `cron_secret_fuer_vercel` das Geheimnis; diesen Wert in Vercel als `CRON_SECRET` eintragen und neu deployen. Jederzeit wiederholbar. Ist das Geheimnis verloren, vorher `select cron.unschedule('flc-takt');` ausführen, dann gibt es ein neues. (Ersetzt `20261108100100_zeitsteuerung.sql` und `20261121130000_zeitsteuerung_minuetlich.sql`.)
3. *Authentication → Sign In / Providers*: „Allow new users to sign up“ **aus** (Konten legt nur der Inhaber an), Provider „Email“ an.
4. *Authentication → Emails → SMTP Settings*: eigenen SMTP eintragen, sonst schickt Supabase nur 2 Mails pro Stunde. Mit Resend: Host `smtp.resend.com`, Port 465, Benutzer `resend`, Passwort = Resend-API-Key, Absender wie `MAIL_FROM`.
5. *Authentication → Emails → Templates*: In „Invite user“ und „Reset password“ den Link ersetzen durch
   `{{ .SiteURL }}/auth/bestaetigen?token_hash={{ .TokenHash }}&type=invite` bzw. `…&type=recovery`.
   *URL Configuration*: Site URL = Adresse der Website, derzeit `https://flca.vercel.app` (später `https://flc-automotive.de`).
6. Ersten Inhaber anlegen: *Authentication → Users → Add user* (Auto Confirm an), dann im SQL-Editor:
   ```sql
   update public.profile set rolle = 'inhaber', name = 'Flavio Ciurli' where email = 'info@flc-automotive.de';
   ```
   Weitere Personen lädt der Inhaber danach unter *Team* ein.

### 2. Resend

Domain `flc-automotive.de` anlegen, die DNS-Einträge (SPF, DKIM, optional DMARC) beim Domain-Anbieter setzen, warten bis „Verified“. Absender z. B. `FLC Automotive <termine@flc-automotive.de>`. Antworten der Kunden gehen an die Firmen-E-Mail aus den Einstellungen (Reply-To), also ins Gmail-Postfach.

### 3. Push-Nachrichten

Einmal lokal `npx web-push generate-vapid-keys` ausführen und die beiden Schlüssel eintragen. Auf dem iPhone kommt Push nur an, wenn die Web-App über *Teilen → Zum Home-Bildschirm* installiert ist (ab iOS 16.4). Jede Person schaltet Push in ihrer App unter *Mehr* selbst ein.

### 4. Vercel

Projekt aus dem Repo anlegen, Region ist über `vercel.json` Frankfurt. Umgebungsvariablen aus `.env.example`:

| Variable | Woher |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | derzeit `https://flca.vercel.app`, später `https://flc-automotive.de` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | aus `supabase/zeitsteuerung-einrichten.sql` (Spalte `cron_secret_fuer_vercel`) |

Der kostenlose Hobby-Tarif ist laut Vercel nur für nicht-kommerzielle Nutzung. Für den Livegang auf **Pro** wechseln. Der kostenlose Supabase-Tarif pausiert Projekte nach einer Woche ohne Aktivität; der Minutentakt hält es wach, für den Betrieb trotzdem Pro empfehlen (tägliche Backups).

### Umzug auf die eigene Domain

Die Website läuft derzeit unter `https://flca.vercel.app`. Beim Wechsel auf `https://flc-automotive.de`:

1. Vercel: Domain hinzufügen, `NEXT_PUBLIC_SITE_URL` auf `https://flc-automotive.de` setzen, neu deployen.
2. Supabase: *Authentication → URL Configuration* → Site URL ändern.
3. Supabase-SQL-Editor: in `supabase/zeitsteuerung-einrichten.sql` die Adresse ändern und ausführen. Das Geheimnis bleibt gleich, `CRON_SECRET` in Vercel muss nicht angefasst werden.
4. Die Web-Apps auf den Handys einmal vom Home-Bildschirm löschen und unter der neuen Adresse neu hinzufügen (Push neu einschalten).

### 5. In der Verwaltung

*Einstellungen → Firma*: **Steuernummer oder USt-IdNr. und IBAN** eintragen (ohne Steuernummer lässt sich keine Rechnung stellen). *Rechnungen*: Nummernkreis festlegen (nur bis zur ersten Rechnung änderbar). *Rechtstexte*: Adressen des Rechtstexte-Dienstes. *Automatik*: DATEV-Kontonummern mit dem Steuerberater abstimmen.

## Entwicklung

```bash
npm install
cp .env.example .env.local   # ohne Supabase läuft die Website mit Startdaten, Verwaltung braucht Supabase
npm run dev
npm test                     # Zeitrechnung, freie Slots, Rechnungsbeträge, PDF mit E-Rechnung
npm run typecheck
npm run lint
```

## Schnittstelle

`GET /api/v1/<ressource>` mit `Authorization: Bearer flc_…` (Schlüssel unter *Einstellungen → Schnittstellen*):

- `termine?status=bestaetigt&von=2026-12-01&bis=2026-12-08`
- `kunden`, `rechnungen?status=gestellt`
- `ereignisse?nach=<letzte id>` zum Abholen neuer Ereignisse
- `frei?leistung=radwechsel&von=2026-12-01&tage=7` freie Startzeiten

Webhook-Signatur prüfen (Node):

```js
const [t, v1] = header.split(",").map((x) => x.split("=")[1]);
const ok = crypto.createHmac("sha256", geheimnis).update(`${t}.${rohBody}`).digest("hex") === v1;
```
