# FLC Automotive: Website und Betriebssystem

Website, Terminvergabe, Werkstatt-Verwaltung, Rechnungen, Team und Karriere für FLC Automotive (Kfz-Service Ciurli, Dietzenbach). Next.js 16 auf Vercel, Supabase als Datenbank, Resend für Mails.

## Was drin ist

| Bereich | Adresse | Für wen |
| --- | --- | --- |
| Website | `/`, `/leistungen`, `/galerie`, `/karriere`, `/impressum`, `/datenschutz`, `/agb` | Kunden |
| Terminanfrage | `/termin` | Kunden: eine oder mehrere Leistungen → freie Zeit → Name, Telefon, E-Mail, Kennzeichen |
| Kundenlink | `/t/<token>` (Termin ansehen, absagen), `/r/<token>` (Rechnungs-PDF), `/k/<token>` (Kostenvoranschlag ansehen, annehmen) | Kunden, ohne Login |
| Verwaltung | `/admin` | Inhaber und Büro, am Rechner |
| Werkstatt-App | `/app` | Inhaber und Büro, als Web-App auf dem Handy |
| Team-App | `/team` | Mitarbeiter, als Web-App auf dem Handy |
| Schnittstelle | `/api/v1/…`, Webhooks | n8n, Make, Zapier, eigene Skripte |

**Termine.** Kunden können jede Uhrzeit in der Öffnungszeit anfragen. Freie Zeiten (Öffnungszeiten minus bestätigte Termine minus offene Anfragen) stehen normal da und werden mit der Anfrage gehalten; belegte stehen gestrichelt da und lassen sich trotzdem anfragen, halten aber nichts frei. Jede Anfrage wird in der Verwaltung oder Werkstatt-App mit Ja, Nein oder einem Gegenvorschlag beantwortet: Die Entscheidung zeigt, ob die Wunschzeit frei ist, und bietet freie Zeiten in der Nähe zum Vorschlagen mit einem Klick an. Beim Gegenvorschlag rückt die Anfrage auf die neue Zeit und hält sie, der Kunde bekommt eine Mail und sagt auf seiner Terminseite „Passt“ (Termin ist bestätigt) oder „Passt nicht“ (Anfrage zurückgezogen); der Betrieb bekommt die Antwort per Push und Mail. Wie viele Autos gleichzeitig gehen, steht in den Einstellungen. Sobald bei mindestens einer Person „Nimmt Aufträge an“ angehakt ist, muss zusätzlich ein passender Mitarbeiter frei sein (siehe *Mitarbeiter*); vorher zählen nur Öffnungszeiten und Arbeitsplätze. Ein Termin kann mehrere Leistungen haben (Website, Verwaltung und Werkstatt-App); sie werden nacheinander erledigt, die Dauer ist die Summe, belegt wird ein Arbeitsplatz. Eine Anfrage hält ihren Termin 48 Stunden (einstellbar), bis sie angenommen oder abgelehnt wird. Doppelbuchungen verhindert die Datenbank selbst (`termin_anlegen` mit Sperre), nicht nur die Oberfläche. Alle Termine stehen im Kalender der Verwaltung: Die Woche zeigt jeden Termin in der Farbe seines Mitarbeiters (filterbar nach Person oder „ohne Mitarbeiter“), der Tag eine Spalte je Mitarbeiter mit Arbeitszeit und Abwesenheit. Dort lassen sich Termine mit der Maus auf eine andere Person oder Uhrzeit ziehen oder per Klick umverteilen; passt die Person nicht (arbeitet nicht, abwesend, darf die Leistung nicht, schon belegt), kommt eine Warnung, die sich bestätigen lässt. Ein Klick auf eine freie Stelle trägt einen Termin ein. Einen externen Kalender gibt es nicht. Beim Eintragen lässt sich der Kunde aus der Kartei wählen (auch über „Termin eintragen“ auf der Kundenseite); der Termin hängt dann genau an ihm und seinem Fahrzeug, statt über Telefon oder E-Mail gesucht zu werden. Am Termin lässt sich der Kunde nachträglich ändern und eine vorhandene Rechnung des Kunden verknüpfen oder wieder lösen (auch gestellte; ihre Stornorechnung geht mit).

**Preisliste.** Eine Liste für alles mit Preis: Leistungen (mit Dauer, auf der Website, online buchbar oder nicht) und Teile, Material, Zuschläge (nur für Rechnungen). Jeder Preis steht nur dort; Website, Terminbuchung und die Rechnung zum Termin lesen ihn von da.

**Rechnungen.** Entwurf aus dem Termin (jede Leistung mit ihrem Festpreis ist schon eingetragen), Positionen aus der Preisliste, aus einem Paket oder frei. Preise werden **netto** eingegeben (brutto steht klein daneben); Leistungen aus der Preisliste kommen netto in den Beleg und ergeben brutto wieder den runden Listenpreis. Einheit „Std“ ist Lohn: Lohnart wählen, Stunden eintragen, der Stundensatz kommt aus *Einstellungen → Rechnungen*. Teile (Stk, l, Satz) können einen Einkaufspreis haben, der Verkaufspreis entsteht mit dem Standard-Aufschlag, je Position änderbar; Einkauf und Rohertrag stehen nur im Editor. Ein Rabatt (Prozent oder Euro) ist eine eigene Zeile und gilt für alle Positionen. Beim Stellen bekommt die Rechnung eine lückenlose Nummer und ist danach unveränderlich (Datenbank-Trigger). Korrektur nur über eine Stornorechnung. Das PDF (PDF/A-3) enthält einen GiroCode und die E-Rechnung als `factur-x.xml` (ZUGFeRD, Profil EN 16931). Steht beim Empfänger eine Leitweg-ID (Behörde), wird daraus eine XRechnung 3.0; die reine XML gibt es dann zusätzlich als Mail-Anhang und als Download für die Rechnungsportale von Bund und Ländern. Vor dem Stellen prüft das System die Pflichtangaben der E-Rechnung. DATEV-Export als ZIP (Buchungsstapel + PDFs) unter Rechnungen oder automatisch am Monatsersten an den Steuerberater.

**Kostenvoranschläge.** Wie eine Rechnung aufgebaut (gleicher Editor, Preise netto). Beim Abschließen gibt es eine eigene Nummer (`KV-`) und der Inhalt ist eingefroren; für Änderungen „Als neuen Entwurf kopieren“. Der Kunde bekommt PDF und Link per Mail und nimmt online an oder lehnt ab (Push an Inhaber und Büro), alternativ vermerkt man seine Antwort von Hand. „In Rechnung übernehmen“ legt einen Rechnungsentwurf mit denselben Positionen an. Gültigkeit, Einleitung und Fußtext unter *Einstellungen → Rechnungen*.

**Gemerkte Preise.** Produkte und Arbeiten kosten je Auto unterschiedlich viel. Beim Stellen einer Rechnung merkt sich jede Position Preis, Menge bzw. Stunden und Einkauf für Marke + Modell des Fahrzeugs (VW Golf). Beim nächsten Auto dieser Art setzt der Editor den jüngsten Preis direkt ein und schreibt darunter, woher er kommt. Bezeichnungen werden unscharf verglichen („Bremsscheiben VA“ = „Bremsscheibe vorne“), Marken auch („VW“ = „Volkswagen“). Ohne Marke und Modell gilt nur die Preisliste. Beim Stellen lassen sich Positionen als **Paket** benennen („Bremsen vorne“); im Editor fügt „+ Paket“ alle Positionen ein, von einem anderen Modell mit Warnung. Übersicht, Korrektur und Löschen unter *Gemerkte Preise*. Marke und Modell sind in der Kundenkartei zwei Felder mit Vorschlägen; ältere Fahrzeuge mit nur einem Feld werden geschätzt getrennt und beim ersten Beleg nachgetragen.

**Kundenauswahl.** Neue Rechnungen und Kostenvoranschläge beginnen mit einer Suche (Name, Firma, Telefon, E-Mail, Kennzeichen, Kundennummer); ein Tipp übernimmt Empfänger und Fahrzeug. Im Entwurf geht das über „Kunden übernehmen“ jederzeit nachträglich. Wurde der Empfänger von Hand eingetippt, kommt er beim Stellen der Rechnung bzw. Abschließen des Kostenvoranschlags automatisch in die Kartei: Gibt es ihn schon (gleiche E-Mail, oder gleicher Name mit passender Adresse bzw. passendem Kennzeichen), wird der Beleg mit ihm verknüpft und fehlende Angaben werden ergänzt; sonst wird er neu angelegt, mit Fahrzeug, wenn das Kennzeichen noch unbekannt ist. Bei Terminen geschieht das schon beim Eintragen.

**Werkstatt-App.** Das „+“ in der Leiste öffnet eine kurze Auswahl: Termin, Kostenvoranschlag, Rechnung oder Kunde (mit erstem Fahrzeug) anlegen.

**Sprechen.** Im „+“ der Werkstatt-App: Notiz, Termin, Rechnung oder Kostenvoranschlag per Sprache. Den Text liefert der Knopf „Aufnahme starten“ (Spracherkennung des Browsers, auf dem iPhone die von Apple) oder die Mikrofon-Taste der iPhone-Tastatur im Textfeld; die geht immer, auch wenn die Web-App vom Home-Bildschirm die Spracherkennung nicht bekommt. Oben steht standardmäßig „Automatisch“: Ob Notiz, Termin, Rechnung oder Kostenvoranschlag, wird aus dem Inhalt gelesen. Ein Schlüsselwort („Termin …“, „Erinnere mich …“, „Rechnung …“, „Kostenvoranschlag …“, „KV …“, „Angebot für …“) entscheidet sofort, sonst zählen Spuren: Preis, brutto/netto, Rabatt, Arbeitsstunden oder „gestern“ sprechen für eine Rechnung, dieselben Spuren mit einer Frage nach den Kosten („was würde … kosten“, „voraussichtlich“) für einen Kostenvoranschlag, Leistung aus der Preisliste mit Tag und Uhrzeit, „kommt“, Kennzeichen für einen Termin, Aufgaben („bestellen“, „anrufen“), „in zwei Stunden“ oder „jeden Montag“ für eine Notiz. Ist es nicht eindeutig, steht das rot da und es bleibt vorerst bei einer Notiz. Wer Notiz, Termin, Rechnung oder Kostenvoranschlag fest wählt, bekommt genau das. Verstanden wird der Text mit festen Regeln im Code (`src/lib/sprache/`), ohne KI-Dienst: Datum und Uhrzeit („nächsten Dienstag halb neun“, „in zwei Stunden“, „jeden Montag“; „um 3“ heißt 15 Uhr), Name nach „für“/„Herr“/„Frau“ oder ganz vorn im Satz („Müller, Ölwechsel, Dienstag halb neun“), Kennzeichen, Telefon, E-Mail, Marke und Modell, Leistungen und Positionen unscharf gegen die Preisliste. Was erkannt wurde, steht live darunter. Notiz und Termin öffnen das gewohnte Formular vorausgefüllt und werden erst dort gespeichert; Kunde und Fahrzeug werden über Kennzeichen, Telefon oder eindeutigen Namen in der Kartei gesucht. Rechnung und Kostenvoranschlag werden ein Entwurf im Editor, gestellt bzw. abgeschlossen wird nie automatisch; beim Kostenvoranschlag wird ein genanntes „gültig bis 15.12.“ oder „gültig vier Wochen“ übernommen, sonst gilt die Frist aus den Einstellungen. Alle Begriffe kommen bei jedem Aufruf frisch aus der Datenbank: neue Einträge der Preisliste, Umbenennungen, Stundensätze, Team, Kunden sowie Marken und Modelle aus der Kartei gelten sofort, ohne Änderung am Code. Ein Teil des Namens genügt, wenn er nur zu einem Eintrag passt („Aufbereitung“ für „Fahrzeugaufbereitung“). Wie man einen Eintrag im Alltag nennt, steht unter *Preisliste → Weitere Namen beim Sprechen* („Klima auffüllen“ für „Klimaanlagen-Service“). Gesprochene Preise sind netto, „brutto“ (je Position oder „alle Preise brutto“) schaltet um; „zusammen“ teilt durch die Menge; ohne Preis gilt der gemerkte Preis für das Auto, sonst die Preisliste, Stunden mit dem Stundensatz.

**Notizen.** In der Verwaltung, in der Werkstatt-App (auch über das „+“) und an Kunden und Terminen. Jede Notiz ist „nur ich“ oder „Büro“ (Inhaber und Büro) und kann eine Erinnerung haben: Datum und Uhrzeit, einmalig oder täglich, wöchentlich, monatlich, an sich selbst oder eine andere Person (Mitarbeiter sehen ihre Erinnerungen in der Team-App). Der Minutentakt schickt den Push zur eingestellten Minute; fällige Erinnerungen stehen bis „Erledigt“ oben in der App und zählen im Menü.

**Mitarbeiter.** Seite *Mitarbeiter* in der Verwaltung (ersetzt *Team*): Wochenplan aller Personen mit Arbeitszeit, Urlaub/krank, Zahl der Termine und Auslastung (verplant gegen verfügbar), Fähigkeiten-Matrix (wer welche Leistung darf; neue Leistungen darf erst einmal jeder), Urlaubskonto (Anspruch, genehmigt, beantragt, Rest in Arbeitstagen, halbe Tage zählen 0,5) und Personen mit Einladung. Je Person: „Nimmt Aufträge an“, Wochenplan mit bis zu zwei Zeitfenstern je Tag, auf Wunsch getrennt für gerade und ungerade Kalenderwochen (ohne eigenen Plan gelten die Öffnungszeiten), abweichende Zeiten an einzelnen Tagen, Abwesenheiten auch stundenweise. Freie Termine auf der Website gibt es nur, wo ein Mitarbeiter, der alle gewählten Leistungen darf, innerhalb seiner Arbeitszeit und der Öffnungszeit frei ist (Pausen werden übersprungen) und ein Arbeitsplatz frei ist. Die Anfrage bekommt automatisch den am wenigsten ausgelasteten passenden Mitarbeiter; dass niemand doppelt belegt wird, prüft die Datenbank (`person_belegt`). Wird jemand krank oder bekommt Urlaub genehmigt, gehen seine Termine an freie Kollegen; was nicht passt, steht als „ohne Mitarbeiter“ im Kalender (roter Zähler im Menü, zählt bestätigte Termine). Mitarbeiter bekommen einen Push, wenn ihnen ein bestätigter Termin zugeteilt, verschoben oder abgenommen wird, und morgens eine Tagesvorschau. Team-App: eigene Zeiten und Aufträge, Urlaub (auch halbe Tage) beantragen, krank melden, Zeiterfassung (pro Person einschaltbar). Unter *Mitarbeiter → Personen und Zugang* lässt sich einstellen, dass Einstempeln nur in der Werkstatt geht: Das Handy schickt beim Einstempeln seinen Standort, erlaubt ist ein einstellbarer Abstand (Ausstempeln geht überall).

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
   - `supabase/migrations/20261121140000_mehrere_leistungen.sql` (mehrere Leistungen pro Termin)
   - `supabase/migrations/20261121150000_preisgedaechtnis.sql` (Marke/Modell getrennt, gemerkte Preise je Fahrzeugtyp, Pakete)
   - `supabase/migrations/20261121160000_sprachnamen.sql` (weitere Namen je Eintrag der Preisliste für die Spracheingabe)
   - `supabase/migrations/20261122100000_mitarbeiterplanung.sql` (Mitarbeiter nehmen Aufträge an, wechselnde Wochen, abweichende Tage, halbe Tage, Fähigkeiten, Einstempeln vor Ort)
   - `supabase/migrations/20261122110000_gegenvorschlag.sql` (jede Zeit anfragbar, Gegenvorschlag an den Kunden)
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
   Weitere Personen lädt der Inhaber danach unter *Mitarbeiter → Personen und Zugang* ein.

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
- `frei?leistung=radwechsel&von=2026-12-01&tage=7` freie Startzeiten; mehrere Leistungen mit Komma (`leistung=radwechsel,oelwechsel`), dann gilt die Summe der Dauern

Webhook-Signatur prüfen (Node):

```js
const [t, v1] = header.split(",").map((x) => x.split("=")[1]);
const ok = crypto.createHmac("sha256", geheimnis).update(`${t}.${rohBody}`).digest("hex") === v1;
```
