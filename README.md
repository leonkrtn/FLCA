# FLC Automotive: Website und Betriebssystem

Website, Terminvergabe, Werkstatt-Verwaltung, Rechnungen, Team und Karriere für FLC Automotive (Kfz-Service Ciurli, Dietzenbach). Next.js 16 auf Vercel, Supabase als Datenbank, Resend für Mails, Google Kalender als Terminkalender.

## Was drin ist

| Bereich | Adresse | Für wen |
| --- | --- | --- |
| Website | `/`, `/leistungen`, `/galerie`, `/karriere`, `/impressum`, `/datenschutz`, `/agb` | Kunden |
| Terminanfrage | `/termin` | Kunden: Leistung → freie Zeit → Name, Telefon, E-Mail, Kennzeichen |
| Kundenlink | `/t/<token>` (Termin ansehen, absagen), `/r/<token>` (Rechnungs-PDF) | Kunden, ohne Login |
| Verwaltung | `/admin` | Inhaber und Büro, am Rechner |
| Werkstatt-App | `/app` | Inhaber und Büro, als Web-App auf dem Handy |
| Team-App | `/team` | Mitarbeiter, als Web-App auf dem Handy |
| Schnittstelle | `/api/v1/…`, Webhooks | n8n, Make, Zapier, eigene Skripte |

**Termine.** Kunden sehen nur Zeiten, die frei sind: Öffnungszeiten minus bestätigte Termine minus offene Anfragen minus Einträge im Google-Kalender. Wie viele Autos gleichzeitig gehen, steht in den Einstellungen. Eine Anfrage hält ihren Termin 48 Stunden (einstellbar), bis sie angenommen oder abgelehnt wird. Doppelbuchungen verhindert die Datenbank selbst (`termin_anlegen` mit Sperre), nicht nur die Oberfläche. Bestätigte Termine landen im Google-Kalender. Was Flavio direkt in Google einträgt, blockiert freie Zeiten: mit Uhrzeit einen Arbeitsplatz, ganztägig die ganze Werkstatt (Betriebsurlaub), „Verfügbar“ markiert gar nichts.

**Rechnungen.** Entwurf aus dem Termin (Leistung mit Festpreis ist schon eingetragen), Positionen aus dem Artikelstamm oder frei, Preise brutto. Beim Stellen bekommt die Rechnung eine lückenlose Nummer und ist danach unveränderlich (Datenbank-Trigger). Korrektur nur über eine Stornorechnung. Das PDF enthält einen GiroCode und die E-Rechnung als `factur-x.xml` (ZUGFeRD, Profil EN 16931). DATEV-Export als ZIP (Buchungsstapel + PDFs) unter Rechnungen oder automatisch am Monatsersten an den Steuerberater.

**Team.** Arbeitszeiten je Person, Urlaub beantragen und genehmigen, krank melden, Zeiterfassung (pro Person einschaltbar), Aufträge zuweisen, Status und Fotos aus der Team-App.

**Offen für mehr.** Jede fachliche Änderung erzeugt ein Ereignis (`termin.angefragt`, `rechnung.bezahlt` …, Liste in `src/lib/ereignisse.ts`). Ereignisse gehen an Webhooks (HMAC-signiert, mit Wiederholungen) und sind über `GET /api/v1/ereignisse?nach=<id>` abrufbar. Externe Dienste (Mail, Kalender, Push) stecken hinter Schnittstellen in `src/lib/services/`; ein anderer Anbieter ist eine neue Datei, kein Umbau.

## Einrichtung

### 1. Supabase

1. Projekt anlegen, Region **Frankfurt (eu-central-1)**.
2. Im SQL-Editor nacheinander ausführen:
   - `supabase/migrations/20261108100000_grundsystem.sql`
   - `supabase/migrations/20261108100100_zeitsteuerung.sql`, **vorher** die Platzhalter `<<WEBSITE_URL>>` und `<<CRON_SECRET>>` ersetzen.
3. *Authentication → Sign In / Providers*: „Allow new users to sign up“ **aus** (Konten legt nur der Inhaber an), Provider „Email“ an.
4. *Authentication → Emails → SMTP Settings*: eigenen SMTP eintragen, sonst schickt Supabase nur 2 Mails pro Stunde. Mit Resend: Host `smtp.resend.com`, Port 465, Benutzer `resend`, Passwort = Resend-API-Key, Absender wie `MAIL_FROM`.
5. *Authentication → Emails → Templates*: In „Invite user“ und „Reset password“ den Link ersetzen durch
   `{{ .SiteURL }}/auth/bestaetigen?token_hash={{ .TokenHash }}&type=invite` bzw. `…&type=recovery`.
   *URL Configuration*: Site URL = `https://flc-automotive.de`.
6. Ersten Inhaber anlegen: *Authentication → Users → Add user* (Auto Confirm an), dann im SQL-Editor:
   ```sql
   update public.profile set rolle = 'inhaber', name = 'Flavio Ciurli' where email = 'info@flc-automotive.de';
   ```
   Weitere Personen lädt der Inhaber danach unter *Team* ein.

### 2. Resend

Domain `flc-automotive.de` anlegen, die DNS-Einträge (SPF, DKIM, optional DMARC) beim Domain-Anbieter setzen, warten bis „Verified“. Absender z. B. `FLC Automotive <termine@flc-automotive.de>`. Antworten der Kunden gehen an die Firmen-E-Mail aus den Einstellungen (Reply-To), also ins Gmail-Postfach.

### 3. Google Kalender

Mit Google Workspace (info@flc-automotive.de):

1. [Google Cloud Console](https://console.cloud.google.com/) → neues Projekt → *APIs & Services → Library* → „Google Calendar API“ aktivieren.
2. *OAuth consent screen*: User Type **Internal** (nur Konten der eigenen Workspace-Domain; keine Prüfung durch Google nötig, Tokens laufen nicht nach 7 Tagen ab). Scope `…/auth/calendar.events`.
3. *Credentials → Create credentials → OAuth client ID → Web application*. Weiterleitungs-URI: `https://flc-automotive.de/api/google/rueckruf`.
4. Client-ID und Secret in Vercel eintragen (unten), deployen, dann in der Verwaltung *Einstellungen → Google Kalender → Mit Google verbinden*.

Ohne Workspace (normales Gmail) ist der User Type „External“. Dann den Status auf „In production“ stellen, sonst verfällt die Verbindung nach 7 Tagen.

Google meldet Änderungen per Webhook an `/api/google/webhook`. Fällt das aus, gleicht der 10-Minuten-Takt trotzdem ab, und vor jeder Anzeige freier Termine wird abgeglichen, wenn der letzte Abgleich älter als 5 Minuten ist.

### 4. Push-Nachrichten

Einmal lokal `npx web-push generate-vapid-keys` ausführen und die beiden Schlüssel eintragen. Auf dem iPhone kommt Push nur an, wenn die Web-App über *Teilen → Zum Home-Bildschirm* installiert ist (ab iOS 16.4). Jede Person schaltet Push in ihrer App unter *Mehr* selbst ein.

### 5. Vercel

Projekt aus dem Repo anlegen, Region ist über `vercel.json` Frankfurt. Umgebungsvariablen aus `.env.example`:

| Variable | Woher |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://flc-automotive.de` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | zufällig, z. B. `openssl rand -hex 32`; derselbe Wert wie in der Zeitsteuerungs-Migration |

Der kostenlose Hobby-Tarif ist laut Vercel nur für nicht-kommerzielle Nutzung. Für den Livegang auf **Pro** wechseln. Der kostenlose Supabase-Tarif pausiert Projekte nach einer Woche ohne Aktivität; der 10-Minuten-Takt hält es wach, für den Betrieb trotzdem Pro empfehlen (tägliche Backups).

### 6. In der Verwaltung

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
