import { notFound } from "next/navigation";
import { DateiFeld } from "@/components/admin/datei-feld";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Schalter, Textfeld } from "@/components/admin/ui";
import { leistungSpeichern } from "@/lib/aktionen/website";
import { benutzerMitRecht } from "@/lib/auth";
import { KATEGORIEN } from "@/lib/inhalte";
import { db, websiteDatei } from "@/lib/supabase/admin";

export default async function LeistungBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("website");
  const { id } = await params;
  const neu = id === "neu";
  const { data: l } = neu ? { data: null } : await db().from("leistungen").select("*").eq("id", id).maybeSingle();
  if (!neu && !l) notFound();
  return (
    <>
      <Kopf titel={neu ? "Neue Leistung" : l!.name} zurueck={{ href: "/admin/website", text: "Website" }} />
      <Abschnitt>
        <Formular aktion={leistungSpeichern.bind(null, neu ? null : id)} className="grid gap-4 sm:grid-cols-2">
          <Feld label="Name" name="name" wert={l?.name} required />
          <Feld label="Adresse (Slug)" name="slug" wert={l?.slug} hilfe="Teil der Webadresse, z. B. radwechsel. Leer = aus dem Namen." />
          <Feld label="Kurzbeschreibung" name="kurz" wert={l?.kurz} className="sm:col-span-2" />
          <Textfeld label="Beschreibung" name="beschreibung" wert={l?.beschreibung} zeilen={5} className="sm:col-span-2" />
          <Auswahl label="Kategorie" name="kategorie" wert={l?.kategorie ?? "service"} optionen={Object.entries(KATEGORIEN)} />
          <Feld label="Preis brutto in € (leer = auf Anfrage)" name="preis" wert={l?.preis_cent != null ? (l.preis_cent / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" />
          <Feld label="Arbeitszeit in Minuten" name="dauer_min" wert={l?.dauer_min ?? 60} inputMode="numeric" hilfe="So lange ist ein Arbeitsplatz belegt. Pausen werden übersprungen." />
          <Feld label="Reihenfolge" name="sortierung" wert={l?.sortierung ?? 0} inputMode="numeric" />
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <Schalter label="„ab“-Preis" name="preis_ab" an={l?.preis_ab ?? false} />
            <Schalter label="auf der Website sichtbar" name="sichtbar" an={l?.sichtbar ?? true} />
            <Schalter label="online anfragbar" name="online_anfragbar" an={l?.online_anfragbar ?? true} />
          </div>
          <DateiFeld name="bild_pfad" label="Bild (optional)" ordner="leistungen" vorhanden={l?.bild_pfad} vorschau={websiteDatei(l?.bild_pfad)} />
          <div className="sm:col-span-2"><Senden>Speichern</Senden></div>
        </Formular>
      </Abschnitt>
    </>
  );
}
