# Fehlerbuch

Jeder gefundene und behobene Fehler steht hier mit Ursache und Muster. Das Muster ist das Wichtige: Wer etwas
anderes bearbeitet, sieht vorher hier nach, ob derselbe Fehler dort auch stecken kann, und prüft das gleich mit.
So findet man nach und nach alle Stellen, nicht nur die eine, an der es aufgefallen ist.

Die Tabelle `fehlerprotokoll` (Einstellungen → Fehler) ist etwas anderes: Sie sammelt Laufzeitfehler aus dem
Betrieb. Hier stehen Fehler im Code und in der Gestaltung.

## So wird es geführt

- **Neuer Fehler gefunden:** Eintrag oben unter „Einträge“ anlegen, auch wenn er noch nicht behoben ist (dann
  Stand „offen“). Lieber ein Eintrag zu viel.
- **Vor jeder Änderung:** die Muster unten mit den Dateien abgleichen, die man ohnehin anfasst. Trifft eines zu,
  mitbeheben und beim Eintrag unter „Weitere Stellen“ ergänzen.
- **Jeder Eintrag** hat: Datum, Stand (offen / behoben), Wo, Was man sah, Ursache, Behebung, **Muster** (woran man
  dieselbe Ursache anderswo erkennt) und Weitere Stellen (geprüft, mitbehoben oder bewusst gelassen).

## Einträge

### 2026-11-22 · Kundenlink Kostenvoranschlag: Inhalt am PC nur ein schmaler Streifen

- **Stand:** behoben
- **Wo:** `src/app/(site)/k/[token]/page.tsx` und `loading.tsx`
- **Was man sah:** Auf großen Bildschirmen stand der Kostenvoranschlag für den Kunden in einer sehr schmalen
  Spalte, Texte brachen nach wenigen Wörtern um. Gemeldet vom Betreiber („Fehler in der PC-Ansicht“).
- **Ursache:** `rand max-w-3xl` auf demselben Element. `rand` rechnet ab 1280 px den seitlichen Abstand aus der
  Fensterbreite (`(100vw - 80rem) / 2`), `max-w-3xl` begrenzt aber die ganze Box samt Abstand auf 48rem. Bei
  1920 px bleiben dem Inhalt etwa 128 px.
- **Behebung:** `rand pb-24 *:max-w-3xl`: der Abstand gilt für die volle Breite, die Spaltenbreite für die Kinder.
- **Muster:** `rand` (oder sonst ein Abstand aus `vw`) zusammen mit `max-w-*` auf einem Element. Die Breite muss
  innen begrenzt werden, nicht an der Box mit dem Abstand.
- **Weitere Stellen:** gleich gesucht: Terminseite `t/[token]` (Seite und Laden), Impressum, AGB, Datenschutz
  hatten dasselbe, alle mitbehoben. Sonst nirgends.

### 2026-11-22 · Trennstrich über „Erinnerung per Push“ lief auf halber Schrifthöhe neben der Überschrift

- **Stand:** behoben
- **Wo:** `src/components/admin/notizen.tsx`, `src/app/globals.css`
- **Was man sah:** Die Linie über dem Erinnerungsteil einer Notiz begann erst rechts neben „Erinnerung per Push“,
  mitten auf Höhe der Schrift, statt sauber darüber. Gemeldet vom Betreiber.
- **Ursache:** `fieldset` mit `border-t` und `legend`: Der Browser setzt die erste Legende in die Rahmenlinie.
- **Behebung:** zentral in `globals.css`: `fieldset:where(.border-t) > legend` als `float` über die ganze Breite
  (dann gewöhnlicher Inhalt unter der Linie, im Raster ganze Zeile); `mb-2` an den Legenden entfällt, den Abstand
  gibt das Raster.
- **Muster:** `fieldset` mit Rahmen oder `border-t` und einer `legend` darin.
- **Weitere Stellen:** Einstellungen (Stundensätze, Kostenvoranschläge, Werkstattaufträge) hatten dasselbe und
  sind über die zentrale Regel mitbehoben. Übrige `legend` stehen in fieldsets ohne Rahmen: in Ordnung.

### 2026-11-22 · Mitarbeiter: „Nimmt Aufträge an“ klang nach Entscheidung der Person, neue Mitarbeiter fehlten in der Planung

- **Stand:** behoben
- **Wo:** `src/app/admin/(panel)/mitarbeiter/page.tsx` (Fähigkeiten, Wochenplan, Personen), `…/mitarbeiter/[id]/page.tsx`,
  `src/lib/aktionen/team.ts` (`einladen`, `profilSpeichern`), `src/app/admin/(panel)/kalender/page.tsx`
- **Was man sah:** Unter *Fähigkeiten* stand „Noch niemand nimmt Aufträge an“, im Wochenplan „nimmt keine Aufträge“.
  Das liest sich, als müssten die Angestellten selbst zusagen. Gemeldet vom Betreiber: Wer Aufträge bekommt,
  entscheidet die Werkstatt.
- **Ursache:** Der Schalter `nimmt_auftraege` war eine freie Einstellung je Person mit Standard „aus“ (Migration
  `mitarbeiterplanung`) und wurde in der Oberfläche als Tätigkeit der Person beschriftet. Wer beim Einladen das
  Häkchen vergaß, fehlte still in Planung, Website-Terminen und Fähigkeiten.
- **Behebung:** Rolle Mitarbeiter ist immer planbar (`istPlanbar`, beim Speichern gesetzt, bestehende per Migration
  `team_werkstatt` nachgezogen); nur Inhaber und Büro werden zugeschaltet („In der Werkstatt einplanen“). Texte
  sprechen von „eingeplant“. Das Büro darf mitplanen (Recht `team`), Personalsachen bleiben beim Inhaber (`personal`).
- **Muster:** Ein Schalter, der eine Entscheidung des Betriebs über eine Person speichert, mit Standard „aus“ und
  einer Beschriftung im Aktiv der Person („nimmt an“, „macht mit“). Folgen: Neue Personen fallen still heraus, und
  die Oberfläche legt nahe, die Person entscheide selbst.
- **Weitere Stellen:** alle Texte mit „nimmt … an“ / „annimmt“ gesucht: Kalender (Leertext, Kommentar),
  `planung.ts`, `termine.ts` (Kommentare) mitgeändert. `zeiterfassung` ist ebenfalls ein Schalter mit Standard „aus“,
  dort ist „aus“ aber gewollt (nicht jeder stempelt) und die Beschriftung spricht vom Betrieb: gelassen.

### 2026-11-22 · Stornierte Rechnung forderte im PDF und in der Mail weiter zur Zahlung auf

- **Stand:** behoben
- **Wo:** `src/lib/rechnung/pdf.tsx` (GiroCode, Zahlungstext), `src/lib/rechnung/rechnungen.ts` (`versenden`)
- **Was man sah:** Das PDF einer stornierten, unbezahlten Rechnung (Verwaltung, Kunden-Link `/r/…`, DATEV-ZIP)
  zeigte weiter „Bitte überweisen Sie …“ mit QR-Code, ohne Hinweis auf das Storno. „Erneut senden“ schickte
  dazu „Zahlbar bis“ und die Bankverbindung.
- **Ursache:** PDF und Mail fragten nur `storno` (ist selbst eine Stornorechnung) und `bezahlt` ab. Der Status
  `storniert` des Originals kam in der Entscheidung „Zahlung anfordern?“ nicht vor.
- **Behebung:** PDF bekommt `storniert` (durch welche Stornorechnung, ersetzt durch welche Fassung) und zeigt
  dann einen Vermerk statt Zahlungsteil und QR-Code; die Mail fordert nur noch bei `status === "gestellt"` und
  offenem Betrag zur Zahlung auf. Gefunden beim Bau der Rechnungskorrektur.
- **Muster:** Eine Entscheidung „muss der Kunde noch zahlen?“ aus einzelnen Merkmalen (`!storno && !bezahlt`)
  statt positiv aus dem Status (`gestellt`) und dem offenen Betrag (`offenerBetrag`). Neue Status (storniert,
  verrechnet) fallen dann durch.
- **Weitere Stellen:** Werkstatt-App am Termin (`offene` schließt `storniert` aus), Kundenseite `t/[token]`
  (zeigt nur den Link aufs PDF, jetzt mit Vermerk), offene Summen in Startseite und Werkstatt-App (zählen nur
  `gestellt`, ziehen jetzt Verrechnetes über `offenerBetrag` ab): in Ordnung. Bewusst gelassen: Die Summe
  „offen“ enthält Stornorechnungen (Status `gestellt`, negativ), das war schon vorher so gewollt.

### 2026-11-22 · Verwaltung: dunkle linke Leiste stand manchmal versetzt

- **Stand:** behoben
- **Wo:** `src/app/admin/(panel)/layout.tsx` (Seitenleiste ab `lg`)
- **Was man sah:** Der dunkle Balken links scrollte ein Stück mit oder war verschoben, vor allem auf dem iPad.
- **Ursache:** Die Leiste war `sticky top-0` mit `h-dvh`. Sticky federt beim Überscrollen (Gummiband in Safari)
  mit, und `dvh` ändert sich, sobald die Adressleiste ein- oder ausfährt. Dann passten Höhe und Lage nicht mehr.
  War das Menü höher als das Fenster, lief es zusätzlich über den dunklen Grund hinaus.
- **Behebung:** ab `lg` `fixed inset-y-0 left-0 w-60` mit `overflow-y-auto overscroll-contain`, die Hülle hält mit
  `lg:pl-60` den Platz frei.
- **Muster:** Elemente, die den ganzen Bildschirm hoch stehen sollen, mit `sticky` plus `h-dvh`/`h-screen`/`100vh`.
  Besser `fixed inset-y-0`. Außerdem: feste Höhe ohne `overflow-y-auto`, wenn der Inhalt länger sein kann.
- **Weitere Stellen:** übrige `sticky`-Elemente geprüft (Kopfzeilen der Handy-Apps, Leisten in Beleg-Editor,
  Buchung, Rechnungsauswahl, Tabellenkopf Mitarbeiter): keines hat eine Höhe aus `dvh`, nichts zu tun.

### Älter (aus Kommentaren im Code nachgetragen) · Handy-Apps: Tab-Leiste über hellem Streifen

- **Stand:** behoben
- **Wo:** `src/app/app/layout.tsx`, `src/app/team/layout.tsx`, `src/app/globals.css` (`.handy-app`)
- **Was man sah:** Auf dem Home-Bildschirm hing die Tab-Leiste unten abgeschnitten über einem hellen Streifen.
- **Ursache:** iOS 26 meldet die Fensterhöhe einer Web-App um die Statusleiste zu klein, solange die Seite kürzer
  ist als der Bildschirm (WebKit-Fehler 301108); mit `statusBarStyle: "black-translucent"` noch verstärkt.
- **Behebung:** `statusBarStyle: "default"`, in `display-mode: standalone` Mindesthöhe
  `min(100lvh, calc(100% + env(safe-area-inset-top)))`, kein Nachfedern (`overscroll-behavior-y: none`).
- **Muster:** neue Web-App-Bereiche (eigenes `layout.tsx` mit `appleWebApp`) brauchen dieselbe Hülle
  `.handy-app min-h-dvh` und `statusBarStyle: "default"`.
- **Weitere Stellen:** Werkstatt- und Team-App haben beides.

### Älter (aus Kommentaren im Code nachgetragen) · Tab-Leiste: helle Lücke beim Nachfedern

- **Stand:** behoben
- **Wo:** `src/components/mobil/leiste.tsx`
- **Was man sah:** Beim Ziehen über das Seitenende schien unter der dunklen Leiste der helle Grund durch.
- **Ursache:** Unter einer `fixed bottom-0`-Leiste ist beim Gummiband-Effekt nichts in ihrer Farbe.
- **Behebung:** `after:absolute after:top-full after:h-32 after:bg-inherit` setzt die Farbe nach unten fort.
- **Muster:** jede farbige Leiste, die unten am Rand klebt.
- **Weitere Stellen:** keine weitere solche Leiste bekannt.

## Stolpersteine beim Prüfen (kein Fehler im Code)

- `npm run typecheck` meldet „Cannot find module '@/assets/….jpg'“, wenn `next-env.d.ts` fehlt (steht in
  `.gitignore`, entsteht erst bei `npm run dev` oder `npm run build`). Vorher einmal bauen oder dev starten.
