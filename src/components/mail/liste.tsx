"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { IconFeld, IconKnopf, unsichtbaresFeld } from "@/components/icon-knopf";
import { Archiv, Etikett, Fahne as FahneIcon, Gelesen, Kreuz, Nadel, Papierkorb, Person, Posteingang, Ungelesen, Wiederherstellen } from "@/components/icons";
import { mailOrdnen } from "@/lib/aktionen/mail";
import { KATEGORIE_FARBEN } from "@/lib/mail/inhalt";
import type { Aktion, ListenEintrag } from "@/lib/mail/postfach";
import { ansichtHref, type MailAnsicht, ORDNER_TEXT } from "./ansicht";
import { useSchreiben } from "./schreiben";

export type Kategorie = { id: string; name: string; farbe: string };
export type PersonKurz = { id: string; name: string };

/** Heute nur die Uhrzeit, in dieser Woche der Wochentag, sonst das Datum (wie Outlook). */
function wann(wert: string): string {
  const d = new Date(wert);
  const jetzt = new Date();
  const tag = (x: Date) => x.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  if (tag(d) === tag(jetzt)) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  if (jetzt.getTime() - d.getTime() < 6 * 864e5) return d.toLocaleDateString("de-DE", { weekday: "short", timeZone: "Europe/Berlin" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" });
}

/**
 * Mailliste wie in Outlook: Häkchen für Mehrfachauswahl (am Rechner auch Strg/Shift), Leiste mit Aktionen für
 * alle gewählten, Fahne und Anheften direkt an der Zeile. Am Handy wischt man: nach links archivieren (im
 * Archiv und Papierkorb löschen), nach rechts gelesen/ungelesen.
 */
export function MailListe({
  eintraege,
  ansicht,
  basis,
  kategorien,
  personen,
  firma,
  mobil = false,
}: {
  eintraege: ListenEintrag[];
  ansicht: MailAnsicht;
  basis: string;
  kategorien: Kategorie[];
  personen: PersonKurz[];
  firma: boolean;
  mobil?: boolean;
}) {
  const router = useRouter();
  const oeffnen = useSchreiben();
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [letzter, setLetzter] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();
  const [meldung, setMeldung] = useState("");
  const [weg, setWeg] = useState<Set<string>>(new Set());

  // Neue Liste (anderer Ordner, Suche): Auswahl und ausgeblendete Zeilen zurücksetzen
  const schluessel = eintraege.map((e) => e.schluessel).join(",");
  const vorher = useRef(schluessel);
  useEffect(() => {
    if (vorher.current === schluessel) return;
    vorher.current = schluessel;
    setWeg(new Set());
    setGewaehlt((g) => new Set([...g].filter((s) => eintraege.some((e) => e.schluessel === s))));
  }, [schluessel, eintraege]);

  const sichtbar = eintraege.filter((e) => !weg.has(e.schluessel));
  const kat = new Map(kategorien.map((k) => [k.id, k]));
  const person = new Map(personen.map((p) => [p.id, p.name]));
  const ordnerEcht = ansicht.o;

  function ausfuehren(ziele: string[], a: Aktion, ausblenden = false) {
    if (!ziele.length) return;
    if (ausblenden) setWeg((w) => new Set([...w, ...ziele]));
    setMeldung("");
    starten(async () => {
      const r = await mailOrdnen(ansicht.e ? { mails: ziele } : { gespraeche: ziele }, a, ordnerEcht);
      if (!r.ok) {
        setMeldung(r.meldung);
        setWeg(new Set());
      }
      setGewaehlt(new Set());
      router.refresh();
    });
  }

  const zeileHref = (e: ListenEintrag) => (mobil ? `${basis}/${e.schluessel}${ansicht.e ? "?e=1" : ""}` : ansichtHref(basis, ansicht, { g: e.schluessel }));

  function waehlen(s: string, mitShift: boolean) {
    setGewaehlt((alt) => {
      const neu = new Set(alt);
      if (mitShift && letzter) {
        const a = sichtbar.findIndex((e) => e.schluessel === letzter);
        const b = sichtbar.findIndex((e) => e.schluessel === s);
        for (const e of sichtbar.slice(Math.min(a, b), Math.max(a, b) + 1)) neu.add(e.schluessel);
      } else if (neu.has(s)) neu.delete(s);
      else neu.add(s);
      return neu;
    });
    setLetzter(s);
  }

  const auswahl = [...gewaehlt];
  const imPapierkorb = ordnerEcht === "papierkorb";
  const verschiebbar = ["eingang", "sonstige", "archiv", "gekennzeichnet", "spaeter", "zugewiesen"].includes(ordnerEcht);

  return (
    <div className="flex min-h-0 flex-col">
      {auswahl.length ? (
        <div className="sticky top-0 z-10 flex items-center gap-0.5 border-b border-linie bg-weiss px-2 py-1.5 text-sm">
          <span className="mr-1 whitespace-nowrap px-1 font-semibold">{auswahl.length} gewählt</span>
          <IconKnopf klein text="Als gelesen markieren" onClick={() => ausfuehren(auswahl, { art: "gelesen" })}>
            <Gelesen />
          </IconKnopf>
          <IconKnopf klein text="Als ungelesen markieren" onClick={() => ausfuehren(auswahl, { art: "ungelesen" })}>
            <Ungelesen />
          </IconKnopf>
          <IconKnopf klein text="Kennzeichnen" onClick={() => ausfuehren(auswahl, { art: "kennzeichnen" })}>
            <FahneIcon />
          </IconKnopf>
          {verschiebbar && ordnerEcht !== "archiv" ? (
            <IconKnopf klein text="Archivieren" onClick={() => ausfuehren(auswahl, { art: "verschieben", ordner: "archiv" }, true)}>
              <Archiv />
            </IconKnopf>
          ) : null}
          {ordnerEcht === "archiv" || ordnerEcht === "sonstige" ? (
            <IconKnopf klein text="In Posteingang" onClick={() => ausfuehren(auswahl, { art: "verschieben", ordner: "eingang" }, true)}>
              <Posteingang />
            </IconKnopf>
          ) : null}
          {imPapierkorb ? (
            <IconKnopf klein text="Wiederherstellen" onClick={() => ausfuehren(auswahl, { art: "wiederherstellen" }, true)}>
              <Wiederherstellen />
            </IconKnopf>
          ) : null}
          <IconKnopf
            klein
            text={imPapierkorb ? "Endgültig löschen" : "Löschen"}
            onClick={() => {
              if (imPapierkorb && !window.confirm(`${auswahl.length} endgültig löschen?`)) return;
              ausfuehren(auswahl, { art: "loeschen" }, true);
            }}
          >
            <Papierkorb />
          </IconKnopf>
          {kategorien.length ? (
            <IconFeld klein text="Kategorie" icon={<Etikett />}>
              <select
                aria-label="Kategorie zuordnen"
                className={unsichtbaresFeld}
                defaultValue=""
                onChange={(e) => {
                  const [an, id] = e.target.value.split(":");
                  if (id) ausfuehren(auswahl, { art: "kategorie", id, an: an === "+" });
                  e.target.value = "";
                }}
              >
                <option value="" disabled>Kategorie</option>
                {kategorien.map((k) => (
                  <option key={k.id} value={`+:${k.id}`}>{k.name}</option>
                ))}
                {kategorien.map((k) => (
                  <option key={`-${k.id}`} value={`-:${k.id}`}>ohne {k.name}</option>
                ))}
              </select>
            </IconFeld>
          ) : null}
          {firma ? (
            <IconFeld klein text="Zuweisen" icon={<Person />}>
              <select
                aria-label="Zuweisen"
                className={unsichtbaresFeld}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) ausfuehren(auswahl, { art: "zuweisen", an: e.target.value === "-" ? null : e.target.value });
                  e.target.value = "";
                }}
              >
                <option value="" disabled>Zuweisen</option>
                {personen.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="-">Niemandem</option>
              </select>
            </IconFeld>
          ) : null}
          <span className="ml-auto" />
          <IconKnopf klein text="Auswahl aufheben" lage={{ ausrichtung: "rechts" }} className="text-grau" onClick={() => setGewaehlt(new Set())}>
            <Kreuz />
          </IconKnopf>
        </div>
      ) : null}
      {meldung ? <p role="alert" className="px-4 py-2 text-sm font-semibold text-rot">{meldung}</p> : null}
      <ul className={`min-h-0 flex-1 overflow-y-auto ${laeuft ? "opacity-70" : ""} ${mobil ? "divide-y divide-linie bg-weiss" : "divide-y divide-linie"}`}>
        {sichtbar.map((e) => {
          const aktiv = !mobil && ansicht.g === e.schluessel;
          const neu = e.ungelesen > 0;
          const zeile = (
            <div className={`group relative flex gap-2 py-2.5 pl-2 pr-3 ${aktiv ? "bg-boden" : "bg-weiss hover:bg-papier"}`}>
              <div className="flex w-6 shrink-0 flex-col items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  aria-label="Auswählen"
                  checked={gewaehlt.has(e.schluessel)}
                  onChange={() => undefined}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    waehlen(e.schluessel, ev.shiftKey);
                  }}
                  className={`size-4 accent-tinte ${gewaehlt.size || mobil ? "" : "lg:opacity-0 lg:group-hover:opacity-100"}`}
                />
                {neu ? <span aria-label="ungelesen" className="size-2 rounded-full bg-rot" /> : null}
              </div>
              <button
                type="button"
                className="grid min-w-0 flex-1 gap-0.5 text-left"
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey) return waehlen(e.schluessel, false);
                  if (ev.shiftKey) return waehlen(e.schluessel, true);
                  if (e.entwurf || ordnerEcht === "ausgang") return oeffnen("entwurf", e.mailId);
                  router.push(zeileHref(e), { scroll: false });
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`flex min-w-0 items-center gap-1.5 truncate ${neu ? "font-semibold" : ""}`}>
                    {e.entwurf ? <span className="shrink-0 text-rot">[Entwurf]</span> : null}
                    <span className="truncate">{e.gegenueber}</span>
                    {e.anzahl > 1 ? <span className="zahlen shrink-0 text-xs text-grau">{e.anzahl}</span> : null}
                  </span>
                  <span className="zahlen shrink-0 text-xs text-grau">{wann(e.zuletzt)}</span>
                </span>
                <span className={`truncate text-sm ${neu ? "font-semibold" : ""}`}>{e.betreff}</span>
                <span className="truncate text-sm text-grau">{e.vorschau || " "}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs empty:hidden">
                  {e.anhang ? <span className="text-grau">Anhang</span> : null}
                  {e.kategorien.map((id) => kat.get(id)).filter(Boolean).map((k) => (
                    <span key={k!.id} className="flex items-center gap-1 rounded-sm bg-boden px-1.5 py-0.5">
                      <span className="size-2 rounded-full" style={{ background: KATEGORIE_FARBEN[k!.farbe]?.hex }} />
                      {k!.name}
                    </span>
                  ))}
                  {e.zugewiesen_an ? <span className="rounded-sm bg-boden px-1.5 py-0.5">An {person.get(e.zugewiesen_an) ?? "?"}</span> : null}
                  {e.versand === "geplant" && e.senden_am ? <span className="text-grau">Geplant {wann(e.senden_am)}</span> : null}
                  {e.versand === "fehler" ? <span className="font-semibold text-rot">Nicht gesendet</span> : null}
                  {e.zustellung === "abgewiesen" ? <span className="font-semibold text-rot">Nicht zugestellt</span> : e.zustellung === "zugestellt" ? <span className="text-ok">Zugestellt</span> : e.zustellung === "verzoegert" ? <span className="text-grau">Verzögert</span> : null}
                  {e.erinnern_am && new Date(e.erinnern_am) > new Date() ? <span className="text-grau">Erinnerung {wann(e.erinnern_am)}</span> : null}
                </span>
              </button>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  aria-label={e.gekennzeichnet ? "Kennzeichnung entfernen" : "Kennzeichnen"}
                  title={e.gekennzeichnet ? "Kennzeichnung entfernen" : "Kennzeichnen"}
                  onClick={() => ausfuehren([e.schluessel], { art: e.gekennzeichnet ? "entkennzeichnen" : "kennzeichnen" })}
                  className={`rounded-sm p-1 ${e.gekennzeichnet ? "text-rot" : "text-grau lg:opacity-0 lg:group-hover:opacity-100"}`}
                >
                  <FahneIcon an={e.gekennzeichnet} className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={e.angeheftet ? "Lösen" : "Anheften"}
                  title={e.angeheftet ? "Lösen" : "Anheften"}
                  onClick={() => ausfuehren([e.schluessel], { art: e.angeheftet ? "loesen" : "anheften" })}
                  className={`rounded-sm p-1 ${e.angeheftet ? "text-tinte" : "text-grau lg:opacity-0 lg:group-hover:opacity-100"}`}
                >
                  <Nadel an={e.angeheftet} className="size-4" />
                </button>
              </div>
            </div>
          );
          return (
            <li key={e.schluessel}>
              {mobil ? (
                <Wischen
                  links={imPapierkorb || ordnerEcht === "archiv" || !verschiebbar ? "Löschen" : "Archivieren"}
                  rechts={neu ? "Gelesen" : "Ungelesen"}
                  onLinks={() => ausfuehren([e.schluessel], imPapierkorb || ordnerEcht === "archiv" || !verschiebbar ? { art: "loeschen" } : { art: "verschieben", ordner: "archiv" }, true)}
                  onRechts={() => ausfuehren([e.schluessel], { art: neu ? "gelesen" : "ungelesen" })}
                >
                  {zeile}
                </Wischen>
              ) : (
                zeile
              )}
            </li>
          );
        })}
      </ul>
      {!sichtbar.length ? <p className="px-4 py-10 text-center text-grau">{ansicht.q ? "Nichts gefunden." : `${ORDNER_TEXT[ordnerEcht]} ist leer.`}</p> : null}
    </div>
  );
}

/** Wischgeste am Handy: ab 30 % der Breite löst sie aus, darunter federt die Zeile zurück. Senkrechtes Scrollen hat Vorrang. */
function Wischen({ children, links, rechts, onLinks, onRechts }: { children: React.ReactNode; links: string; rechts: string; onLinks: () => void; onRechts: () => void }) {
  const [dx, setDx] = useState(0);
  const [ziehen, setZiehen] = useState(false);
  const start = useRef<{ x: number; y: number; breite: number; waagerecht: boolean | null } | null>(null);
  const schwelle = (b: number) => Math.max(80, b * 0.3);
  return (
    <div className="relative overflow-hidden">
      <div className={`absolute inset-0 flex items-center px-5 text-sm font-semibold text-weiss ${dx < 0 ? "justify-end bg-rot" : "justify-start bg-tinte"}`} aria-hidden>
        {dx < 0 ? links : dx > 0 ? rechts : ""}
      </div>
      <div
        style={{ transform: `translateX(${dx}px)`, transition: ziehen ? "none" : "transform 180ms ease-out" }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          start.current = { x: t.clientX, y: t.clientY, breite: e.currentTarget.offsetWidth, waagerecht: null };
        }}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const t = e.touches[0];
          const x = t.clientX - s.x;
          const y = t.clientY - s.y;
          if (s.waagerecht === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) s.waagerecht = Math.abs(x) > Math.abs(y);
          if (s.waagerecht) {
            setZiehen(true);
            setDx(x);
          }
        }}
        onTouchEnd={() => {
          const s = start.current;
          start.current = null;
          setZiehen(false);
          if (s?.waagerecht && Math.abs(dx) > schwelle(s.breite)) {
            if (dx < 0) onLinks();
            else onRechts();
          }
          setDx(0);
        }}
        onTouchCancel={() => {
          start.current = null;
          setZiehen(false);
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
