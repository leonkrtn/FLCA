import Link from "next/link";
import { DateiFeld } from "@/components/admin/datei-feld";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Marke, Reiter, Schalter, Textfeld } from "@/components/admin/ui";
import { bewertungSpeichern, eintragLoeschen, galerieSpeichern, texteSpeichern } from "@/lib/aktionen/website";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { preis } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { db, websiteDatei } from "@/lib/supabase/admin";

export const metadata = { title: "Website" };

export default async function Website({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  await benutzerMitRecht("website");
  const { bereich = "leistungen" } = await searchParams;
  const reiter = [
    ["leistungen", "Leistungen und Preise"],
    ["texte", "Texte und Bilder"],
    ["galerie", "Vorher/Nachher"],
    ["bewertungen", "Bewertungen"],
  ].map(([k, t]) => ({ href: `/admin/website?bereich=${k}`, text: t }));

  return (
    <>
      <Kopf titel="Website">
        <a href="/" target="_blank" className="knopf knopf-rahmen knopf-klein">Website ansehen</a>
      </Kopf>
      <Reiter eintraege={reiter} aktiv={`/admin/website?bereich=${bereich}`} />
      {bereich === "leistungen" ? <Leistungen /> : bereich === "texte" ? <Texte /> : bereich === "galerie" ? <Galerie /> : <Bewertungen />}
    </>
  );
}

async function Leistungen() {
  const { data } = await db().from("leistungen").select("*").order("sortierung");
  return (
    <Abschnitt aktion={<Link href="/admin/website/leistung/neu" className="knopf knopf-dunkel knopf-klein">Leistung anlegen</Link>}>
      <ul className="divide-y divide-linie">
        {(data ?? []).map((l) => (
          <li key={l.id}>
            <Link href={`/admin/website/leistung/${l.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-3 hover:bg-papier sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_11rem]">
              <span>
                <span className="font-semibold">{l.name}</span> <span className="text-sm text-grau">· {KATEGORIEN[l.kategorie] ?? l.kategorie}</span>
              </span>
              <span className="zahlen text-right">{preis(l.preis_cent, l.preis_ab)}</span>
              <span className="zahlen hidden text-right text-grau sm:block">{l.dauer_min} min</span>
              {/* Feste Spaltenbreite für die Hinweise: jede Zeile ist ein eigenes Raster, Preis und Dauer stehen trotzdem untereinander. */}
              <span className="hidden justify-end gap-1 sm:flex">
                {!l.sichtbar ? <Marke ton="hell">versteckt</Marke> : null}
                {!l.online_anfragbar ? <Marke ton="hell">nicht buchbar</Marke> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Abschnitt>
  );
}

async function Texte() {
  const e = await einstellungen();
  return (
    <Abschnitt>
      <Formular aktion={texteSpeichern} className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-3">
          <DateiFeld name="heroBild" label="Startbild" ordner="start" vorhanden={e.medien.heroBild} vorschau={websiteDatei(e.medien.heroBild)} />
          <DateiFeld name="heroVideo" label="Startvideo (MP4, stumm, 5–10 s)" ordner="start" accept="video/mp4,video/webm" vorhanden={e.medien.heroVideo} vorschau={websiteDatei(e.medien.heroVideo)} />
          <DateiFeld name="ueberBild" label="Bild „Über uns“" ordner="start" vorhanden={e.medien.ueberBild} vorschau={websiteDatei(e.medien.ueberBild)} />
        </div>
        <p className="text-sm text-grau">Ohne eigenes Bild zeigt die Seite die Werkstattfotos, die schon drin sind. Ein Video läuft stumm in Schleife, das Startbild ist dann das Standbild.</p>
        <Textfeld label="Unterzeile auf der Startseite" name="heroUnterzeile" wert={e.texte.heroUnterzeile} zeilen={2} />
        <Feld label="Überschrift „Über uns“" name="ueberTitel" wert={e.texte.ueberTitel} />
        <Textfeld label="Text „Über uns“ (Absätze mit Leerzeile trennen)" name="ueberText" wert={e.texte.ueberText} zeilen={8} />
        <Textfeld label="Text Karriereseite" name="karriereText" wert={e.texte.karriereText} zeilen={3} />
        <div><Senden vorab="Gespeichert">Speichern</Senden></div>
      </Formular>
    </Abschnitt>
  );
}

async function Galerie() {
  const { data } = await db().from("galerie").select("*").order("sortierung");
  return (
    <Abschnitt titel="Vorher/Nachher">
      <GalerieEintrag />
      {(data ?? []).map((g) => (
        <div key={g.id}>
          <GalerieEintrag g={g} />
          <Formular aktion={eintragLoeschen.bind(null, "galerie", g.id)} bestaetigen="Eintrag löschen?" className="-mt-4 mb-4 text-right">
            <button className="text-sm text-grau underline">löschen</button>
          </Formular>
        </div>
      ))}
    </Abschnitt>
  );
}

async function Bewertungen() {
  const { data } = await db().from("bewertungen").select("*").order("sortierung");
  return (
    <Abschnitt titel="Bewertungen auf der Startseite" aktion={<span className="text-sm text-grau">Nur echte Bewertungen, z. B. aus Google, wörtlich übernehmen.</span>}>
      <BewertungEintrag />
      {(data ?? []).map((b) => (
        <BewertungEintrag key={b.id} b={b} />
      ))}
    </Abschnitt>
  );
}

function GalerieEintrag({ g }: { g?: Record<string, string | number | boolean> }) {
  return (
    <Formular aktion={galerieSpeichern.bind(null, (g?.id as string) ?? null)} className="grid gap-4 border-b border-linie py-6 md:grid-cols-4">
      <DateiFeld name="vorher_pfad" label="Vorher" ordner="galerie" vorhanden={g?.vorher_pfad as string} vorschau={websiteDatei(g?.vorher_pfad as string)} />
      <DateiFeld name="nachher_pfad" label="Nachher" ordner="galerie" vorhanden={g?.nachher_pfad as string} vorschau={websiteDatei(g?.nachher_pfad as string)} />
      <div className="grid gap-3 md:col-span-2">
        <Feld label="Titel" name="titel" wert={g?.titel as string} placeholder="z. B. BMW 5er, Aufbereitung Premium" />
        <Feld label="Beschreibung" name="beschreibung" wert={g?.beschreibung as string} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Schalter label="sichtbar" name="sichtbar" an={(g?.sichtbar as boolean) ?? true} zeile />
          <input type="hidden" name="sortierung" value={(g?.sortierung as number) ?? 0} />
          <Senden vorab={g ? "Gespeichert" : "Hinzugefügt"}>{g ? "Speichern" : "Hinzufügen"}</Senden>
        </div>
      </div>
    </Formular>
  )
}

function BewertungEintrag({ b }: { b?: Record<string, string | number | boolean> }) {
  return (
    <Formular aktion={bewertungSpeichern.bind(null, (b?.id as string) ?? null)} zuruecksetzen={!b} className="grid items-start gap-3 border-b border-linie py-4 md:grid-cols-[12rem_minmax(0,1fr)_7rem_9rem]">
      <Feld label="Name" name="name" wert={b?.name as string} />
      <Textfeld label="Text" name="text" wert={b?.text as string} zeilen={2} />
      <Feld label="Reihenfolge" name="sortierung" wert={(b?.sortierung as number) ?? 0} inputMode="numeric" />
      {/* Unsichtbare Beschriftung als Abstandhalter: Häkchen und Knopf starten auf Höhe der Felder daneben. */}
      <div className="grid gap-2">
        <span className="label invisible hidden md:block" aria-hidden>
          Status
        </span>
        <Schalter label="sichtbar" name="sichtbar" an={(b?.sichtbar as boolean) ?? true} zeile />
        <Senden className="w-full" vorab={b ? "Gespeichert" : "Hinzugefügt"}>{b ? "Speichern" : "Hinzufügen"}</Senden>
      </div>
    </Formular>
  )
}
