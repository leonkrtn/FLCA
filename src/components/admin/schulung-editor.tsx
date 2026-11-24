"use client";

import { useRef, useState } from "react";
import { uploadAdresse } from "@/app/admin/upload-actions";
import { LektionInhalt } from "@/components/schulung/lektion";
import { videoErkennen } from "@/lib/schulung/inhalt";

export type EditorWerte = {
  titel: string;
  kurz: string;
  inhalt: string;
  video_url: string;
  dauer_min: string;
  schlagwoerter: string;
  werkzeug: string;
  sicherheit: string;
};

/**
 * Editor einer Lektion mit Vorschau im iPhone-Rahmen. Die Knöpfe fügen das feste Textformat ein
 * (src/lib/schulung/inhalt.ts), die Vorschau liest es mit derselben Darstellung wie die Team-App.
 * Steht in einem <Formular>: Alle Felder tragen ihren Namen, gespeichert wird mit dem Knopf der Seite.
 */
export function SchulungEditor({ start, bilder: bilderStart, kategorieName, vorne, hinten }: { start: EditorWerte; bilder: Record<string, string>; kategorieName?: string; vorne?: React.ReactNode; hinten?: React.ReactNode }) {
  const [w, setW] = useState(start);
  const [bilder, setBilder] = useState(bilderStart);
  const [status, setStatus] = useState("");
  const feld = useRef<HTMLTextAreaElement>(null);
  const datei = useRef<HTMLInputElement>(null);
  const setze = (name: keyof EditorWerte) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setW((v) => ({ ...v, [name]: e.target.value }));
  const video = w.video_url.trim() ? videoErkennen(w.video_url) : null;

  /** Text ändern und danach die Auswahl setzen (nach dem nächsten Zeichnen, sonst springt der Cursor ans Ende). */
  function ersetzen(neu: string, von: number, bis: number) {
    setW((v) => ({ ...v, inhalt: neu }));
    requestAnimationFrame(() => {
      const t = feld.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(von, bis);
    });
  }

  /** Ganze Zeilen der Auswahl mit einem Anfang versehen (Überschrift, Schritt, Punkt). Nochmal drücken nimmt ihn weg. */
  function zeilen(art: "h2" | "h3" | "schritt" | "punkt") {
    const t = feld.current;
    if (!t) return;
    const text = w.inhalt;
    const anfang = text.lastIndexOf("\n", t.selectionStart - 1) + 1;
    const endeRoh = text.indexOf("\n", t.selectionEnd);
    const ende = endeRoh < 0 ? text.length : endeRoh;
    const teil = text.slice(anfang, ende).split("\n");
    const muster = { h2: /^##\s+/, h3: /^###\s+/, schritt: /^\d+[.)]\s+/, punkt: /^[-*•]\s+/ }[art];
    const alleSchon = teil.every((z) => !z.trim() || muster.test(z));
    let n = 0;
    const neu = teil
      .map((z) => {
        const ohne = z.replace(/^(#{2,3}\s+|\d+[.)]\s+|[-*•]\s+)/, "");
        if (alleSchon) return ohne;
        if (!z.trim() && teil.length > 1) return z;
        n += 1;
        return { h2: "## ", h3: "### ", schritt: `${n}. `, punkt: "- " }[art] + ohne;
      })
      .join("\n");
    ersetzen(text.slice(0, anfang) + neu + text.slice(ende), anfang + neu.length, anfang + neu.length);
  }

  function fett() {
    const t = feld.current;
    if (!t) return;
    const { selectionStart: a, selectionEnd: b } = t;
    const auswahl = w.inhalt.slice(a, b) || "fett";
    const neu = `${w.inhalt.slice(0, a)}**${auswahl}**${w.inhalt.slice(b)}`;
    ersetzen(neu, a + 2, a + 2 + auswahl.length);
  }

  function link() {
    const t = feld.current;
    if (!t) return;
    const adresse = window.prompt("Adresse des Links (https://…)");
    if (!adresse) return;
    if (!/^https?:\/\/\S+$/.test(adresse.trim())) return setStatus("Links bitte mit https:// beginnen.");
    const { selectionStart: a, selectionEnd: b } = t;
    const auswahl = w.inhalt.slice(a, b) || "Linktext";
    const einfuegen = `[${auswahl}](${adresse.trim()})`;
    ersetzen(w.inhalt.slice(0, a) + einfuegen + w.inhalt.slice(b), a + 1, a + 1 + auswahl.length);
  }

  /** Bild hochladen (direkt in den Speicher, wie die Fotos am Auftrag) und als eigene Zeile an der Cursorstelle einfügen. */
  async function bildHochladen(f: File | undefined) {
    if (!f) return;
    setStatus("Bild wird hochgeladen …");
    const a = await uploadAdresse("schulung", "lektionen", f.type || "image/jpeg");
    if (!a.ok) return setStatus(a.meldung);
    const body = new FormData();
    body.append("cacheControl", "31536000");
    body.append("", f);
    const res = await fetch(a.url, { method: "PUT", body }).catch(() => null);
    if (!res?.ok) return setStatus("Upload fehlgeschlagen. Bitte noch einmal versuchen.");
    setBilder((v) => ({ ...v, [a.pfad]: URL.createObjectURL(f) }));
    // Aus dem Feld selbst lesen: Während des Uploads kann weitergeschrieben worden sein
    const t = feld.current;
    const aktuell = t?.value ?? "";
    const pos = t ? t.selectionEnd : aktuell.length;
    const vor = aktuell.slice(0, pos);
    const zeile = `${vor && !vor.endsWith("\n") ? "\n" : ""}![Beschriftung](bild:${a.pfad})\n`;
    const neu = vor + zeile + aktuell.slice(pos);
    // „Beschriftung“ markieren, damit man gleich drüberschreiben kann
    const s = vor.length + zeile.indexOf("Beschriftung");
    ersetzen(neu, s, s + "Beschriftung".length);
    setStatus("Bild eingefügt. Speichern nicht vergessen.");
  }

  /** Enter in einer Liste setzt sie fort; Enter in einem leeren Punkt beendet sie. */
  function taste(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const t = e.currentTarget;
    if (t.selectionStart !== t.selectionEnd) return;
    const pos = t.selectionStart;
    const anfang = w.inhalt.lastIndexOf("\n", pos - 1) + 1;
    const zeile = w.inhalt.slice(anfang, pos);
    const m = /^(\d+)[.)]\s+(.*)$/.exec(zeile) ?? null;
    const p = m ? null : /^([-*•])\s+(.*)$/.exec(zeile);
    if (!m && !p) return;
    e.preventDefault();
    if (!(m ?? p)![2].trim()) {
      // leerer Punkt: Liste beenden
      ersetzen(w.inhalt.slice(0, anfang) + w.inhalt.slice(pos), anfang, anfang);
      return;
    }
    const weiter = m ? `\n${Number(m[1]) + 1}. ` : `\n${p![1]} `;
    ersetzen(w.inhalt.slice(0, pos) + weiter + w.inhalt.slice(pos), pos + weiter.length, pos + weiter.length);
  }

  const knopf = "knopf knopf-rahmen knopf-klein";
  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-6">
        {vorne}
        <section className="grid gap-4 bg-weiss p-4 md:p-6">
          <h2 className="text-lg font-semibold">Lektion</h2>
          <label className="block">
            <span className="label">Titel</span>
            <input name="titel" value={w.titel} onChange={setze("titel")} required maxLength={120} className="feld" placeholder="z. B. Räder wechseln" />
          </label>
          <label className="block">
            <span className="label">Kurzbeschreibung</span>
            <textarea name="kurz" value={w.kurz} onChange={setze("kurz")} rows={2} maxLength={300} className="feld" placeholder="Ein bis zwei Sätze: worum es geht und für wen" />
          </label>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="block">
              <span className="label">Video (Link zu YouTube oder Vimeo)</span>
              <input name="video_url" value={w.video_url} onChange={setze("video_url")} inputMode="url" className="feld" placeholder="https://youtu.be/… oder https://vimeo.com/…" />
              <span className={`mt-1 block text-sm ${w.video_url.trim() && !video ? "text-rot" : "text-grau"}`}>
                {!w.video_url.trim()
                  ? "Optional. Nicht gelistete Videos gehen auch."
                  : video
                    ? `Erkannt: ${video.anbieter === "youtube" ? "YouTube" : "Vimeo"}`
                    : "Dieser Link wird nicht erkannt."}
              </span>
            </label>
            <label className="block">
              <span className="label">Dauer (Min.)</span>
              <input name="dauer_min" value={w.dauer_min} onChange={setze("dauer_min")} inputMode="numeric" className="feld text-right tabular-nums" placeholder="z. B. 5" />
            </label>
          </div>
        </section>

        <section className="grid gap-3 bg-weiss p-4 md:p-6">
          <h2 className="text-lg font-semibold">Text</h2>
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Text gestalten">
            <button type="button" className={knopf} onClick={() => zeilen("h2")}>
              Überschrift
            </button>
            <button type="button" className={knopf} onClick={() => zeilen("h3")}>
              Zwischentitel
            </button>
            <button type="button" className={knopf} onClick={() => zeilen("schritt")}>
              1. Schritte
            </button>
            <button type="button" className={knopf} onClick={() => zeilen("punkt")}>
              Aufzählung
            </button>
            <button type="button" className={`${knopf} font-bold`} onClick={fett}>
              Fett
            </button>
            <button type="button" className={knopf} onClick={link}>
              Link
            </button>
            <button type="button" className={knopf} onClick={() => datei.current?.click()}>
              Bild
            </button>
            <input ref={datei} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" tabIndex={-1} onChange={(e) => {
                bildHochladen(e.target.files?.[0]);
                // Dasselbe Bild noch einmal wählen soll wieder auslösen
                e.target.value = "";
              }}
            />
          </div>
          <textarea
            ref={feld}
            name="inhalt"
            value={w.inhalt}
            onChange={setze("inhalt")}
            onKeyDown={taste}
            rows={18}
            className="feld min-h-80 leading-relaxed"
            placeholder={"## Vorbereitung\nFahrzeug auf die Bühne fahren.\n\n1. Radmuttern lösen\n2. Fahrzeug anheben"}
          />
          <p className="text-sm text-grau">
            Zeile markieren und Knopf drücken. Bei „Schritte“ und „Aufzählung“ setzt Enter die Liste fort, ein leerer Punkt beendet sie. {status ? <span className="font-semibold text-tinte">{status}</span> : null}
          </p>
        </section>

        <section className="grid gap-4 bg-weiss p-4 md:p-6">
          <h2 className="text-lg font-semibold">Angaben</h2>
          <label className="block">
            <span className="label">Sicherheitshinweis</span>
            <textarea name="sicherheit" value={w.sicherheit} onChange={setze("sicherheit")} rows={2} className="feld" placeholder="z. B. Fahrzeug nur auf der Bühne mit eingerasteten Sicherungen anheben." />
            <span className="mt-1 block text-sm text-grau">Steht hervorgehoben über dem Text. Leer lassen, wenn es keinen gibt.</span>
          </label>
          <label className="block">
            <span className="label">Werkzeug und Material</span>
            <textarea name="werkzeug" value={w.werkzeug} onChange={setze("werkzeug")} rows={3} className="feld" placeholder={"- Drehmomentschlüssel\n- Radkreuz"} />
            <span className="mt-1 block text-sm text-grau">Eine Zeile je Teil, mit „- “ davor wird es eine Liste.</span>
          </label>
          <label className="block">
            <span className="label">Schlagwörter</span>
            <input name="schlagwoerter" value={w.schlagwoerter} onChange={setze("schlagwoerter")} className="feld" placeholder="Reifen, RDKS, Felge" />
            <span className="mt-1 block text-sm text-grau">Mit Komma getrennt. Helfen der Suche in der Team-App.</span>
          </label>
        </section>
        {hinten}
      </div>

      {/* Vorschau: so breit wie ein iPhone, beim Scrollen der Seite bleibt sie stehen */}
      <aside className="xl:sticky xl:top-6" aria-label="Vorschau in der Team-App">
        <p className="label">Vorschau in der Team-App</p>
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2.25rem] border-[10px] border-graphit bg-weiss shadow-xl">
          <div className="border-b border-linie bg-weiss px-4 pb-3 pt-6">
            <p className="text-sm text-grau">← Schulung</p>
            <p className="schmal truncate text-2xl leading-tight">{w.titel || "Ohne Titel"}</p>
            <p className="h-5 truncate text-sm text-grau">{kategorieName}</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4 text-[15px]">
            <LektionInhalt
              l={{ ...w, video_url: w.video_url.trim() || null, dauer_min: Number(w.dauer_min) || null, schlagwoerter: [] }}
              bilder={bilder}
              ohneTitel
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
