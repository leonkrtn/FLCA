import "server-only";
import { einstellungen } from "./einstellungen";

/**
 * Rechtstexte (Datenschutz, AGB). Bevorzugt von einem Rechtstexte-Dienst wie der IT-Recht Kanzlei, dessen
 * Adresse in den Einstellungen steht. Der Text wird SERVERSEITIG geholt und bereinigt; das Skript des
 * Anbieters wird nicht eingebunden, weil es bei jedem Besuch die IP-Adresse an den Anbieter schickte.
 * Ist der Dienst nicht erreichbar oder nicht eingerichtet, gilt der im Admin hinterlegte Text.
 *
 * Die Bereinigung (Positivliste von Tags und Adressen) stammt aus dem Projekt waprofis.
 */

export type Rechtstext = { html: string; quelle: "dienst" | "hinterlegt" | "fehlt" };

const ERLAUBTE_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sup', 'sub', 'code', 'pre',
  'blockquote', 'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
]);

/** Tags, deren INHALT ebenfalls verschwinden soll — nicht nur die Klammern. */
const INHALT_ENTFERNEN = [
  'script', 'style', 'iframe', 'object', 'noscript', 'template', 'svg', 'math',
  // Liefert die Kanzlei ein vollstaendiges Dokument statt eines Ausschnitts,
  // stuende der Titel sonst als loser Satz ueber dem Rechtstext.
  'head', 'title',
];

/**
 * Adressen, die ein `href` tragen darf.
 *
 * EINE POSITIVLISTE UND KEINE SPERRE FUER `javascript:`. Der Unterschied ist
 * der ganze Punkt: Eine Sperre muss jede Schreibweise kennen, in der sich
 * `javascript:` verstecken laesst — `&#106;avascript:`, `java\tscript:`,
 * `JaVaScRiPt:`, und was sich sonst noch jemand ausdenkt, weil der Browser
 * Entitaeten und Steuerzeichen in einem Attributwert vor der Auswertung
 * aufloest. Eine Positivliste muss davon nichts wissen: Was nicht mit
 * `https://`, `http://`, `mailto:`, `tel:`, `#` oder einem einzelnen `/`
 * beginnt, faellt heraus.
 *
 * `//fremde.tld` faellt ebenfalls heraus — das ist eine Adresse mit fremdem
 * Host, nur ohne Schema davor.
 */
function adresseErlaubt(wert: string): boolean {
  const w = wert.trim();
  if (w.startsWith('//')) return false;
  return (
    w.startsWith('https://')
    || w.startsWith('http://')
    || w.startsWith('mailto:')
    || w.startsWith('tel:')
    || w.startsWith('#')
    || w.startsWith('/')
  );
}

function maskieren(wert: string): string {
  return wert
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Baut die erlaubten Attribute eines Tags neu auf.
 *
 * NEU AUFBAUEN UND NICHT DURCHREICHEN: Ein durchgereichter Attributwert kann
 * Anfuehrungszeichen enthalten und damit aus seinem eigenen Attribut
 * ausbrechen. Was hier herauskommt, ist ausschliesslich selbst geschrieben
 * und maskiert.
 */
function attributeAufbauen(tag: string, attributtext: string): string {
  const teile: string[] = [];
  const muster = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

  for (const treffer of attributtext.matchAll(muster)) {
    const name = treffer[1].toLowerCase();
    const wert = treffer[2] ?? treffer[3] ?? treffer[4] ?? '';

    if (tag === 'a' && name === 'href' && adresseErlaubt(wert)) {
      teile.push(`href="${maskieren(wert.trim())}"`);
      /*
       * Ein Verweis aus einem Rechtstext fuehrt fast immer nach draussen
       * (PayPal, Trusted Shops, die Schlichtungsstelle). `rel` gehoert
       * deshalb dazu: Ohne `noopener` bekaeme die geoeffnete Seite ueber
       * `window.opener` Zugriff auf diese hier.
       */
      if (wert.trim().startsWith('http')) teile.push('rel="noopener noreferrer"');
      continue;
    }

    // Tabellen aus einem Rechtstext (Lieferfristen, Cookie-Uebersichten)
    // brauchen die Verbundangaben, sonst verrutschen die Spalten.
    if ((tag === 'td' || tag === 'th' || tag === 'col' || tag === 'colgroup')
      && (name === 'colspan' || name === 'rowspan' || name === 'span')
      && /^[0-9]{1,3}$/.test(wert)) {
      teile.push(`${name}="${wert}"`);
    }
  }

  return teile.length > 0 ? ` ${teile.join(' ')}` : '';
}

/**
 * Bereinigt das gelieferte HTML — mit einer Positivliste.
 *
 * HIER STAND EINE NEGATIVLISTE: eine Reihe von `replace`-Aufrufen, die
 * `<script>…</script>`, `<iframe>`, `on…=`-Attribute und `javascript:`-Adressen
 * herausschnitten. Sie war auf wohlgeformte Paare gebaut und liess deshalb
 * durch, was nicht danach aussah:
 *
 *     <script>alert(1)              (ohne Ende-Tag — kein Paar, kein Treffer)
 *     <script>alert(1)</script >    (Leerzeichen im Ende-Tag)
 *     <object data="…">             (stand nicht auf der Liste)
 *     <form action="https://…">     (ebenfalls nicht)
 *     <base href="https://…">       (ebenfalls nicht)
 *     <a href=javascript:alert(1)>  (die Sperre verlangte Anfuehrungszeichen)
 *
 * Die CSP faengt davon `object`, `form` und `base` ab. Die beiden anderen
 * nicht: `script-src` traegt `'unsafe-inline'`, und genau das deckt ein
 * Inline-Skript und eine `javascript:`-Adresse. Auf einer Pflichtseite, die
 * fremdes HTML einsetzt, war das die letzte Grenze — und sie hielt nicht.
 *
 * EINE NEGATIVLISTE KANN DIESES PROBLEM NICHT LOESEN. Sie muss jede Form
 * kennen, in der etwas Gefaehrliches auftreten kann; die Positivliste muss
 * nur wissen, was harmlos ist. Was nicht auf ihr steht, verschwindet — auch
 * das, woran beim Schreiben niemand gedacht hat.
 *
 * DIE BAUART IST DIESELBE WIE BEI `sanitizeBeschreibung` in
 * lib/utils/rich-text.ts, nur mit einer laengeren Tagliste und mit
 * Attributen: Ein Rechtstext braucht Verweise und Tabellen, eine
 * Produktbeschreibung nicht.
 *
 * KEIN VOLLWERTIGER HTML-PARSER, und das ist hier vertretbar: Was nicht als
 * Tag erkannt wird, bleibt als Text stehen und wird vom Browser als Text
 * gelesen — es entsteht kein Tag, den diese Funktion nicht gesehen hat.
 */
function sanitizeHtml(html: string): string {
  let bereinigt = html;

  // Erst die Elemente, deren Inhalt mitgehen soll. Bleibt ein Ende-Tag aus,
  // faellt wenigstens das Start-Tag unten heraus — der Inhalt steht dann als
  // sichtbarer Text da, was haesslich, aber harmlos ist.
  for (const tag of INHALT_ENTFERNEN) {
    bereinigt = bereinigt.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/\\s*${tag}\\s*>`, 'gi'),
      '',
    );
  }

  // Kommentare, Doctype und andere `<!…>`-Gebilde. Ein nicht abgeschlossener
  // Kommentar verschluckte sonst den Rest der Seite.
  bereinigt = bereinigt.replace(/<!--[\s\S]*?-->/g, '').replace(/<![^>]*>/g, '');

  return bereinigt
    .replace(
      /<(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g,
      (_treffer, schraegstrich: string | undefined, name: string, rest: string) => {
        const tag = name.toLowerCase();
        if (!ERLAUBTE_TAGS.has(tag)) return '';
        if (schraegstrich) return `</${tag}>`;
        return `<${tag}${attributeAufbauen(tag, rest)}>`;
      },
    )
    .trim();
}


function textAlsHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.length < 80 && !/[.:;,]$/.test(b) && !b.includes("\n") ? `<h2>${esc(b)}</h2>` : `<p>${esc(b).replace(/\n/g, "<br />")}</p>`))
    .join("\n");
}

export async function rechtstext(art: "datenschutz" | "agb"): Promise<Rechtstext> {
  const { rechtstexte } = await einstellungen();
  const url = art === "datenschutz" ? rechtstexte.datenschutzUrl : rechtstexte.agbUrl;
  const hinterlegt = art === "datenschutz" ? rechtstexte.datenschutzText : rechtstexte.agbText;
  if (url.startsWith("https://")) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000), headers: { accept: "text/html" } });
      if (res.ok) {
        const html = sanitizeHtml(await res.text());
        if (html.replace(/<[^>]+>/g, "").trim().length > 500) return { html, quelle: "dienst" };
      }
    } catch {
      // Zeitüberschreitung oder Netzwerkfehler: hinterlegter Text
    }
  }
  if (hinterlegt.trim()) return { html: textAlsHtml(hinterlegt), quelle: "hinterlegt" };
  return { html: "", quelle: "fehlt" };
}
