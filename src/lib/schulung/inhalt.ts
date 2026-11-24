/**
 * Schulung ohne Datenbank: Text einer Lektion lesen, Video-Links erkennen, suchen und sortieren.
 * Läuft im Browser (Vorschau neben dem Editor) und auf dem Server (Team-App), deshalb ohne Abhängigkeiten.
 *
 * Der Text ist ein kleines, festes Format statt HTML: Was der Editor mit seinen Knöpfen einfügt, kann hier
 * gelesen werden, und sonst nichts. So kann keine eingefügte Webseite die Team-App verbiegen, und alte
 * Lektionen sehen nach einer Änderung der Gestaltung genauso aus wie neue.
 *
 *   ## Überschrift            ### Zwischenüberschrift
 *   - Punkt                   1. Arbeitsschritt
 *   **fett**                  [Text](https://…)
 *   ![Beschriftung](bild:ordner/datei.jpg)   (eigene Zeile, Bild aus dem Speicher „schulung“)
 */

export type Inline = { art: "text"; text: string } | { art: "fett"; text: string } | { art: "link"; text: string; href: string };

export type Block =
  | { art: "h2" | "h3"; inhalt: Inline[] }
  | { art: "absatz"; zeilen: Inline[][] }
  | { art: "liste"; geordnet: boolean; start: number; punkte: Inline[][] }
  | { art: "bild"; pfad: string; text: string };

// Nur Pfade im eigenen Speicher, ohne „..“ (kein Weg aus dem Ordner heraus)
const BILD = /^!\[([^\]]*)\]\(bild:((?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.[a-z0-9]{2,5})\)$/i;
const GEORDNET = /^(\d{1,3})[.)]\s+(.*)$/;
const PUNKT = /^[-*•]\s+(.*)$/;

/** Fett und Links in einer Zeile. Links nur ins Netz (http/https), nie `javascript:` o. Ä. */
export function inlineLesen(zeile: string): Inline[] {
  const teile: Inline[] = [];
  const muster = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let rest = 0;
  for (const m of zeile.matchAll(muster)) {
    if (m.index > rest) teile.push({ art: "text", text: zeile.slice(rest, m.index) });
    if (m[1] !== undefined) teile.push({ art: "fett", text: m[1] });
    else teile.push({ art: "link", text: m[2], href: m[3] });
    rest = m.index + m[0].length;
  }
  if (rest < zeile.length) teile.push({ art: "text", text: zeile.slice(rest) });
  return teile;
}

/** Text einer Lektion in Blöcke zerlegen. Leere Zeilen trennen Absätze und Listen. */
export function inhaltLesen(text: string): Block[] {
  type Liste = Extract<Block, { art: "liste" }>;
  const bloecke: Block[] = [];
  // Der Block, an den die nächste Zeile anschließt (Absatz oder Liste); eine leere Zeile beendet ihn.
  let offen: { art: "absatz"; zeilen: Inline[][] } | Liste | null = null;
  for (const roh of text.replace(/\r\n?/g, "\n").split("\n")) {
    const zeile = roh.trim();
    if (!zeile) {
      offen = null;
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(zeile);
    if (h) {
      offen = null;
      bloecke.push({ art: h[1].length === 2 ? "h2" : "h3", inhalt: inlineLesen(h[2]) });
      continue;
    }
    const bild = BILD.exec(zeile);
    if (bild) {
      offen = null;
      bloecke.push({ art: "bild", pfad: bild[2], text: bild[1].trim() });
      continue;
    }
    const g = GEORDNET.exec(zeile);
    const p = g ? null : PUNKT.exec(zeile);
    if (g || p) {
      const geordnet = Boolean(g);
      if (offen?.art !== "liste" || offen.geordnet !== geordnet) {
        offen = { art: "liste", geordnet, start: g ? Number(g[1]) : 1, punkte: [] };
        bloecke.push(offen);
      }
      offen.punkte.push(inlineLesen(g ? g[2] : p![1]));
      continue;
    }
    // Eingerückte Fortsetzung eines Listenpunkts gehört noch zum Punkt
    if (offen?.art === "liste" && /^\s{2,}/.test(roh)) {
      offen.punkte[offen.punkte.length - 1].push({ art: "text", text: ` ${zeile}` });
      continue;
    }
    if (offen?.art !== "absatz") {
      offen = { art: "absatz", zeilen: [] };
      bloecke.push(offen);
    }
    offen.zeilen.push(inlineLesen(zeile));
  }
  return bloecke;
}

/** Alle Bilder eines Textes (für signierte Adressen und zum Aufräumen beim Löschen). */
export function bilderIn(text: string): string[] {
  return [...new Set(inhaltLesen(text).flatMap((b) => (b.art === "bild" ? [b.pfad] : [])))];
}

/** Text ohne Auszeichnung, für die Suche. */
export function klartext(text: string): string {
  return inhaltLesen(text)
    .flatMap((b): string[] => {
      if (b.art === "bild") return [b.text];
      const teile = b.art === "absatz" ? b.zeilen.flat() : b.art === "liste" ? b.punkte.flat() : b.inhalt;
      return teile.map((x) => x.text);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export type Video = { anbieter: "youtube" | "vimeo"; einbettung: string; link: string };

/**
 * YouTube- oder Vimeo-Link in eine Adresse zum Einbetten. YouTube über youtube-nocookie.com (setzt erst beim
 * Abspielen Cookies), Vimeo mit dem Zugangsschlüssel nicht gelisteter Videos (`vimeo.com/123/abcdef`).
 * Andere Adressen gibt es nicht: null.
 */
export function videoErkennen(eingabe: string | null | undefined): Video | null {
  if (!eingabe) return null;
  let url: URL;
  try {
    url = new URL(eingabe.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const id11 = (s: string | null | undefined) => (s && /^[\w-]{11}$/.test(s) ? s : null);

  if (["youtube.com", "youtube-nocookie.com", "youtu.be", "music.youtube.com"].includes(host)) {
    const teile = url.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be"
        ? id11(teile[0])
        : teile[0] === "watch"
          ? id11(url.searchParams.get("v"))
          : ["embed", "shorts", "live", "v"].includes(teile[0])
            ? id11(teile[1])
            : null;
    if (!id) return null;
    const start = sekunden(url.searchParams.get("t") ?? url.searchParams.get("start"));
    const parameter = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
    if (start) parameter.set("start", String(start));
    return { anbieter: "youtube", einbettung: `https://www.youtube-nocookie.com/embed/${id}?${parameter}`, link: `https://www.youtube.com/watch?v=${id}` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const teile = url.pathname.split("/").filter(Boolean);
    const i = teile.findIndex((t) => /^\d{5,}$/.test(t));
    if (i < 0) return null;
    const id = teile[i];
    const schluessel = url.searchParams.get("h") ?? (teile[i + 1] && /^[0-9a-f]{6,}$/i.test(teile[i + 1]) ? teile[i + 1] : null);
    const parameter = new URLSearchParams({ dnt: "1", playsinline: "1" });
    if (schluessel) parameter.set("h", schluessel);
    return { anbieter: "vimeo", einbettung: `https://player.vimeo.com/video/${id}?${parameter}`, link: `https://vimeo.com/${id}${schluessel ? `/${schluessel}` : ""}` };
  }
  return null;
}

/** „90“, „1m30s“, „1h2m“ → Sekunden. */
function sekunden(wert: string | null): number | null {
  if (!wert) return null;
  if (/^\d+$/.test(wert)) return Number(wert) || null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(wert);
  if (!m || !m[0]) return null;
  return (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) || null;
}

// ---------------------------------------------------------------------------
// Suchen und Sortieren
// ---------------------------------------------------------------------------

export type Durchsuchbar = { titel: string; kurz: string; inhalt: string; schlagwoerter: string[]; werkzeug: string };

/** Klein, ohne Akzente, ß als ss: „Ölwechsel“ findet „oelwechsel“ nicht, aber „olwechsel“ und „Öl“. */
export function normal(s: string): string {
  return s
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Treffer für die Suche in der Team-App: jedes Wort muss vorkommen (in Titel, Kurztext, Schlagwörtern, Werkzeug
 * oder Text). Titel und Schlagwörter zählen mehr, damit „Reifen“ die Reifen-Lektion vor einer nennt, die Reifen
 * nur nebenbei erwähnt. 0 = kein Treffer.
 */
export function suchwert(l: Durchsuchbar, frage: string): number {
  const woerter = normal(frage).split(/\s+/).filter(Boolean);
  if (!woerter.length) return 0;
  const titel = normal(l.titel);
  const schlag = normal(l.schlagwoerter.join(" "));
  const rest = normal(`${l.kurz} ${l.werkzeug} ${klartext(l.inhalt)}`);
  let wert = 0;
  for (const w of woerter) {
    const hier = (titel.includes(w) ? 5 : 0) + (schlag.includes(w) ? 3 : 0) + (rest.includes(w) ? 1 : 0);
    if (!hier) return 0;
    wert += hier;
  }
  return wert;
}

export function suchen<T extends Durchsuchbar>(liste: T[], frage: string): T[] {
  return liste
    .map((l, i) => ({ l, i, w: suchwert(l, frage) }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.l);
}

/** Schlagwörter aus einem Eingabefeld: durch Komma getrennt, ohne doppelte, höchstens 20. */
export function schlagwoerterLesen(eingabe: string): string[] {
  const gesehen = new Set<string>();
  const aus: string[] = [];
  for (const roh of eingabe.split(/[,;\n]/)) {
    const w = roh.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!w || gesehen.has(normal(w))) continue;
    gesehen.add(normal(w));
    aus.push(w);
  }
  return aus.slice(0, 20);
}

/** Eintrag an eine andere Stelle setzen (Ziehen und Ablegen, Pfeile: eine Stelle weiter). Ungültig: unverändert. */
export function umsetzen<T>(liste: T[], von: number, nach: number): T[] {
  if (von === nach || von < 0 || von >= liste.length || nach < 0 || nach >= liste.length) return liste;
  const neu = [...liste];
  const [x] = neu.splice(von, 1);
  neu.splice(nach, 0, x);
  return neu;
}

/** „3 Min.“, „1 Std. 15 Min.“ */
export function dauerText(minuten: number | null | undefined): string {
  if (!minuten || minuten <= 0) return "";
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return [h ? `${h} Std.` : "", m ? `${m} Min.` : ""].filter(Boolean).join(" ");
}
