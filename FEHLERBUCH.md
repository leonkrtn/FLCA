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

### 2026-11-25 · Einstellungen: abgewählter Haken war nach „Speichern“ wieder gesetzt

- **Stand:** behoben
- **Wo:** `src/lib/aktionen/einstellungen.ts` (`automatikSpeichern`, `benachrichtigungSpeichern`, `whatsappSpeichern`)
- **Was man sah:** (vom Nutzer gemeldet) In *Einstellungen → Automatik* einen Haken entfernen und speichern: Der Haken
  stand sofort wieder da, erst nach dem Neuladen der Seite stimmte es. Gespeichert war es richtig.
- **Ursache:** React setzt ein Formular mit Server Action nach dem Absenden auf seine Startwerte zurück
  (`defaultChecked`, `defaultValue`). Diese drei Aktionen riefen kein `revalidatePath`, also kamen keine neuen
  Startwerte vom Server, und das Formular sprang auf den alten Stand.
- **Behebung:** `alles()` (`revalidatePath("/", "layout")`) nach dem Speichern, wie in den übrigen Aktionen dort.
- **Muster:** Eine Server Action, die etwas speichert, das ein Formular mit `defaultValue`/`defaultChecked` anzeigt,
  ohne `revalidatePath`. Das Formular zeigt nach dem Speichern wieder den alten Wert.
- **Weitere Stellen:** Alle Aktionen in `src/lib/aktionen/` durchsucht: Nur diese drei fehlten. `pushAbonnieren`,
  `pushAbmelden` und `mailPushSchalten` speichern ohne Formular mit Startwerten (Schalter mit eigenem Zustand), dort ist
  nichts zu tun.

### 2026-11-25 · Postfach: HTML-Mails unten abgeschnitten oder mit Leerraum

- **Stand:** behoben
- **Wo:** `src/components/mail/html-inhalt.tsx` (Rahmen für HTML-Mails)
- **Was man sah:** (beim Prüfen mit Beispielmails bemerkt) Die letzte Zeile einer HTML-Mail war halb abgeschnitten;
  nach einem ersten Versuch mit `documentElement.scrollHeight` stand stattdessen viel Leerraum darunter.
- **Ursache:** Die Höhe kam aus `body.scrollHeight`. Der obere und untere Rand des ersten und letzten Absatzes ragt
  aus dem `body` heraus (Randverschmelzung) und zählt dort nicht mit. `documentElement.scrollHeight` ist dagegen nie
  kleiner als der Rahmen selbst und schrumpft deshalb nicht.
- **Behebung:** `body` im Rahmen als eigener Block (`display: flow-root`), dann enthält `body.scrollHeight` die Ränder.
- **Muster:** Höhe eines Rahmens oder Containers aus `scrollHeight` messen, dessen Inhalt mit Rändern (`p`, `h1`)
  beginnt oder endet, ohne eigenen Blockkontext.
- **Weitere Stellen:** Im übrigen Code misst niemand `scrollHeight`; nichts weiter gefunden.

### 2026-11-24 · Menü: „Kunden“ wäre auf „Kundenbildschirm“ mit markiert gewesen

- **Stand:** behoben
- **Wo:** `src/components/admin/nav.tsx` (Menü und Zahnrad), `src/components/mobil/leiste.tsx` (Tab-Leiste)
- **Was man sah:** (beim Einbauen des Kundenbildschirms bemerkt) Auf `/admin/kundenbildschirm` standen „Kunden“
  und „Kundenbildschirm“ beide als aktiv da.
- **Ursache:** Aktiv war ein Menüpunkt, wenn der Pfad mit seiner Adresse *beginnt* (`pfad.startsWith(href)`).
  `/admin/kundenbildschirm` beginnt mit `/admin/kunden`.
- **Behebung:** Nur ganze Abschnitte zählen: gleich oder `startsWith(href + "/")`. Ebenso in der Tab-Leiste.
- **Muster:** `startsWith` auf Pfade ohne `/` am Ende. Jeder neue Menüpunkt, dessen Adresse eine andere verlängert,
  markiert dann beide.
- **Weitere Stellen:** `kalender-merken.ts` prüft `startsWith("/admin/kalender")` nur für die eigene Adresse, dort
  gibt es keine längere; gelassen. Die `auch`-Einträge der Tab-Leisten sind ganze Abschnitte, gehen weiter.

### 2026-11-24 · Werkstatt-App: Tab-Leiste schwebt mitten auf der Seite

- **Stand:** behoben (am iPhone noch zu bestätigen)
- **Wo:** `src/components/mobil/leiste.tsx` (Tab-Leiste), betroffen jede `fixed bottom-0`-Leiste
- **Was man sah:** Auf der Terminseite stand die dunkle Tab-Leiste rund 230 pt über dem unteren Rand, darunter lief
  die Seite weiter. Der dunkle Streifen, der sonst unter der Leiste weitergeht, fehlte.
- **Ursache:** iOS 26 rechnet das Fenster nicht neu, wenn die Tastatur zugeht, vor allem wenn dabei die Seite
  wechselt (Notiz speichern → `redirect` zurück zum Termin). `fixed bottom-0` hängt dann an der alten
  Tastaturkante, 230 pt sind etwa die Tastaturhöhe. Fehler in WebKit, nicht im Code der Leiste.
- **Behebung:** `NachTastatur` (`src/components/nach-tastatur.tsx`) in den Layouts von Werkstatt-App, Team-App und
  Website: Beim Absenden verlässt das Feld den Fokus (Tastatur zu vor dem Seitenwechsel). Nach dem Schließen der
  Tastatur und nach jedem Seitenwechsel springt die Seite einen Pixel und zurück, das lässt WebKit neu vermessen.
- **Muster:** Ein neuer Bereich mit eigenem Layout und `fixed bottom-0`-Leiste ohne `<NachTastatur>`.
- **Weitere Stellen:** Website (`src/components/site/mobil-leiste.tsx`, Leiste in `src/components/site/buchung.tsx`)
  über das Layout von `(site)` mit abgedeckt. Die Verwaltung (`/admin`) hat keine unten feste Leiste.

### 2026-11-24 · Team-App: Tab „Mehr“ unter Erinnerungen nicht markiert

- **Stand:** behoben
- **Wo:** `src/app/team/layout.tsx`, `src/app/app/layout.tsx` (Tab-Leiste)
- **Was man sah:** Unter *Mehr → Meine Erinnerungen* war in der Tab-Leiste kein Tab hervorgehoben, man wusste
  nicht, wo man ist. Beim Bau der Schulung (ebenfalls unter *Mehr*) bemerkt.
- **Ursache:** Der Tab „Mehr“ gilt nur für `/team/mehr` selbst. Seiten, die man aus „Mehr“ öffnet, liegen nicht
  darunter (`/team/notizen`), und `auch` war nicht gesetzt.
- **Behebung:** `auch: ["/team/schulung", "/team/notizen"]` am Tab „Mehr“.
- **Muster:** Eine Unterseite eines Tabs, deren Pfad nicht unter dem Pfad des Tabs liegt, ohne Eintrag in `auch`.
- **Weitere Stellen:** Werkstatt-App gesucht: `/app/notizen` (aus „Mehr“) hatte dasselbe, mitbehoben
  (`auch: ["/app/notizen"]`). „Alle Anfragen“ hat einen eigenen Tab, die übrigen Links aus „Mehr“ führen in
  Verwaltung oder Team-App.

### 2026-11-24 · „Nicht erschienen“ meldete kein Ereignis

- **Stand:** behoben
- **Wo:** `erledigen` in `src/lib/termine.ts`, `EREIGNIS_TYPEN` in `src/lib/ereignisse.ts`
- **Was man sah:** (vom Betreiber nachgefragt) Nach „Nicht erschienen“ erfuhren Webhooks und
  `/api/v1/ereignisse` nichts, „Erledigt“ meldete dagegen `termin.erledigt`. Für Abonnenten blieb der Termin
  „bestätigt“.
- **Ursache:** `melden` stand nur im Zweig für `erledigt`.
- **Behebung:** neuer Typ `termin.nicht_erschienen`, `erledigen` meldet in beiden Fällen.
- **Muster:** Eine fachliche Statusänderung ohne `melden`, oder eine, die einen schon gemeldeten Stand danach
  still ändert.
- **Weitere Stellen:** alle `update({ status` in `src/lib` gesucht. Termine (ablehnen, stornieren,
  Gegenvorschlag), Rechnungen (bezahlt, unbezahlt, Korrektur) und Kostenvoranschläge melden. Mitbehoben: Das
  Storno wird als `rechnung.gestellt` (offen) gemeldet und gleich danach still erledigt; `rechnung.storniert`
  sagt jetzt mit `zu_erstatten`, ob es offen bleibt. Bewerbungen, Abwesenheiten und Werkstatt-Meldungen haben
  keine Ereignistypen (interne Personal- und Werkstattsachen): bewusst gelassen.

### 2026-11-23 · DATEV: Erstattungen an Kunden werden nicht gebucht

- **Stand:** offen
- **Wo:** `monatsexport` in `src/lib/rechnung/datev.ts`, `zahlungseingang` in `korrektur.ts`
- **Was man sah:** (beim Beheben des Storno-Eintrags) Wird das Storno einer bezahlten Rechnung als erstattet
  markiert, bucht der Export dafür nichts: `zahlungseingang` ist für negative Beträge 0. Ebenso fehlt die
  Erstattung, wenn eine berichtigte Fassung niedriger ist als das schon Gezahlte. Das Debitorenkonto bleibt dann
  mit dem Erstattungsbetrag stehen.
- **Ursache:** Der Export kennt nur Zahlungseingänge, keine Auszahlungen.
- **Behebung:** noch keine. Vor dem Ändern mit dem Steuerberater klären, wie Erstattungen gebucht werden sollen
  (Debitor an Bank/Kasse).
- **Muster:** Geldfluss, der nur in eine Richtung gedacht ist (`Math.max(0, …)` bei Beträgen).
- **Weitere Stellen:** `zugferd.ts` (Vorauszahlung in der E-Rechnung, kann nicht negativ sein): in Ordnung.

### 2026-11-23 · Stornorechnung zählt als offener Posten und wird „überfällig“

- **Stand:** behoben
- **Wo:** `stornieren`/`stellen` in `src/lib/rechnung/rechnungen.ts`; Summen in `src/app/admin/(panel)/page.tsx`,
  `kunden/[id]/page.tsx`, `src/app/app/rechnungen/page.tsx`, Liste `rechnungen/page.tsx`
- **Was man sah:** (beim Durchsehen) Wird eine **unbezahlte** Rechnung storniert, steht das Original auf
  „storniert“ (fällt aus „offen“ heraus), die Stornorechnung aber auf „gestellt“ mit negativem Betrag und
  `faellig_am`. Die Summe „offen“ sinkt um den Betrag ein zweites Mal (bei einer Korrektur: neue Fassung minus
  Storno statt nur neue Fassung), die Stornorechnung zählt als offener Posten und wird nach dem Zahlungsziel rot
  „überfällig“.
- **Ursache:** „Offen“ wird aus `status === "gestellt"` abgeleitet; eine Stornorechnung hat diesen Status, obwohl
  bei unbezahltem Original nichts zu zahlen oder zu erstatten ist. Der frühere Eintrag nahm das als gewollt an;
  gewollt passt nur, wenn das Original bezahlt war (dann ist die Gutschrift wirklich offen).
- **Behebung:** Ist nichts zu erstatten (Original unbezahlt, oder eine Korrektur übernimmt die Zahlung), steht
  das Storno gleich auf „bezahlt“ ohne Zahlungsart und ohne Fälligkeit; angezeigt als „Erledigt“ (`stornoStand`
  in `korrektur.ts`), PDF „ausgeglichen, zu zahlen ist nichts“. Offen bleibt nur das Storno einer bezahlten
  Rechnung ohne Korrektur („Zu erstatten“, Knöpfe „Bar erstattet“/„Überwiesen“). Wird ein schon storniertes
  Original später berichtigt, übernimmt die Fassung die Zahlung nur, wenn noch nicht erstattet wurde
  (`uebernommeneZahlung`), und das alte Storno wird erledigt. Vorhandene Stornos: Migration `storno_erledigt`.
- **Muster:** Ein Gegenbeleg, der einen anderen Beleg aufhebt, in Summen mitgezählt, obwohl der aufgehobene schon
  herausfällt (doppelt abgezogen).
- **Weitere Stellen:** alle Stellen mit `status === "gestellt"` für Summen/Zähler (oben unter „Wo“) betroffen.

### 2026-11-23 · Reifensaison-Mail passt nicht zu den eingelagerten Rädern

- **Stand:** behoben
- **Wo:** Schritt `saison` in `src/lib/automatik.ts`
- **Was man sah:** (beim Durchsehen) Die Mail geht an **jede** offene Einlagerung, egal welche Räder liegen. Im
  Frühjahr bekommt jemand mit eingelagerten Winterrädern „Zeit für die Sommerreifen. Ihre Winterräder liegen bei
  uns bereit.“, Ganzjahresräder werden zweimal im Jahr zum Wechsel gerufen.
- **Ursache:** Ausgewählt wird nur nach Datum (`fruehjahr`/`herbst`), nicht nach `einlagerungen.saison`.
- **Behebung:** Frühjahr nur `saison = 'sommer'`, Herbst nur `'winter'`, `ganzjahr` nie. Link und Dauer kommen
  aus der Preisliste (Leistung `radwechsel`, aktiv und online anfragbar); fehlt sie, führt der Link auf `/termin`
  und die Dauer entfällt.
- **Muster:** Serienmail, deren Anlass (Datum) und deren Inhalt (Datensatz) nicht gegeneinander geprüft werden.
- **Weitere Stellen:** übrige Serienmails im Takt (Erinnerung, Bewertung) wählen passend nach Status: in Ordnung.
  Nebenbei behoben: „rund 30 Minuten“ stand fest im Text.

### 2026-11-23 · „Kunde nicht erschienen“ setzt den Werkstattauftrag auf „fertig“

- **Stand:** behoben
- **Wo:** `erledigen` in `src/lib/termine.ts`
- **Was man sah:** (beim Durchsehen) Auch mit `status = "nicht_erschienen"` wird `auftrag_status: "fertig"`
  geschrieben. Ein Auftrag, an dem nie gearbeitet wurde, gilt als fertig.
- **Ursache:** Beide Abschlüsse teilen eine Funktion, das Update unterscheidet nicht.
- **Behebung:** `auftrag_status` wird nur bei `erledigt` gesetzt.
- **Muster:** Eine Funktion für mehrere Ausgänge, die Nebenfelder für alle gleich setzt.
- **Weitere Stellen:** sonst setzt nur `src/lib/auftrag.ts` den Auftragsstand: in Ordnung.

### 2026-11-23 · Terminnummern ändern sich nach dem Löschen eines Termins

- **Stand:** behoben
- **Wo:** `termin_loeschen` (`supabase/migrations/20261121100000_termine_loeschen.sql`), Kommentar an `loeschen`
  in `src/lib/termine.ts`
- **Was man sah:** (beim Durchsehen) Nach dem Löschen rücken alle späteren **Terminnummern** um eins nach. Die
  Nummer steht aber auf dem Werkstattauftrag (`termin_nummer`, PDF/Unterschrift), in Notizen („Termin Nr.“), im
  Kostenvoranschlag und in Webhooks/API (`nummer`). Danach zeigen alte Ausdrucke und gespeicherte Ereignisse auf
  einen anderen Termin. Der Kommentar spricht von „Auftragsnummern“, die rücken aber gar nicht nach.
- **Ursache:** Lückenlose Nummern wurden über die Beständigkeit einer nach außen gegebenen Kennung gestellt.
- **Behebung:** Entscheidung des Betreibers: Nachrücken bleibt, die Terminnummer erscheint aber nur noch in
  Notizen (dort bei jedem Anzeigen frisch gelesen, passt sich also an). Entfernt aus Kundenseite `t/[token]`,
  Termindetail und -liste der Verwaltung, Kostenvoranschlag, Löschdialog, Webhooks (`termin.*`,
  `auftrag.*`, `rechnung.termin_verknuepft`) und `/api/v1/termine`. Verlaufstexte nennen Datum und Leistung statt
  der Nummer (gespeicherter Text würde sonst veralten). Kommentare und README sprechen von Terminnummern.
- **Muster:** Eine Kennung, die nach außen geht (Ausdruck, Mail, Webhook) oder als Text gespeichert wird
  (Verlauf), wird nachträglich geändert.
- **Weitere Stellen:** sonst nummeriert keine Funktion nach (`grep "nummer = -nummer"`).

### 2026-11-23 · DATEV-Monatsversand fällt aus, wenn der Takt am 1. nicht läuft

- **Stand:** behoben
- **Wo:** Schritt `datev` in `src/lib/automatik.ts`
- **Was man sah:** (beim Durchsehen) Der Versand prüft `heute.slice(8) !== "01"`. Läuft der tägliche Teil am 1.
  nicht (Zeitsteuerung aus, Fehler davor), wird der Vormonat nie mehr geschickt.
- **Ursache:** fester Tag statt „ab dem 1., solange für den Vormonat noch nichts gesendet ist“; das
  `automatik_log` verhindert Doppelversand ohnehin.
- **Behebung:** Fällig an jedem Tag ab dem 1., bis der Vormonat gesendet ist (`automatik_log` verhindert
  Doppelversand). Beschriftung in Einstellungen → Automatik nennt das Nachholen.
- **Muster:** Tägliche Aufgabe, die nur an genau einem Datum fällig ist, ohne Nachholen.
- **Weitere Stellen:** `saison` hat ein Fenster von vier Tagen: in Ordnung.

### 2026-11-22 · Website: Hallenfoto im Startbereich fehlte

- **Stand:** behoben
- **Wo:** `next.config.ts` (`images`), alle `next/image` auf der Website
- **Was man sah:** Im Startbereich der Website stand nur die dunkle Fläche, kein Foto.
- **Ursache:** Das Kontingent für Vercels Bildoptimierung (kostenloser Tarif) war aufgebraucht. Vercel lieferte jede
  noch nicht zwischengespeicherte Größe/Format-Kombination mit „402 Payment Required“; das iPhone fragt für das
  neue Hallenfoto genau so eine an (z. B. 1200 px AVIF). Bereits zwischengespeicherte Größen kamen weiter, deshalb
  fehlten Bilder nur je nach Gerät.
- **Behebung:** `images.unoptimized: true`, die Fotos aus `src/assets` (150–400 KB) gehen direkt raus.
- **Muster:** Bilder, die nur auf manchen Geräten fehlen, nach neuem Foto oder Deploy: `/_next/image?...` direkt
  abrufen und auf 402 achten. Neue Fotos vor dem Einchecken klein halten (unter ca. 400 KB), weil nichts mehr
  verkleinert wird; dasselbe gilt für Bilder, die über Website → Texte und Bilder hochgeladen werden.
- **Weitere Stellen:** gilt für alle `next/image` (Startseite, Leistungsbereiche, Angebote, Leistungsseiten).

### 2026-11-22 · Team-Ansicht öffnete sich in der Web-App im Safari-Fenster

- **Stand:** behoben im Code (seit 2026-11-20), auf dem Gerät erst nach Neuinstallation
- **Wo:** `src/lib/manifest.ts` (`scope`), installierte Web-Apps auf dem iPhone
- **Was man sah:** In der Web-App vom Home-Bildschirm öffnete sich `/team` in einem eingeblendeten Fenster mit „X“,
  Adresse `flca.vercel.app` und Safari-Leiste unten statt im Vollbild der App.
- **Ursache:** Der Bereich (`scope`) der Manifeste war bis zum 20.11. nur `/app` bzw. `/team`; `/team` lag für die
  Werkstatt-App außerhalb. iOS liest das Manifest nur beim Hinzufügen zum Home-Bildschirm und aktualisiert es nie.
  Vorher installierte Apps behalten den alten, engen Bereich, auch nach der Korrektur auf `scope: "/"`.
- **Behebung:** Code war schon richtig. Auf dem Gerät: App-Symbol löschen und über Safari neu „Zum Home-Bildschirm“
  hinzufügen (angemeldet, auf `/app` bzw. `/team`).
- **Muster:** Jede Änderung an Manifest oder `appleWebApp` (Bereich, Name, Icon, Startseite, Farben) wirkt auf dem
  iPhone erst nach Neuinstallation. Bei solchen Änderungen den Betreiber darauf hinweisen.
- **Weitere Stellen:** beide Manifeste haben `scope: "/"`; Login, Verwaltung und Website haben kein eigenes Manifest
  und liegen damit im Bereich beider Apps.

### 2026-11-22 · Sofort-Rückmeldung am Knopf wirkte ausgegraut statt bestätigt

- **Stand:** behoben
- **Wo:** `Senden` in `src/components/admin/formular.tsx`, `.knopf:disabled` in `src/app/globals.css`
- **Was man sah:** (beim Durchsehen der optimistischen Anzeige) Nach dem Tippen auf „Einstempeln“, „Annehmen“
  usw. stand zwar schon „✓ Eingestempelt“ da, aber blass wie ein gesperrter Knopf. Es sah eher nach „geht nicht“
  aus als nach „erledigt“.
- **Ursache:** Der Knopf ist während der Aktion `disabled` (kein zweites Absenden). `.knopf:disabled` blendet
  jeden gesperrten Knopf auf 45 % ab, auch den, der gerade das Ergebnis zeigen soll. Der Code nahm an, ohne
  `opacity-60` bleibe er voll sichtbar.
- **Behebung:** Zeigt der Knopf schon das Ergebnis (`vorab`, oder das Formular hat `sofort`), bekommt er
  `disabled:opacity-100 disabled:cursor-default`: gesperrt, aber nicht blass.
- **Muster:** Ein Knopf, der während einer Aktion `disabled` wird und dabei etwas anderes zeigen soll als „bitte
  warten“. Die Komponentenregel `.knopf:disabled` gilt immer mit; das gewünschte Aussehen muss sie ausdrücklich
  überschreiben.
- **Weitere Stellen:** alle `disabled={…}` an `.knopf` gesucht (Login, Website-Formulare, Beleg-Editor,
  Unterschrift, Kunde löschen, Nummernkreis): Dort soll der Knopf während der Aktion blass sein. In Ordnung.

### 2026-11-22 · Knöpfe in schlichten Formularen reagierten nicht, doppeltes Tippen legte doppelt an

- **Stand:** behoben
- **Wo:** `<form action={…}>` mit gewöhnlichem `<button>`: „Rechnung erstellen“ (Termin in Verwaltung und App),
  „Kostenvoranschlag“/„Rechnung“ (Kundenseite in Verwaltung und App), „Kostenvoranschlag erstellen“, „In Rechnung
  übernehmen“, „Als neuen Entwurf kopieren“, „Stornorechnung erstellen“, „Entwurf löschen“ (Rechnung, KV), „lösen“
  (Rechnung und KV am Termin), „Vergessen“/„Löschen“ bei gemerkten Preisen, „Abmelden“ (Verwaltung, beide Apps)
- **Was man sah:** (beim Durchsehen) Nach dem Tippen passierte nichts Sichtbares, bis der Server fertig war,
  manchmal über eine Sekunde. Wer nochmal tippte, bekam zum Beispiel zwei Rechnungsentwürfe für denselben Kunden.
- **Ursache:** Ein schlichtes `<form action>` ruft die Server Action, aber ein gewöhnlicher `<button>` weiß nichts
  davon: kein Sperren, kein Hinweis. `Senden` (mit `useFormStatus`) war nur in `<Formular>` im Einsatz.
- **Behebung:** Diese Knöpfe sind jetzt `Senden` (Knopf-Gestalt) oder `Absenden` (Textlink, Menüpunkt). Beide
  funktionieren in jedem Formular, sperren während der Aktion und zeigen das. Gemerkte Preise und Pakete laufen
  über `<Formular ausblenden>`, die Zeile verschwindet sofort (Aktionen geben dafür ein `Ergebnis` zurück).
- **Muster:** `<form action={serverAction}>` und darin ein nacktes `<button>`. Dort immer `Senden`/`Absenden`
  nehmen.
- **Weitere Stellen:** übrige schlichte Formulare (Beleg-Editor, Kunde neu, Unterschrift, Datenübernahme, Kunde
  löschen, Login, Website: Buchung, Absage, Vorschlag, KV-Antwort, Auftrag erteilen, Bewerbung) haben eigene
  Anzeige über `useActionState`/`useFormStatus`. In Ordnung.

### 2026-11-22 · Handy-Apps zeigten nach dem Zurückkehren den alten Stand

- **Stand:** behoben
- **Wo:** Layouts von `/app`, `/team`, `/admin` (`src/components/auffrischen.tsx`)
- **Was man sah:** (beim Durchsehen) Eine Web-App vom Home-Bildschirm bleibt im Hintergrund offen. Öffnete man sie
  nach Stunden wieder, standen dort die Termine und Anfragen vom letzten Mal, bis man selbst eine Seite wechselte.
- **Ursache:** Nichts lud die Seite beim Zurückkommen neu; der Server liefert nur bei Navigation oder Aktion.
- **Behebung:** `<Auffrischen>` ruft `router.refresh()`, wenn die Seite länger als eine Minute verdeckt war.
  Eingaben und Scrollposition bleiben. Das deckt auch den Router-Cache ab (`staleTimes.dynamic` 30 s).
- **Muster:** Ein neuer Bereich mit eigenem Layout (eigene Web-App) ohne `<Auffrischen>`.
- **Weitere Stellen:** Website `(site)` bewusst ohne: Besucher bleiben nicht stundenlang auf einer Seite stehen,
  und dort ändert sich nichts, was sie sofort sehen müssten.

### 2026-11-22 · Website: Strich am rechten Rand der Leiste im Startbereich (Handy)

- **Stand:** behoben
- **Wo:** Startbereich in `src/app/(site)/page.tsx` (Leiste mit Adresse, Zeiten, Telefon, Termin)
- **Was man sah:** (beim Prüfen des neuen Startbereichs) Auf dem Telefon stand rechts neben „Heute“ ein
  senkrechter Strich ins Leere.
- **Ursache:** Tailwind 4 setzt bei `divide-x` den Rand **rechts** an jedes Kind außer dem letzten (v3: links an
  jedes außer dem ersten). Die beiden letzten Zellen sind auf dem Telefon `hidden`, also bekam die zweite, sichtbar
  letzte Zelle einen rechten Rand.
- **Behebung:** kein `divide-x`, sondern `border-l` an den Zellen ab der zweiten.
- **Muster:** `divide-x`/`divide-y` an einem Container, dessen letzte direkte Kinder je nach Breite ausgeblendet
  werden (`hidden md:…`). Dann den Rand an die Kinder selbst setzen.
- **Weitere Stellen:** alle `divide-`-Container gesucht: ausgeblendete Elemente sitzen dort nur innerhalb der
  Zeilen, nie als direktes Kind. Nichts zu tun. Nachtrag: `<Ausblenden als="li">` in `divide-y`-Listen
  (Einstellungen, gemerkte Preise, Anträge) blendet eine Zeile aus, solange die Aktion läuft. Ist es die letzte,
  steht unter der vorletzten kurz ein Strich, bis der Server die Liste neu schickt. Bewusst gelassen (weniger als
  eine Sekunde).

### 2026-11-22 · Werkstatt-App: WhatsApp am Termin öffnete eine falsche Nummer

- **Stand:** behoben
- **Wo:** `src/app/app/termine/[id]/page.tsx`, `whatsappHref` in `src/lib/format.ts`
- **Was man sah:** (beim Durchsehen bemerkt) Hatte der Kunde seine Nummer als `0049 171 …` oder `(0171) …`
  eingetragen, ging „WhatsApp“ an `49049171…` bzw. `0171…`, also an niemanden.
- **Ursache:** Der Aufrufer rechnete die Nummer selbst um (`telefon.replace(/^0/, "49")`), nur für die Form
  „0171 …“. `telHref` daneben kannte schon alle Formen, `whatsappHref` nicht.
- **Behebung:** `whatsappHref` rechnet wie `telHref` (+, 00, führende 0), der Aufrufer übergibt die Nummer
  unverändert. Test in `src/lib/format.test.ts`.
- **Muster:** Eingaben von Kunden (Telefon, Kennzeichen, E-Mail) am Aufrufer mit einem kleinen `replace`
  zurechtgebogen statt in der gemeinsamen Hilfsfunktion; dann fehlen die Formen, an die der Aufrufer nicht dachte.
- **Weitere Stellen:** übrige `whatsappHref`-Aufrufe (Website, mobile Leiste) geben die Firmennummer aus den
  Einstellungen; die profitieren mit, falls dort `0…` steht. Andere Umrechnungen von Telefonnummern am Aufrufer
  nicht gefunden (`grep "replace(/^0"`).

### 2026-11-22 · Kalender: Zurück, Eintragen und Löschen landeten bei „Termine“, der Kalender vergaß die Woche

- **Stand:** behoben
- **Wo:** `src/app/admin/(panel)/termine/[id]/page.tsx`, `termine/neu`, `loeschenAktion`/`eintragenAktion`
  (`src/lib/aktionen/termine.ts`), `src/components/admin/nav.tsx`
- **Was man sah:** Aus dem Kalender einen Termin geöffnet oder eingetragen, dann „Zurück“: man war unter
  „Termine“. Nach dem Löschen ebenso. Das Menü markierte schon beim Öffnen „Termine“, und ein Klick auf
  „Kalender“ zeigte wieder die aktuelle Woche statt der vorher angesehenen. Gemeldet vom Betreiber.
- **Ursache:** Rücksprung und Weiterleitung waren fest auf die Liste verdrahtet (`zurueck={{ href: "/admin/termine" }}`,
  `redirect("/admin/termine")`). „Termin eintragen“ kannte den Kalender nur bis zum Speichern (`?kalender=`),
  danach ging die Herkunft verloren. Das Menü leitete „aktiv“ nur aus dem Pfad ab.
- **Behebung:** Die Kalenderansicht reist als `?kal=…` mit (`src/lib/kalender-ansicht.ts`): an Terminlinks im
  Kalender, durch „Termin eintragen“ (verstecktes Feld) und den Werkstattauftrag bis zurück. Löschen springt mit
  `kal` in den Kalender, das Menü markiert dann „Kalender“. „Kalender“ im Menü führt zur zuletzt angesehenen
  Ansicht (je Tab, nur am selben Tag, `src/lib/hooks/kalender-merken.ts`).
- **Muster:** Eine Seite, die man von mehreren Stellen erreicht, mit festem „Zurück“ oder festem `redirect` nach
  Speichern/Löschen. Woher man kam, muss mitreisen (Suchparameter, bei Formularen als verstecktes Feld) und auch
  die Weiterleitung nach der Aktion überleben.
- **Weitere Stellen:** gesucht: Die übrigen Detailseiten der Verwaltung (Rechnungen, Kostenvoranschläge, Kunden …)
  haben ein festes „Zurück“ zur eigenen Liste, man erreicht sie aber fast nur von dort. Offen: ein Termin, den man
  von der Kundenakte oder der Übersicht öffnet, führt weiter zu „Termine“ zurück, eine Rechnung aus dem Termin zu
  „Rechnungen“.

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
  „offen“ enthält Stornorechnungen (Status `gestellt`, negativ), das war schon vorher so gewollt. Nachtrag 2026-11-23: bei unbezahltem Original falsch, siehe Eintrag
  „Stornorechnung zählt als offener Posten“.

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
