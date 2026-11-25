import type { Einstellungen } from "./einstellungen";

/**
 * Mitgelieferte Rechtstexte, übernommen von der früheren Website (Stand März 2026). Sie gelten, wenn weder ein
 * Rechtstexte-Dienst noch ein Ersatztext in den Einstellungen hinterlegt ist, damit die Pflichtseiten nie leer
 * sind. Anschrift und Kontakt kommen aus den Einstellungen, sonst stünde nach einem Umzug die alte Adresse hier.
 *
 * An die neue Website angepasst: kein Google Analytics und keine eingebettete Karte mehr (nur Verweise),
 * Terminanfragen landen in der eigenen Verwaltung statt per WhatsApp, Datenbank und Mailversand sind genannt.
 * Wer hier einen Dienst ergänzt (Analyse, Karte, Video), muss die Erklärung und den Cookie-Hinweis mitziehen.
 */

type Firma = Einstellungen["firma"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function anschrift(f: Firma, mitInhaber: boolean): string {
  return `<p>${esc(f.name)}<br />${mitInhaber ? `${esc(f.inhaber)}<br />` : ""}${esc(f.strasse)}<br />${esc(f.plz)} ${esc(f.ort)}</p>`;
}

function kontakt(f: Firma): string {
  return `<p>Telefon: ${esc(f.telefon)}<br />E-Mail: <a href="mailto:${esc(f.email)}">${esc(f.email)}</a></p>`;
}

const link = (url: string) => `<a href="${url}" rel="noopener noreferrer">${url}</a>`;

export function datenschutzStandard(f: Firma): string {
  return `
<h2>1. Datenschutz auf einen Blick</h2>
<h3>Allgemeine Hinweise</h3>
<p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer nachfolgend aufgeführten Datenschutzerklärung.</p>
<h3>Datenerfassung auf dieser Website</h3>
<p><strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt „Hinweis zur verantwortlichen Stelle“ in dieser Datenschutzerklärung entnehmen.</p>
<p><strong>Wie erfassen wir Ihre Daten?</strong><br />Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z. B. um Daten handeln, die Sie in unser Buchungsformular eingeben. Andere Daten werden automatisch beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z. B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website betreten.</p>
<p><strong>Wofür nutzen wir Ihre Daten?</strong><br />Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten werden zur Bearbeitung Ihrer Anfragen und Terminbuchungen verwendet. Wir setzen keine Analyse- oder Werbedienste ein.</p>
<p><strong>Welche Rechte haben Sie bezüglich Ihrer Daten?</strong><br />Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht, unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.</p>

<h2>2. Hosting und Datenbank</h2>
<h3>Vercel</h3>
<p>Wir hosten unsere Website bei Vercel. Anbieter ist die Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA (nachfolgend „Vercel“).</p>
<p>Wenn Sie unsere Website besuchen, werden Ihre personenbezogenen Daten auf den Servern von Vercel verarbeitet. Hierbei können auch personenbezogene Daten an den Sitz der Vercel Inc. in die USA übermittelt werden. Die Datenübermittlung in die USA wird auf die EU-Standardvertragsklauseln gestützt. Details finden Sie hier: ${link("https://vercel.com/legal/privacy-policy")}.</p>
<p>Die Verwendung von Vercel erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an einer möglichst zuverlässigen Darstellung unserer Website.</p>
<h3>Supabase</h3>
<p>Terminanfragen und die Daten unserer Kundenverwaltung speichern wir in einer Datenbank bei Supabase. Anbieter ist die Supabase Inc. Soweit dabei personenbezogene Daten in die USA übermittelt werden, wird dies auf die EU-Standardvertragsklauseln gestützt. Details finden Sie hier: ${link("https://supabase.com/privacy")}.</p>
<p>Die Verwendung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung und -erfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an einer sicheren und zuverlässigen Speicherung.</p>
<p><strong>Auftragsverarbeitung</strong><br />Wir haben mit den oben genannten Anbietern Verträge über Auftragsverarbeitung (AVV) geschlossen. Hierbei handelt es sich um datenschutzrechtlich vorgeschriebene Verträge, die gewährleisten, dass die Anbieter die personenbezogenen Daten unserer Websitebesucher nur nach unseren Weisungen und unter Einhaltung der DSGVO verarbeiten.</p>

<h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
<h3>Datenschutz</h3>
<p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
<p>Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.</p>
<h3>Hinweis zur verantwortlichen Stelle</h3>
<p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
${anschrift(f, true)}
${kontakt(f)}
<p>Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.</p>
<h3>Speicherdauer</h3>
<p>Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben (z. B. steuer- oder handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall erfolgt die Löschung nach Fortfall dieser Gründe.</p>
<h3>Allgemeine Hinweise zu den Rechtsgrundlagen der Datenverarbeitung auf dieser Website</h3>
<p>Sofern Sie in die Datenverarbeitung eingewilligt haben, verarbeiten wir Ihre personenbezogenen Daten auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO bzw. Art. 9 Abs. 2 lit. a DSGVO, sofern besondere Datenkategorien nach Art. 9 Abs. 1 DSGVO verarbeitet werden. Im Falle einer ausdrücklichen Einwilligung in die Übertragung personenbezogener Daten in Drittstaaten erfolgt die Datenverarbeitung außerdem auf Grundlage von Art. 49 Abs. 1 lit. a DSGVO. Sofern die Datenverarbeitung zur Erfüllung eines Vertrags oder zur Durchführung vorvertraglicher Maßnahmen erforderlich ist, verarbeiten wir Ihre Daten auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Des Weiteren verarbeiten wir Ihre Daten, sofern diese zur Erfüllung einer rechtlichen Verpflichtung erforderlich sind, auf Grundlage von Art. 6 Abs. 1 lit. c DSGVO. Die Datenverarbeitung kann ferner auf Grundlage unseres berechtigten Interesses nach Art. 6 Abs. 1 lit. f DSGVO erfolgen.</p>
<h3>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
<p>Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.</p>
<h3>Widerspruchsrecht gegen die Datenerhebung in besonderen Fällen (Art. 21 DSGVO)</h3>
<p>WENN DIE DATENVERARBEITUNG AUF GRUNDLAGE VON ART. 6 ABS. 1 LIT. E ODER F DSGVO ERFOLGT, HABEN SIE JEDERZEIT DAS RECHT, AUS GRÜNDEN, DIE SICH AUS IHRER BESONDEREN SITUATION ERGEBEN, GEGEN DIE VERARBEITUNG IHRER PERSONENBEZOGENEN DATEN WIDERSPRUCH EINZULEGEN. DIE JEWEILIGE RECHTSGRUNDLAGE, AUF DENEN EINE VERARBEITUNG BERUHT, ENTNEHMEN SIE DIESER DATENSCHUTZERKLÄRUNG. WENN SIE WIDERSPRUCH EINLEGEN, WERDEN WIR IHRE BETROFFENEN PERSONENBEZOGENEN DATEN NICHT MEHR VERARBEITEN, ES SEI DENN, WIR KÖNNEN ZWINGENDE SCHUTZWÜRDIGE GRÜNDE FÜR DIE VERARBEITUNG NACHWEISEN, DIE IHRE INTERESSEN, RECHTE UND FREIHEITEN ÜBERWIEGEN, ODER DIE VERARBEITUNG DIENT DER GELTENDMACHUNG, AUSÜBUNG ODER VERTEIDIGUNG VON RECHTSANSPRÜCHEN (WIDERSPRUCH NACH ART. 21 ABS. 1 DSGVO).</p>
<h3>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
<p>Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Das Beschwerderecht besteht unbeschadet anderweitiger verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.</p>
<p>Die für uns zuständige Aufsichtsbehörde ist:</p>
<p>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit<br />Postfach 3163<br />65021 Wiesbaden<br />Telefon: +49 611 1408-0<br />E-Mail: <a href="mailto:poststelle@datenschutz.hessen.de">poststelle@datenschutz.hessen.de</a><br />Website: ${link("https://datenschutz.hessen.de")}</p>
<h3>Recht auf Datenübertragbarkeit</h3>
<p>Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten an einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar ist.</p>
<h3>Auskunft, Berichtigung und Löschung</h3>
<p>Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten können Sie sich jederzeit an uns wenden.</p>
<h3>Recht auf Einschränkung der Verarbeitung</h3>
<p>Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Hierzu können Sie sich jederzeit an uns wenden. Das Recht auf Einschränkung der Verarbeitung besteht in folgenden Fällen:</p>
<ul>
<li>Wenn Sie die Richtigkeit Ihrer bei uns gespeicherten personenbezogenen Daten bestreiten, benötigen wir in der Regel Zeit, um dies zu überprüfen. Für die Dauer der Prüfung haben Sie das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
<li>Wenn die Verarbeitung Ihrer personenbezogenen Daten unrechtmäßig geschah/geschieht, können Sie statt der Löschung die Einschränkung der Datenverarbeitung verlangen.</li>
<li>Wenn wir Ihre personenbezogenen Daten nicht mehr benötigen, Sie sie jedoch zur Ausübung, Verteidigung oder Geltendmachung von Rechtsansprüchen benötigen, haben Sie das Recht, statt der Löschung die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
<li>Wenn Sie einen Widerspruch nach Art. 21 Abs. 1 DSGVO eingelegt haben, muss eine Abwägung zwischen Ihren und unseren Interessen vorgenommen werden. Solange noch nicht feststeht, wessen Interessen überwiegen, haben Sie das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
</ul>

<h2>4. Datenerfassung auf dieser Website</h2>
<h3>Cookies und lokale Speicherung</h3>
<p>Unsere Internetseiten verwenden ausschließlich technisch notwendige Cookies und Speichereinträge. Cookies sind kleine Datenpakete und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.</p>
<p>Im Einzelnen sind das: ein Eintrag im Speicher Ihres Browsers, der sich merkt, dass Sie den Cookie-Hinweis gelesen haben, sowie Anmelde-Cookies für den Mitarbeiterbereich, die nur nach einer Anmeldung gesetzt werden. Cookies von Drittanbietern, Analyse- oder Werbe-Cookies setzen wir nicht ein.</p>
<p>Die Speicherung erfolgt auf Grundlage von § 25 Abs. 2 Nr. 2 TDDDG und Art. 6 Abs. 1 lit. f DSGVO. Wir haben ein berechtigtes Interesse an der technisch fehlerfreien Bereitstellung unserer Dienste. Eine Einwilligung ist für technisch notwendige Speicherung nicht erforderlich.</p>
<p>Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden und Cookies nur im Einzelfall erlauben, die Annahme von Cookies für bestimmte Fälle oder generell ausschließen sowie das automatische Löschen der Cookies beim Schließen des Browsers aktivieren. Bei der Deaktivierung von Cookies kann die Funktionalität dieser Website eingeschränkt sein.</p>
<h3>Server-Log-Dateien</h3>
<p>Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:</p>
<ul>
<li>Browsertyp und Browserversion</li>
<li>verwendetes Betriebssystem</li>
<li>Referrer URL</li>
<li>Hostname des zugreifenden Rechners</li>
<li>Uhrzeit der Serveranfrage</li>
<li>IP-Adresse</li>
</ul>
<p>Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Der Websitebetreiber hat ein berechtigtes Interesse an der technisch fehlerfreien Darstellung und der Optimierung seiner Website – hierzu müssen die Server-Log-Dateien erfasst werden.</p>
<h3>Anfrage per E-Mail oder Telefon</h3>
<p>Wenn Sie uns per E-Mail oder Telefon kontaktieren, wird Ihre Anfrage inklusive aller daraus hervorgehenden personenbezogenen Daten (Name, Anfrage) zum Zwecke der Bearbeitung Ihres Anliegens bei uns gespeichert und verarbeitet. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.</p>
<p>Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder zur Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), sofern diese abgefragt wurde.</p>
<p>Die von Ihnen an uns per Kontaktanfragen übersandten Daten verbleiben bei uns, bis Sie uns zur Löschung auffordern, Ihre Einwilligung zur Speicherung widerrufen oder der Zweck für die Datenspeicherung entfällt. Zwingende gesetzliche Bestimmungen – insbesondere gesetzliche Aufbewahrungsfristen – bleiben unberührt.</p>

<h2>5. Terminbuchung und WhatsApp</h2>
<h3>Terminbuchung über das Buchungsformular</h3>
<p>Wenn Sie über unser Buchungsformular einen Termin anfragen, werden die von Ihnen eingegebenen Daten (Name, Telefonnummer, E-Mail-Adresse, Kennzeichen, Fahrzeug, gewünschte Leistung, Terminwunsch und Ihre Nachricht) zum Zwecke der Terminvereinbarung und Vertragsanbahnung in unserer Kundenverwaltung gespeichert und verarbeitet. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen bzw. Vertragserfüllung).</p>
<h3>WhatsApp</h3>
<p>Wir bieten Ihnen die Möglichkeit, uns direkt über WhatsApp zu kontaktieren. WhatsApp ist ein Dienst der Meta Platforms Ireland Limited, 4 Grand Canal Square, Grand Canal Harbour, Dublin 2, Irland (für Nutzer im Europäischen Wirtschaftsraum). Bei der Nutzung von WhatsApp werden personenbezogene Daten (z. B. Ihre Telefonnummer, Ihr Name, Nachrichteninhalte) an Meta übermittelt und auf Servern verarbeitet, die sich auch außerhalb der EU/des EWR befinden können (insbesondere in den USA). Auf unserer Website ist WhatsApp nur verlinkt; Daten werden erst übertragen, wenn Sie den Link anklicken.</p>
<p>Die Nutzung von WhatsApp erfolgt auf Grundlage unseres berechtigten Interesses an einer schnellen und effizienten Kommunikation mit Kunden und Interessenten (Art. 6 Abs. 1 lit. f DSGVO) sowie auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), sofern Sie uns über WhatsApp kontaktieren. Sie können diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.</p>
<p>Die Datenübermittlung in die USA wird auf die EU-Standardvertragsklauseln der EU-Kommission gestützt. Weitere Informationen finden Sie in der Datenschutzrichtlinie von WhatsApp: ${link("https://www.whatsapp.com/legal/privacy-policy")}.</p>

<h2>6. Externe Dienste und Inhalte</h2>
<h3>Google Maps</h3>
<p>Auf unserer Website sind Links zu Google Maps eingebunden (Anfahrt und Bewertungen). Anbieter ist die Google Ireland Limited („Google“), Gordon House, Barrow Street, Dublin 4, Irland. Es ist keine Karte eingebettet: Daten werden erst an Google übertragen, wenn Sie einen solchen Link anklicken. Mehr Informationen zum Umgang mit Nutzerdaten finden Sie in der Datenschutzerklärung von Google: ${link("https://policies.google.com/privacy")}.</p>
<h3>Instagram</h3>
<p>Auf unserer Website sind Links zum sozialen Netzwerk Instagram eingebunden. Anbieter ist die Meta Platforms Ireland Limited, 4 Grand Canal Square, Grand Canal Harbour, Dublin 2, Irland. Wenn Sie einen Instagram-Link anklicken, werden Sie auf unsere Instagram-Seite weitergeleitet. Instagram verarbeitet dabei Daten über Ihr Nutzungsverhalten. Weitere Informationen finden Sie in der Datenschutzrichtlinie von Instagram/Meta: ${link("https://privacycenter.instagram.com/policy")}.</p>
<p>Die Verlinkung erfolgt auf Grundlage unseres berechtigten Interesses an einer Präsenz in sozialen Netzwerken nach Art. 6 Abs. 1 lit. f DSGVO. Es werden durch die bloße Verlinkung (kein eingebettetes Plugin) keine Daten an Instagram übertragen, solange Sie den Link nicht aktiv anklicken.</p>
<h3>Schriftarten</h3>
<p>Die Schriftarten dieser Website liegen auf unserem eigenen Server. Beim Aufruf der Seiten wird keine Verbindung zu Google Fonts oder anderen Schriftanbietern aufgebaut.</p>

<h2>7. E-Mail-Versand</h2>
<p>Wenn Sie über unser Buchungsformular eine Terminanfrage stellen, erhalten Sie Bestätigungs- und Terminmails an die von Ihnen angegebene E-Mail-Adresse. Der Versand erfolgt über den E-Mail-Dienstleister Resend (Resend, Inc., USA). Die Datenübermittlung in die USA wird auf die EU-Standardvertragsklauseln gestützt. Details finden Sie hier: ${link("https://resend.com/legal/privacy-policy")}. Die Verarbeitung Ihrer E-Mail-Adresse erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO zur Durchführung vorvertraglicher Maßnahmen.</p>

<h2>8. Kontakt</h2>
<p>Bei Fragen zum Datenschutz können Sie sich jederzeit an uns wenden:</p>
${kontakt(f)}
<p>Stand: November 2026</p>
`.trim();
}

export function agbStandard(f: Firma): string {
  return `
<p>Stand: November 2026<br />Gültig für: ${esc(f.name)}</p>

<h2>§ 1 Geltungsbereich</h2>
<p>(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen ${esc(f.name)} (nachfolgend „Werkstatt“ genannt) und dem Kunden über Reparatur-, Wartungs- und sonstige Dienstleistungen an Kraftfahrzeugen.</p>
<p>(2) Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Kunden werden nicht Vertragsbestandteil, es sei denn, ihrer Geltung wird ausdrücklich schriftlich zugestimmt.</p>
<p>(3) Diese AGB gelten auch für alle künftigen Geschäftsbeziehungen, auch wenn sie nicht nochmals ausdrücklich vereinbart werden.</p>

<h2>§ 2 Vertragsschluss</h2>
<p>(1) Der Vertrag kommt durch die Annahme des Auftrags durch die Werkstatt zustande. Die Annahme kann mündlich, schriftlich, per E-Mail oder durch Beginn der Arbeiten erfolgen.</p>
<p>(2) Online-Terminbuchungen stellen ein verbindliches Angebot des Kunden dar. Die Werkstatt bestätigt den Termin per E-Mail. Der Vertrag kommt mit Erhalt der Bestätigung zustande.</p>
<p>(3) Kostenvoranschläge sind unverbindlich, sofern nicht ausdrücklich als verbindlich bezeichnet. Bei wesentlichen Abweichungen (über 20 %) vom Kostenvoranschlag wird der Kunde vorab informiert.</p>

<h2>§ 3 Leistungsumfang und Ausführung</h2>
<p>(1) Die Werkstatt führt die vereinbarten Arbeiten fachgerecht und mit qualifizierten Mitarbeitern aus.</p>
<p>(2) Der Kunde ist verpflichtet, die Werkstatt über alle ihm bekannten Mängel und Besonderheiten des Fahrzeugs zu informieren.</p>
<p>(3) Die Werkstatt ist berechtigt, zur Durchführung der Arbeiten Subunternehmer einzusetzen.</p>
<p>(4) Änderungen oder Erweiterungen des Auftrags bedürfen der Zustimmung beider Vertragsparteien.</p>

<h2>§ 4 Preise und Zahlungsbedingungen</h2>
<p>(1) Es gelten die zum Zeitpunkt der Auftragserteilung gültigen Preise der Werkstatt. Die auf der Website und in der Preisliste genannten Preise enthalten die gesetzliche Mehrwertsteuer.</p>
<p>(2) Die Rechnung ist bei Abholung des Fahrzeugs bzw. bei Fertigstellung der Arbeiten fällig und ohne Abzug zahlbar.</p>
<p>(3) Die Werkstatt ist berechtigt, angemessene Abschlagszahlungen zu verlangen.</p>
<p>(4) Bei Zahlungsverzug gelten die gesetzlichen Regelungen. Die Werkstatt ist berechtigt, Verzugszinsen in Höhe von 5 Prozentpunkten über dem Basiszinssatz (bei Verbrauchern) bzw. 9 Prozentpunkten über dem Basiszinssatz (bei Unternehmern) zu berechnen.</p>

<h2>§ 5 Eigentumsvorbehalt und Zurückbehaltungsrecht</h2>
<p>(1) Eingebaute Ersatzteile bleiben bis zur vollständigen Bezahlung Eigentum der Werkstatt.</p>
<p>(2) Die Werkstatt ist berechtigt, das Fahrzeug und ausgebaute Teile bis zur vollständigen Begleichung aller Forderungen aus dem Auftrag zurückzubehalten (Werkunternehmerpfandrecht gem. § 647 BGB, Zurückbehaltungsrecht gem. § 273 BGB).</p>
<p>(3) Ausgebaute Altteile gehen in das Eigentum der Werkstatt über, sofern nicht ausdrücklich etwas anderes vereinbart wurde.</p>

<h2>§ 6 Termine und Fristen</h2>
<p>(1) Vereinbarte Fertigstellungstermine sind nur verbindlich, wenn sie ausdrücklich schriftlich als verbindlich bestätigt wurden.</p>
<p>(2) Bei nicht verschuldeten Verzögerungen (z. B. Lieferschwierigkeiten bei Ersatzteilen, höhere Gewalt) verlängern sich die Fristen angemessen.</p>
<p>(3) Der Kunde wird über wesentliche Verzögerungen unverzüglich informiert.</p>

<h2>§ 7 Gewährleistung</h2>
<p>(1) Für die ausgeführten Arbeiten und eingebauten Teile gelten die gesetzlichen Gewährleistungsrechte.</p>
<p>(2) Die Gewährleistungsfrist beträgt 2 Jahre, beginnend mit der Abnahme bzw. Ablieferung des Fahrzeugs.</p>
<p>(3) Bei gebrauchten Ersatzteilen kann die Gewährleistungsfrist auf 1 Jahr verkürzt werden, sofern dies vor Vertragsschluss gesondert und ausdrücklich vereinbart wurde.</p>
<p>(4) Mängel sind nach Feststellung möglichst zeitnah anzuzeigen. Bei berechtigter Mängelrüge hat die Werkstatt das Recht zur Nacherfüllung innerhalb angemessener Frist.</p>
<p>(5) Gewährleistungsansprüche bestehen nicht für Mängel, die auf unsachgemäße Behandlung, eigenmächtige Änderungen oder Reparaturen durch Dritte ohne Zustimmung der Werkstatt zurückzuführen sind.</p>

<h2>§ 8 Haftung</h2>
<p>(1) Die Werkstatt haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz.</p>
<p>(2) Bei leichter Fahrlässigkeit haftet die Werkstatt nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten). In diesem Fall ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.</p>
<p>(3) Im Übrigen ist die Haftung für leicht fahrlässig verursachte Schäden ausgeschlossen. Dies gilt insbesondere für im Fahrzeug zurückgelassene Gegenstände, die der Werkstatt nicht ausdrücklich zur Verwahrung übergeben wurden. Die Werkstatt empfiehlt, Wertgegenstände nicht im Fahrzeug zu belassen.</p>

<h2>§ 9 Probefahrten und Verwahrung</h2>
<p>(1) Die Werkstatt ist berechtigt, im Rahmen der Auftragsausführung notwendige Probefahrten durchzuführen.</p>
<p>(2) Das Fahrzeug wird während der Reparatur mit der üblichen Sorgfalt verwahrt. Eine besondere Bewachung erfolgt nicht.</p>
<p>(3) Die Werkstatt haftet nicht für Schäden durch höhere Gewalt, Diebstahl oder Vandalismus, es sei denn, die Werkstatt hat ihre Sorgfaltspflichten verletzt.</p>

<h2>§ 10 Terminabsage und Stornierung</h2>
<p>(1) Online gebuchte Termine können bis 24 Stunden vor dem vereinbarten Termin kostenfrei storniert werden.</p>
<p>(2) Bei Stornierungen innerhalb von 24 Stunden oder Nichterscheinen ohne Absage behält sich die Werkstatt das Recht vor, eine Ausfallpauschale in Höhe von 50 € zu berechnen. Dem Kunden bleibt der Nachweis vorbehalten, dass ein geringerer oder kein Schaden entstanden ist.</p>
<p>(3) Bereits begonnene Arbeiten werden nach Aufwand berechnet.</p>

<h2>§ 11 Datenschutz</h2>
<p>(1) Die Werkstatt verarbeitet personenbezogene Daten des Kunden zur Vertragsabwicklung gemäß der Datenschutz-Grundverordnung (DSGVO).</p>
<p>(2) Weitere Informationen zur Datenverarbeitung finden Sie in unserer <a href="/datenschutz">Datenschutzerklärung</a>.</p>

<h2>§ 12 Salvatorische Klausel</h2>
<p>Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.</p>

<h2>§ 13 Anwendbares Recht und Gerichtsstand</h2>
<p>(1) Für alle Rechtsbeziehungen zwischen der Werkstatt und dem Kunden gilt ausschließlich deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht zwingende Bestimmungen des Rechts des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, entzogen werden.</p>
<p>(2) Gerichtsstand für alle Streitigkeiten aus diesem Vertragsverhältnis ist bei Verträgen mit Kaufleuten, juristischen Personen des öffentlichen Rechts oder öffentlich-rechtlichen Sondervermögen der Sitz der Werkstatt.</p>
<p>(3) Für Verbraucher gelten die gesetzlichen Gerichtsstandsregelungen.</p>

<h2>§ 14 Verbraucherstreitbeilegung</h2>
<p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

<h2>Kontakt</h2>
${anschrift(f, false)}
${kontakt(f)}
`.trim();
}
