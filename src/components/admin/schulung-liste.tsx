"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { Marke } from "@/components/admin/ui";
import { kategorieLoeschen, kategorieSpeichern, lektionVeroeffentlichen, reihenfolgeSpeichern } from "@/lib/aktionen/schulung";
import { dauerText, umsetzen } from "@/lib/schulung/inhalt";

export type ListenLektion = { id: string; titel: string; veroeffentlicht: boolean; dauer_min: number | null; video: boolean; leistungen: number };
export type ListenKategorie = { id: string; name: string; lektionen: ListenLektion[]; archiviert: number };

type Ziehen = { art: "kategorie"; von: number } | { art: "lektion"; kategorie: number; von: number } | null;

/**
 * Kategorien mit ihren Lektionen, sortierbar mit Ziehen (am PC) oder den Pfeilen (überall, auch am Handy, wo
 * Ziehen im Browser nicht geht). Die neue Reihenfolge steht sofort da und wird im Hintergrund gespeichert;
 * schlägt das fehl, steht sie wieder wie vorher.
 */
export function SchulungListe({ start }: { start: ListenKategorie[] }) {
  const [kategorien, setKategorien] = useState(start);
  const [ziehen, setZiehen] = useState<Ziehen>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");
  const [, starten] = useTransition();

  function speichern(neu: ListenKategorie[], art: "kategorien" | "lektionen", ids: string[]) {
    const vorher = kategorien;
    setKategorien(neu);
    setFehler("");
    starten(async () => {
      const e = await reihenfolgeSpeichern(art, ids);
      if (e.status === "fehler") {
        setKategorien(vorher);
        setFehler(e.meldung ?? "Die Reihenfolge konnte nicht gespeichert werden.");
      }
    });
  }

  function kategorieNach(von: number, nach: number) {
    const neu = umsetzen(kategorien, von, nach);
    if (neu !== kategorien) speichern(neu, "kategorien", neu.map((k) => k.id));
  }

  function lektionNach(k: number, von: number, nach: number) {
    const lektionen = umsetzen(kategorien[k].lektionen, von, nach);
    if (lektionen === kategorien[k].lektionen) return;
    const neu = kategorien.map((x, i) => (i === k ? { ...x, lektionen } : x));
    speichern(neu, "lektionen", lektionen.map((l) => l.id));
  }

  function loslassen() {
    setZiehen(null);
    setUeber(null);
  }

  const pfeil = "grid size-8 place-items-center rounded-sm text-grau hover:bg-boden hover:text-tinte disabled:opacity-30 disabled:hover:bg-transparent";
  const griff = "hidden cursor-grab select-none px-1 text-grau active:cursor-grabbing md:block";

  return (
    <div className="grid gap-6">
      {fehler ? <p className="text-sm font-semibold text-rot">{fehler}</p> : null}
      {kategorien.map((k, ki) => (
        <section
          key={k.id}
          className={`bg-weiss ${ueber === k.id && ziehen?.art === "kategorie" ? "outline-2 outline-tinte" : ""}`}
          onDragOver={(e) => {
            if (ziehen?.art !== "kategorie") return;
            e.preventDefault();
            setUeber(k.id);
          }}
          onDrop={(e) => {
            if (ziehen?.art !== "kategorie") return;
            e.preventDefault();
            kategorieNach(ziehen.von, ki);
            loslassen();
          }}
        >
          <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-linie px-2 py-1 md:px-4">
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setZiehen({ art: "kategorie", von: ki });
              }}
              onDragEnd={loslassen}
              className={griff}
              title="Ziehen, um die Kategorie zu verschieben"
              aria-hidden
            >
              ⠿
            </span>
            <h2 className="min-w-0 flex-1 truncate font-semibold">
              {k.name} <span className="font-normal tabular-nums text-grau">{k.lektionen.length}</span>
            </h2>
            <button type="button" className={pfeil} disabled={ki === 0} onClick={() => kategorieNach(ki, ki - 1)} aria-label={`${k.name} nach oben`}>
              ↑
            </button>
            <button type="button" className={pfeil} disabled={ki === kategorien.length - 1} onClick={() => kategorieNach(ki, ki + 1)} aria-label={`${k.name} nach unten`}>
              ↓
            </button>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-sm px-2 py-1 text-sm text-grau hover:bg-boden hover:text-tinte">Bearbeiten</summary>
              <div className="absolute right-0 z-10 mt-1 grid w-72 gap-3 rounded-lg bg-weiss p-4 shadow-xl ring-1 ring-linie">
                <Formular aktion={kategorieSpeichern.bind(null, k.id)} className="grid gap-2">
                  <label className="block">
                    <span className="label">Name</span>
                    <input name="name" defaultValue={k.name} required maxLength={60} className="feld" />
                  </label>
                  <Senden klein vorab="Umbenannt">
                    Umbenennen
                  </Senden>
                </Formular>
                {k.lektionen.length || k.archiviert ? (
                  <p className="text-sm text-grau">Löschen geht erst, wenn keine Lektion mehr darin steht{k.archiviert ? `, auch nicht im Archiv (${k.archiviert})` : ""}.</p>
                ) : (
                  <Formular aktion={kategorieLoeschen.bind(null, k.id)} bestaetigen={`Kategorie „${k.name}“ löschen?`}>
                    <Senden art="rahmen" klein vorab="Gelöscht">
                      Kategorie löschen
                    </Senden>
                  </Formular>
                )}
              </div>
            </details>
          </div>

          {k.lektionen.length ? (
            <ul className="divide-y divide-linie">
              {k.lektionen.map((l, li) => (
                <li
                  key={l.id}
                  className={`flex min-h-14 items-center gap-2 px-2 py-2 md:px-4 ${ziehen?.art === "lektion" && ueber === l.id ? "bg-boden" : ""}`}
                  onDragOver={(e) => {
                    if (ziehen?.art !== "lektion" || ziehen.kategorie !== ki) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setUeber(l.id);
                  }}
                  onDrop={(e) => {
                    if (ziehen?.art !== "lektion" || ziehen.kategorie !== ki) return;
                    e.preventDefault();
                    e.stopPropagation();
                    lektionNach(ki, ziehen.von, li);
                    loslassen();
                  }}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.effectAllowed = "move";
                      setZiehen({ art: "lektion", kategorie: ki, von: li });
                    }}
                    onDragEnd={loslassen}
                    className={griff}
                    title="Ziehen, um die Lektion zu verschieben"
                    aria-hidden
                  >
                    ⠿
                  </span>
                  <Link href={`/admin/schulung/${l.id}`} className={`min-w-0 flex-1 hover:underline ${l.veroeffentlicht ? "" : "text-grau"}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{l.titel}</span>
                      {!l.veroeffentlicht ? <Marke ton="warnung">Entwurf</Marke> : null}
                    </span>
                    <span className="block truncate text-sm text-grau">
                      {[l.video ? "Video" : "", dauerText(l.dauer_min), l.leistungen ? `${l.leistungen} ${l.leistungen === 1 ? "Leistung" : "Leistungen"}` : ""].filter(Boolean).join(" · ") || "nur Text"}
                    </span>
                  </Link>
                  <button type="button" className={pfeil} disabled={li === 0} onClick={() => lektionNach(ki, li, li - 1)} aria-label={`${l.titel} nach oben`}>
                    ↑
                  </button>
                  <button type="button" className={pfeil} disabled={li === k.lektionen.length - 1} onClick={() => lektionNach(ki, li, li + 1)} aria-label={`${l.titel} nach unten`}>
                    ↓
                  </button>
                  <Formular aktion={lektionVeroeffentlichen.bind(null, l.id, !l.veroeffentlicht)} className="hidden shrink-0 sm:block">
                    <Senden art="rahmen" klein vorab={l.veroeffentlicht ? "Entwurf" : "Veröffentlicht"}>
                      {l.veroeffentlicht ? "Zurückziehen" : "Veröffentlichen"}
                    </Senden>
                  </Formular>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-sm text-grau">Noch keine Lektion in dieser Kategorie.</p>
          )}
        </section>
      ))}
    </div>
  );
}

