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

### 2026-11-26 · Auftrag einplanen: Dauer 120 gilt als „kein gültiger Wert“

- **Stand:** behoben
- **Wo:** `src/components/admin/termin-aktionen.tsx` (Einplanen eines Auftrags ohne Termin, Admin und Handy-App)
- **Was man sah:** (vom Nutzer gemeldet, iPhone) Beim Tippen auf „Einplanen, Kunde bekommt Mail“ zeigte das Feld
  „Dauer (Minuten)“ mit 120 die Blase „Gültigen Wert eingeben“, das Formular ging nicht ab.
- **Ursache:** `<input type="number" min={1} step={5}>`. Der Browser zählt die Schritte ab `min`, gültig waren also
  nur 1, 6, 11, …, 116, 121. Jede runde Dauer (30, 60, 120) wurde abgelehnt.
- **Behebung:** `step` entfernt (Schritt 1). Die Vorgabe kommt aus den Leistungen und kann jede Minutenzahl sein,
  der Server rundet ohnehin selbst.
- **Muster:** Zahlenfeld mit `step` größer 1, dessen `min` (oder bei fehlendem `min` die 0) kein Vielfaches des
  Schritts ist, oder dessen Vorgabe nicht auf dem Raster liegt. Der Browser sperrt dann das Absenden.
- **Weitere Stellen:** alle `step=` in `src` gesucht: sonst nur Schritt 1, `any` oder `0.01`, unkritisch.

### 2026-11-26 · Rostschutz-Kachel läuft rechts über den Rand

- **Stand:** behoben
- **Wo:** `src/components/site/leistungsbereiche.tsx` (breite Kachel „Rostschutz“ auf der Startseite)
- **Was man sah:** (beim Prüfen der neuen Leistungsboxen, Tablet-Breite) Die breite Kachel war breiter als die
  Reihe darüber und lief rechts aus dem Seitenrand.
- **Ursache:** Die Kachel hatte `md:aspect-[21/8]`. Wird der Inhalt höher als das Seitenverhältnis erlaubt (Boxen
  statt einer Chip-Zeile), wächst die Höhe, und über das Seitenverhältnis wächst im Grid die Breite mit.
- **Behebung:** statt Seitenverhältnis eine Mindesthöhe (`md:min-h-[440px]`).
- **Muster:** `aspect-*` an einem Element, das selbst Text oder Listen im Fluss trägt (nicht nur ein Bild mit
  `fill`). Dort Mindesthöhe nehmen, Seitenverhältnis nur für reine Bildrahmen.
- **Weitere Stellen:** alle `aspect-[` gesucht. Bildrahmen (Angebote, Startseite, Leistungsseite) tragen nur
  absolut liegende Inhalte, unkritisch. Banner auf `/leistungen` (`md:aspect-[21/6]`) trägt Titel und eine Zeile
  Text aus `BEREICHE`, passt bei den heutigen Texten; bei längeren Texten dasselbe Risiko. Offen gelassen.

### 2026-11-26 · Detailseiten: Adresse ohne gültige ID gab einen Datenbankfehler statt „nicht gefunden“

- **Stand:** behoben für Mitarbeiter, sonst offen
- **Wo:** `src/app/admin/(panel)/mitarbeiter/[id]/page.tsx`
- **Was man sah:** Beim Anlegen der Antragsseite `/admin/mitarbeiter/antrag/[id]` aufgefallen: `/admin/mitarbeiter/antrag`
  ohne ID landet in der Personenseite mit der ID „antrag“, die Datenbank lehnt das als UUID ab, und statt
  „nicht gefunden“ kommt die Fehlerseite samt Eintrag im Fehlerprotokoll.
- **Ursache:** Die `[id]`-Seite gibt den Pfadteil ungeprüft an eine Abfrage auf eine UUID-Spalte. Seit `db()` jeden
  Fehler wirft, wird daraus kein leeres Ergebnis (`notFound()`), sondern ein Systemfehler.
- **Behebung:** Personenseite prüft die Form der ID und ruft sonst `notFound()`; die Antragsseite ebenso.
- **Muster:** Eine dynamische Seite (`[id]`), die den Pfadteil ohne Formprüfung an eine UUID-Spalte gibt. Besonders,
  wenn daneben ein fester Unterordner liegt (`mitarbeiter/antrag`, `karriere/stelle`), den man ohne ID aufrufen kann.
- **Weitere Stellen:** gesucht: Alle übrigen `[id]`-Seiten in `admin`, `app`, `team`, `druck` und `(site)/karriere`
  prüfen nicht. Dort führt nur eine von Hand verstümmelte Adresse hin; bewusst offen gelassen.

### 2026-11-26 · Online-Beauftragung ohne Widerrufsbelehrung, Knopf ohne „zahlungspflichtig“, AGB nicht einbezogen

- **Stand:** behoben
- **Wo:** Terminanfrage (`/termin`), Werkstattauftrag über den Terminlink (`auftrag-erteilen.tsx`), Kostenvoranschlag
  annehmen (`kv-antwort.tsx`), AGB-Standardtext (`rechtstexte-standard.ts`), Auftragsbestätigung (`auftrag.ts`)
- **Was man sah:** (rechtliche Prüfung) Online-Beauftragung durch Verbraucher ist Fernabsatz, aber nirgends stand eine
  Widerrufsbelehrung; die AGB machten sogar jede Terminbuchung zum Vertrag. Knöpfe „Auftrag verbindlich erteilen“
  und „Ja, annehmen“; AGB in den Online-Wegen weder erwähnt noch verlinkt.
- **Ursache:** Die Abläufe wurden von der Werkstatt aus gedacht (Unterschrift vor Ort), die Online-Wege kamen später dazu.
- **Folgen ohne Behebung:** Widerrufsfrist 12 Monate und 14 Tage, nach Widerruf kein Wertersatz (§ 357a BGB); ohne
  „zahlungspflichtig“ auf dem Knopf kein Vertrag (§ 312j Abs. 4 BGB); AGB gelten nicht (§ 305 Abs. 2 BGB).
- **Behebung:** Terminanfrage ist laut AGB § 2 eine unverbindliche Reservierung (§ 10 ohne Ausfallpauschale).
  Online erteilen und KV annehmen: AGB-Link, Pflicht-Häkchen „vor Ablauf der Widerrufsfrist beginnen“
  (§ 356 Abs. 4 BGB, gespeichert in `auftrag_vorab_am`/`vorab_am`), Knopf „Zahlungspflichtig beauftragen“.
  Seite `/widerruf` mit Mustertext und -formular (`widerrufAbschnitte`), dieselbe Belehrung in der
  Auftragsbestätigung, wenn nicht in der Werkstatt unterschrieben wurde.
- **Muster:** Jeder Knopf, mit dem ein Kunde online etwas Kostenpflichtiges auslöst, braucht: Beschriftung mit
  „zahlungspflichtig“, AGB-Link direkt davor, Widerrufsbelehrung und bei Dienstleistungen das Häkchen für den
  sofortigen Beginn, danach eine Bestätigung per Mail mit Belehrung.
- **Weitere Stellen:** Gegenvorschlag annehmen (`vorschlag-antwort.tsx`) und Terminwahl am KV bestätigen nur eine
  Reservierung, kein Vertrag; Kundenbildschirm ist vor Ort (kein Fernabsatz) und hatte das AGB-Häkchen schon.
  „Zugesagt“ am KV in der Verwaltung (Kunde rief an) ist ebenfalls Fernabsatz: Die Bestätigungsmail bringt die
  Belehrung, das Verlangen nach sofortigem Beginn muss das Büro am Telefon erfragen (nicht im System erfasst).

### 2026-11-26 · Bewertungs- und Reifenmails ohne Einwilligung, Einwilligungen nur angezeigt

- **Stand:** behoben
- **Wo:** Takt (`automatik.ts`: „bewertungen“, „saison“), WhatsApp-Vorlagen (`whatsapp-daten.ts`), Kundenakte
- **Was man sah:** (rechtliche Prüfung) Die Bitte um eine Google-Bewertung ging an jeden Kunden mit E-Mail, die
  Reifenmail an jeden mit eingelagerten Rädern, beide ohne Abmeldelink. `whatsapp_ok_am` und
  `erinnerung_mail_ok_am` vom Kundenbildschirm wurden nur angezeigt, nirgends geprüft; widerrufen ließ sich nur am
  Bildschirm.
- **Ursache:** Die Einwilligungen kamen mit dem Kundenbildschirm, die Mails gab es schon vorher; niemand hat beides
  verbunden.
- **Behebung:** Beide Mails nur mit `erinnerung_mail_ok_am`, mit Abmeldelink (`/abmelden/<kunde>/<schlüssel>`,
  `src/lib/einwilligung.ts`). WhatsApp-Bewertungsbitte nur mit beiden Einwilligungen, sonst warnt der
  WhatsApp-Knopf vor dem Öffnen. Einwilligungen in der Kundenakte eintragen und widerrufen, mit Verlauf. Text am
  Kundenbildschirm nennt die Bewertung und das Widerrufsrecht.
- **Muster:** Jede Nachricht, die nicht unmittelbar zu einem laufenden Auftrag gehört (Bewertung, Saison,
  Angebote, „lange nicht gesehen“), ist Werbung: Einwilligung prüfen und `abmelden` an `mail()` geben.
- **Weitere Stellen:** Erinnerung 24 h vor dem Termin, Terminmails, Rechnung und Mahnung gehören zum Vertrag und
  bleiben. Hinweis: Wer vor dieser Änderung am Bildschirm „Erinnerungen“ erlaubt hat, sah den Text ohne Bewertung.

### 2026-11-26 · Kundenbildschirm zeigte fremde Daten nach Eingabe eines Kennzeichens

- **Stand:** behoben
- **Wo:** `kundenFinden` (`src/lib/kundenbildschirm/daten.ts`), Formular in `bildschirm.tsx`
- **Was man sah:** (rechtliche Prüfung) „Ich war schon einmal da“ + genaues Kennzeichen zeigte Name, Telefon,
  E-Mail und Anschrift. Kennzeichen stehen sichtbar an den Autos auf dem Hof.
- **Behebung:** Treffer gehen nur verdeckt an den Bildschirm (`verdecken.ts`, getestet), die Felder bleiben leer mit
  dem verdeckten Wert als Platzhalter; leer gelassen heißt unverändert (`stammZusammenfuehren`). Beim Unterschreiben
  danach ist der Name nicht vorbelegt.
- **Muster:** Alles, was ohne Anmeldung über ein erratbares oder sichtbares Merkmal (Kennzeichen, Telefon) gefunden
  wird, darf personenbezogene Daten nur verdeckt zurückgeben. Kundenlinks mit langem Zufallstoken sind etwas anderes.
- **Weitere Stellen:** Kundenlinks `/t`, `/k`, `/r` nutzen 64-stellige Tokens (in Ordnung). Die Liste mehrerer
  Treffer zeigt ebenfalls nur verdeckte Namen.

### 2026-11-26 · Mehrkosten über der Kostengrenze ohne festgehaltene Zustimmung

- **Stand:** behoben
- **Wo:** Werkstattauftrag (`auftrag.ts`, `auftrag-regeln.ts`, `components/admin/auftrag.tsx`), Rechnungsentwurf
- **Was man sah:** (rechtliche Prüfung) Über der Kostengrenze stand nur ein roter Hinweis; ob und wie der Kunde
  zugestimmt hat, ließ sich nicht festhalten, die Rechnung ging trotzdem über den vollen Betrag.
- **Behebung:** Am Auftrag „Zustimmung bis … eintragen“ mit Weg (Telefon, WhatsApp …), gespeichert in
  `auftrag_freigabe_*`, Verlauf und Ereignis `auftrag.mehrkosten_freigegeben`. `ueberKostengrenze` rechnet ab der
  Freigabe weiter; der Rechnungsentwurf warnt, solange die Rechnung über dem Freigegebenen liegt.
- **Muster:** Wo eine Zusage des Kunden Geld kostet, gehört ihr Nachweis (wann, wie, wer hat es eingetragen) in die
  Datenbank, nicht nur ein Hinweis auf den Bildschirm.
- **Weitere Stellen:** AGB § 2 Abs. 3 sagt jetzt dasselbe (Mehrarbeiten nur nach Zustimmung).

### 2026-11-26 · Termin löschen und Mail-Papierkorb löschten Geschäftsbriefe

- **Stand:** behoben
- **Wo:** `termin_loeschen` (Migration `20261205100000_rechtliches.sql`), `loeschen` in `termine.ts`, `mail/postfach.ts`
- **Was man sah:** (rechtliche Prüfung) Termin löschen nahm verschickte Kostenvoranschläge und den unterschriebenen
  Werkstattauftrag mit; der Papierkorb des Postfachs wurde nach 30 Tagen endgültig geleert.
- **Behebung:** Verschickte KVs bleiben mit `archiviert_am` (aus allen Listen und ohne Kundenlink), ein verschickter
  oder erteilter Auftrag kommt als PDF mit allen Daten, Unterschrift, Fotos und Verlauf in `archiv_auftraege`. Mails
  aus dem Papierkorb bekommen `aufbewahrt_am` statt gelöscht zu werden, nach 6 Jahren (ab Jahresende) löscht der
  Takt. Alles unter Einstellungen → Archiv (Mails nur mit Zugriff aufs jeweilige Postfach).
- **Muster:** Was dem Kunden zugegangen ist (Beleg, Angebot, Auftrag, Mail), nie hart löschen, sondern archivieren.
- **Weitere Stellen:** Rechnungen blieben schon immer (`rechnungen.termin_id → null`). `kunde_loeschen` behält
  gestellte Belege; Kostenvoranschläge eines gelöschten Kunden bleiben ebenfalls (Fremdschlüssel `set null`).

### 2026-11-26 · Datenschutzhinweise fehlten (Bewerbung, Kundenbildschirm, Mails, Beschäftigte)

- **Stand:** behoben
- **Wo:** Mitgelieferte Datenschutzerklärung, Bewerbungsformular, Team-App (Stempeln, Mehr)
- **Was man sah:** (rechtliche Prüfung) Keine Angaben zu Bewerbungen, Kundenbildschirm, Fotos, Erinnerungen,
  Steuerberater, Schnittstellen und Mailempfang; am Bewerbungsformular kein Hinweis; Beschäftigte wurden über
  Standortprüfung und gespeicherte Daten nicht informiert.
- **Behebung:** Abschnitte in `datenschutzStandard` ergänzt, Hinweis unter dem Bewerbungsformular, Hinweis beim
  Stempeln und „Datenschutz: Was die App über mich speichert“ unter Team-App → Mehr.
- **Muster:** Kommt eine neue Art von Daten oder ein neuer Empfänger dazu, gehört er in die Datenschutzerklärung
  und an die Stelle, wo die Daten erhoben werden.
- **Weitere Stellen:** Kommt die Datenschutzerklärung von einem Rechtstexte-Dienst, muss dort dasselbe ergänzt
  werden; der mitgelieferte Text gilt nur als Ersatz.

### 2026-11-26 · Nicht versendete Kundenmails nur im Server-Log

- **Stand:** behoben
- **Wo:** `kundeBestaetigen` (`auftrag.ts`), `kundenMail` (`termine.ts`)
- **Was man sah:** Scheiterte die Auftragsbestätigung oder eine Terminmail, stand das nur per `console.warn` im Log.
- **Behebung:** `fehlerMelden`, damit es unter Einstellungen → Fehler erscheint.
- **Muster:** `console.warn`/`console.error` auf dem Server statt `fehlerMelden` oder `weich`.
- **Weitere Stellen:** `sicher.ts` loggt erwartete Fehler (keine Systemfehler) bewusst nur; `push-abgleich.tsx` läuft
  im Browser, dort gibt es kein Fehlerprotokoll.

### 2026-11-26 · Beleg-Editor: Bezeichnung der Positionen nur 50 px breit

- **Stand:** behoben
- **Wo:** Positionen im `BelegEditor` (`src/components/admin/beleg-editor.tsx`), also Kostenvoranschlag und Rechnung
- **Was man sah:** (beim Erkunden für das Erklärvideo bemerkt) Bei 1280 px Fensterbreite (Laptop, iPad quer) war das
  Feld „Bezeichnung“ so schmal, dass nur „Ölwecl“ oder „Brems“ zu lesen war.
- **Ursache:** Die Tabellenansicht schaltete ab Bildschirmbreite `md` (768 px) ein. Neben Seitenleiste und
  Verlauf-Spalte ist die Karte dann aber nur rund 600 px breit, die festen Spalten (Menge, Einheit, Einzel, Gesamt,
  Entfernen) brauchen schon rund 500 px.
- **Behebung:** Der Abschnitt ist ein `@container`; Tabelle erst ab 48 rem Abschnittsbreite (`@3xl:` statt `md:`),
  darunter die gestapelte Ansicht wie auf dem Handy.
- **Muster:** Tabellen mit festen Spalten in einer Karte neben einer Seitenspalte: nach der Breite des Containers
  umschalten, nicht nach der des Bildschirms.
- **Weitere Stellen:** Die übrigen Raster mit festen Spalten (Termine, Aufträge, Kostenvoranschläge, Kunden,
  Mitarbeiter) stehen in voller Breite ohne Seitenspalte und haben eine flexible Textspalte `minmax(0,1fr)`; dort
  bleibt genug Platz.

### 2026-11-25 · Knopfbeschriftung läuft über den Rand

- **Stand:** behoben
- **Wo:** `.knopf` in `src/app/globals.css` (alle Knöpfe, auch `Senden`)
- **Was man sah:** (vom Nutzer gemeldet, Screenshot iPad) Termin → Entscheidung: „Andere Zeit vorschlagen …“ und
  „Nein, ablehnen …“ nebeneinander, die Schrift lief links und rechts über die Rahmen und in den Nachbarknopf.
- **Ursache:** `.knopf` hatte `white-space: nowrap`. In Spalten fester Breite (`grid-cols-2` ist in Tailwind
  `minmax(0,1fr)`, darf also schmaler werden als der Text) passte die Beschriftung nicht und lief hinaus.
- **Behebung:** Knöpfe brechen um (`text-wrap: balance`, zentriert, Zeilenhöhe 1.2, Innenrand oben und unten). In
  Zeilen mit `flex-wrap` rutscht ein Knopf vorher in die nächste Zeile, einzeilig sieht alles aus wie vorher.
- **Nachtrag (vom Nutzer gemeldet):** Umgebrochene Knöpfe waren höher als die übrigen, das sah unsauber aus.
  Knopfgruppen stehen deshalb nicht mehr in festen Spalten, sondern in `.knopfreihe` (füllt die Breite, ein Knopf
  rutscht in die nächste Zeile, bevor er umbricht; `.knopfreihe-frei` ab Tablet in natürlicher Breite). Damit sind
  alle Knöpfe einzeilig und 48 px hoch; der Umbruch in `.knopf` bleibt nur als Sicherung für extrem schmale Stellen.
- **Muster:** Text mit `nowrap` in einer Spalte, deren Breite nicht vom Text kommt (`grid-cols-N`,
  `minmax(0,…)`, `w-full` in schmaler Karte). Nicht pro Stelle mit `whitespace-normal` flicken, sondern im Baustein.
  Mehrere Knöpfe nebeneinander nie in `grid-cols-2`, sondern in `.knopfreihe`.
- **Weitere Stellen:** Alle Knöpfe sind über `.knopf` mitbehoben (Entscheidung, Erledigt/Nicht erschienen,
  Absagen, Beleg-Editor). Auf `.knopfreihe` umgestellt: Termin (Entscheidung, Erledigt/Nicht erschienen,
  Verschieben/Absagen), Werkstattauftrag, Kostenvoranschlag (vier Gruppen), Rechnung, Werkstatt-App Termin
  (Anrufen/WhatsApp) und Kunde. `beleg-editor.tsx` hatte den Umbruch schon einzeln nachgerüstet, bleibt so. Weitere
  `whitespace-nowrap` geprüft: Reiter (scrollen quer), Chips, Datumsspalten in Tabellen, Navigation: kurz oder in
  scrollbaren Bereichen, kein Überlauf. Raster mit Text nutzen durchweg `minmax(0,1fr)`. Kopfzeilen (`Kopf`)
  haben `flex-wrap`. Öffentliche Seiten im Browser auf 320, 375, 768 und 1024 px geprüft: kein Überlauf. Die
  Verwaltung ließ sich hier ohne Datenbank nicht öffnen; die Entscheidung-Karte ist mit dem echten CSS
  nachgestellt geprüft.

### 2026-11-25 · Mails auf dem iPhone schmal und mit grauem Rand

- **Stand:** behoben
- **Wo:** `mail()` in `src/lib/email/vorlagen.ts` (alle Mails an Kunden und Team)
- **Was man sah:** (vom Nutzer gemeldet, Screenshot) In iOS-Mail stand die Karte verkleinert und nicht mittig im
  Bildschirm, links und rechts ein breiter grauer Rand.
- **Ursache:** Das HTML hatte keinen `<head>` mit Viewport-Angabe; iOS-Mail rechnet die Mail dann breiter und
  verkleinert sie. Dazu 12 px Außenrand und Kartenrand auf jeder Breite.
- **Behebung:** Viewport und `x-apple-disable-message-reformatting`, bis 600 px Breite kein Außenrand, Karte voll
  breit, weißer Grund, schmalerer Innenrand. Am Rechner bleibt die Karte 560 px breit.
- **Muster:** jedes selbst gebaute Mail-HTML braucht den `<head>` mit Viewport; Mails nie ohne `mail()` bauen.
- **Weitere Stellen:** keine weitere Mail-Vorlage im Code; Mails aus den Postfächern sind freier Text ohne Hülle.

### 2026-11-25 · Kundenlink Kostenvoranschlag: „Die freien Termine konnten nicht geladen werden“

- **Stand:** behoben
- **Wo:** `src/app/api/termine/frei/route.ts` (Zweig `?kv=`)
- **Was man sah:** (vom Nutzer gemeldet, Screenshot) Nach dem Annehmen eines Kostenvoranschlags zeigte
  „Termin wählen“ auf `/k/<token>` nur die Fehlermeldung, keine Tage.
- **Ursache:** Seit „auftrag_ohne_termin“ legt die Zusage eine Terminzeile „ungeplant“ an und setzt
  `kostenvoranschlaege.termin_id`. Die Schnittstelle lehnte jeden KV mit `termin_id` ab (404), Seite und
  `kvTerminAnfragen` ließen „ungeplant“ dagegen zu.
- **Behebung:** Die Schnittstelle lädt den Stand der Terminzeile und lässt „ungeplant“ durch, wie die Seite und die
  Aktion.
- **Muster:** `termin_id` gesetzt heißt nicht mehr „hat einen Termin“. Wer daraus „schon eingeplant“ ableitet,
  muss den Stand prüfen (`ungeplant`), sonst sperrt er genau den wartenden Auftrag aus.
- **Weitere Stellen:** alle Abfragen auf `termin_id` geprüft. `kvVorlage` (`src/lib/termin-daten.ts`) gibt bei
  gesetzter `termin_id` bewusst `null` zurück: ein wartender Auftrag wird über „Einplanen“ terminiert, nicht über
  einen neuen Termin. `kundeAntwortet` liest `termin_id` vor der Zusage, also die alte Verknüpfung: richtig.

### 2026-11-25 · Kostenvoranschlag: Zusage ohne Termin ergab keinen Auftrag, Rechnung am Auftrag vorbei

- **Stand:** behoben
- **Wo:** `kvBeantworten`, `kvInRechnung` (entfernt) in `src/lib/rechnung/kostenvoranschlaege.ts`, `auftragAnlegen` in
  `src/lib/auftrag.ts`, `ablehnen`/`stornieren`/`vorschlagAntworten` in `src/lib/termine.ts`
- **Was man sah:** (vom Nutzer gemeldet: „Kann man einen KVA nicht zu einem Auftrag machen?“) Ein angenommener
  Kostenvoranschlag ohne Termin hatte keinen Auftrag, bis jemand einen Termin verknüpfte. „In Rechnung übernehmen“
  am KV legte die Rechnung aus den KV-Positionen an, Mehrarbeit aus dem Auftrag fehlte darin. „Werkstattauftrag
  anlegen“ an einem Termin mit offenem KV nahm die Leistungen des Termins statt der KV-Positionen. Wurde die Anfrage
  zu einem erteilten Auftrag abgelehnt (oder der Gegenvorschlag), verschwand der erteilte Auftrag mit ihr.
- **Ursache:** Der Auftrag konnte nur an einem Termin mit Zeit hängen, und vom KV zur Rechnung gab es zwei Wege.
- **Behebung:** Stand `ungeplant` (Migration `auftrag_ohne_termin`): Zusage heißt immer erteilter Auftrag, notfalls
  ohne Termin; eingeplant wird später. Der KV geht nur noch über den Auftrag zur Rechnung. Lehnt das Büro die Zeit
  ab oder sagt der Kunde ab, bleibt der erteilte Auftrag und wartet wieder ohne Termin (`zeitAufheben`).
- **Muster:** Zwei Wege zum selben Ergebnis, von denen einer spätere Änderungen übergeht (Beleg aus der Vorlage statt
  aus dem lebenden Dokument). Oder eine Statusänderung am Träger (Termin), die etwas Verbindliches daran (erteilter
  Auftrag) stillschweigend mitnimmt.
- **Weitere Stellen:** `entwurfAusTermin` nimmt den Auftrag schon vor dem KV, in Ordnung. Mitbehoben: Eine Rechnung
  aus einem Auftrag ohne Termin bekäme als Leistungsdatum den 1.1.1970 (`new Date(null)`), jetzt der Tag der
  Rechnung. Alle `beginn`-Stellen über den Typ geprüft (`beginn` ist jetzt `string | null`); Abfragen nach Zeitraum
  sehen ungeplante Aufträge nie (`GeplanterTermin`). Erledigen, Nicht erschienen und Absagen durch den Kunden gibt es
  für einen Auftrag ohne Termin nicht.

### 2026-11-25 · Eingehende Mails und Takt kamen nicht an: Domain ohne www leitet weiter

- **Stand:** behoben (Code/Doku); in Resend und Supabase muss die Adresse noch umgestellt werden
- **Wo:** Resend-Webhook, `supabase/zeitsteuerung-einrichten.sql`, README (Umzug auf die eigene Domain, Resend)
- **Was man sah:** (vom Nutzer gemeldet) Mails standen in Resend, aber nicht im Postfach der App. Resend zeigte bei
  jeder Zustellung „308 Permanent Redirect“ und „Attempting“.
- **Ursache:** Vercel liefert die Website unter `www.flcautomotive.de` aus und leitet `flcautomotive.de` mit 308
  dorthin weiter. Resend (Svix) und pg_net folgen keiner Weiterleitung, der Aufruf kommt nie bei der App an. Die
  Zeitsteuerung zeigte seit dem Domainwechsel ebenfalls auf die Adresse ohne www.
- **Behebung:** Zeitsteuerung und README auf `https://www.flcautomotive.de`; Webhook-Endpunkt in Resend und
  `NEXT_PUBLIC_SITE_URL` in Vercel ebenso.
- **Muster:** Eine Adresse, die ein Dienst von sich aus aufruft (Webhook, Cron, Rückruf), zeigt auf eine Domain, die
  nur weiterleitet. Im Browser fällt das nie auf. Prüfen mit `curl -sI -X POST <adresse>`: Es darf kein 30x kommen.
- **Weitere Stellen:** `ENV.siteUrl` speist Links in Mails, Signatur und Sitemap (Browser folgen der Weiterleitung,
  unkritisch) und die Anzeige des Endpunkts in Einstellungen → E-Mail → Einrichtung (zeigt die falsche Adresse, solange
  `NEXT_PUBLIC_SITE_URL` ohne www ist). Ausgehende Webhooks der App rufen fremde Adressen auf, nicht betroffen.
  Mitbehoben (vom Nutzer gemeldet): Das Logo der Mail-Signatur (`${siteUrl}/mail/logo.png`) fehlte in Postfach und
  Editor, weil die Content-Security-Policy nur Bilder von 'self' (www) zulässt. `next.config.ts` erlaubt in `img-src`
  jetzt die eingestellte Website-Adresse mit und ohne www, so zeigen auch schon gesendete Mails ihr Logo.

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
