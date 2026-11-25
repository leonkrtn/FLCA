import Link from "next/link";
import { DateiFeld } from "@/components/admin/datei-feld";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Reiter, Schalter, Textfeld } from "@/components/admin/ui";
import { bewertungSpeichern, texteSpeichern } from "@/lib/aktionen/website";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { db, websiteDatei } from "@/lib/supabase/admin";

export const metadata = { title: "Website" };

export default async function Website({ searchParams }: { searchParams: Promise<{ bereich?: string }> }) {
  await benutzerMitRecht("website");
  const { bereich = "texte" } = await searchParams;
  const reiter = [
    ["texte", "Texte und Bilder"],
    ["bewertungen", "Bewertungen"],
  ].map(([k, t]) => ({ href: `/admin/website?bereich=${k}`, text: t }));

  return (
    <>
      <Kopf titel="Website">
        <a href="/" target="_blank" className="knopf knopf-rahmen knopf-klein">Website ansehen</a>
      </Kopf>
      <Reiter eintraege={reiter} aktiv={`/admin/website?bereich=${bereich}`} />
      <p className="mb-6 text-sm text-grau">
        Leistungen und Preise stehen in der <Link href="/admin/preisliste" className="font-semibold text-tinte underline">Preisliste</Link>, zusammen mit den Positionen für Rechnungen.
      </p>
      {bereich === "bewertungen" ? <Bewertungen /> : <Texte />}
    </>
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
        <p className="text-sm text-grau">Ohne eigenes Bild zeigt die Seite die Werkstattfotos, die schon drin sind. Ein Video läuft stumm in Schleife über dem Startbild.</p>
        <Feld label="Überschrift „Über uns“" name="ueberTitel" wert={e.texte.ueberTitel} />
        <Textfeld label="Text „Über uns“ (Absätze mit Leerzeile trennen)" name="ueberText" wert={e.texte.ueberText} zeilen={8} />
        <Textfeld label="Text Karriereseite" name="karriereText" wert={e.texte.karriereText} zeilen={3} />
        <div><Senden vorab="Gespeichert">Speichern</Senden></div>
      </Formular>
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
