import { notFound } from "next/navigation";
import { DateiFeld } from "@/components/admin/datei-feld";
import { Formular, Senden } from "@/components/admin/formular";
import { Auswahl, Feld, Kopf, Schalter, Textfeld } from "@/components/admin/ui";
import { angebotSpeichern } from "@/lib/aktionen/angebot";
import { benutzerMitRecht } from "@/lib/auth";
import { KATEGORIEN } from "@/lib/inhalte";
import { darf } from "@/lib/rollen";
import { db, websiteDatei } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";

export const metadata = { title: "Angebot bearbeiten" };

const EINHEITEN = ["Pauschal", "Stk", "Std", "l", "Satz", "km"];

/**
 * Eine Position des Angebots, links das, was auf der Rechnung steht, rechts das, was Terminbuchung und
 * Website brauchen. Bei Teilen und Material (Art „position“) blendet CSS die rechte Seite aus
 * (Klasse „nur-leistung“, Regel in globals.css), ganz ohne Skript.
 */
export default async function AngebotBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  const b = await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const neu = id === "neu";
  const { data } = neu ? { data: null } : await db().from("leistungen").select("*").eq("id", id).maybeSingle();
  if (!neu && !data) notFound();
  const l = data as Leistung | null;
  const website = darf(b.rolle, "website");

  return (
    <>
      <Kopf titel={neu ? "Neue Position" : l!.name} zurueck={{ href: "/admin/angebot", text: "Angebot" }}>
        {l?.sichtbar ? (
          <a href={`/leistungen/${l.slug}`} target="_blank" className="knopf knopf-rahmen">
            Auf der Website ansehen
          </a>
        ) : null}
      </Kopf>
      <Formular aktion={angebotSpeichern.bind(null, neu ? null : id)} className="angebot-formular grid items-start gap-x-8 lg:grid-cols-2">
        <section className="mb-8 bg-weiss p-4 md:p-6">
          <div className="mb-4 flex h-9 items-center">
            <h2 className="text-lg font-semibold">Preis und Rechnung</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Feld label="Bezeichnung" name="name" wert={l?.name} required className="col-span-2" placeholder="z. B. Radwechsel, Ventil, Arbeitszeit" />
            <Auswahl
              label="Art"
              name="art"
              wert={l?.art ?? "leistung"}
              optionen={[
                ["leistung", "Leistung (Arbeit mit Dauer)"],
                ["position", "Teil, Material oder Zuschlag"],
              ]}
              className="col-span-2"
            />
            <Feld label="Nummer" name="nummer" wert={l?.nummer} placeholder="optional" />
            <Auswahl label="Einheit" name="einheit" wert={l?.einheit ?? "Pauschal"} optionen={EINHEITEN.map((x) => [x, x])} />
            <Feld
              label="Preis brutto €"
              name="preis"
              wert={l?.preis_cent != null ? (l.preis_cent / 100).toFixed(2).replace(".", ",") : ""}
              inputMode="decimal"
              hilfe="Leer = auf Anfrage"
              className="[&_input]:text-right [&_input]:tabular-nums"
            />
            <Auswahl label="MwSt." name="mwst_satz" wert={String(Number(l?.mwst_satz ?? 19))} optionen={[["19", "19 %"], ["7", "7 %"], ["0", "0 %"]]} />
            <div className="col-span-2 grid gap-3 border-t border-linie pt-4">
              <Schalter label="Aktiv" name="aktiv" an={l?.aktiv ?? true} hilfe="Aus = überall ausgeblendet: nicht auf der Website, nicht buchbar, nicht in der Auswahl für Rechnungen." />
            </div>
          </div>
        </section>

        <fieldset disabled={!website} className="nur-leistung mb-8 min-w-0 bg-weiss p-4 md:p-6">
          <div className="mb-4 flex h-9 items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Termin und Website</h2>
            {!website ? <span className="text-sm text-grau">nur der Inhaber kann das ändern</span> : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Feld label="Arbeitszeit in Minuten" name="dauer_min" wert={l?.dauer_min ?? 60} inputMode="numeric" hilfe="So lange ist ein Arbeitsplatz belegt." className="[&_input]:tabular-nums" />
            <Auswahl label="Kategorie" name="kategorie" wert={l?.kategorie ?? "service"} optionen={Object.entries(KATEGORIEN)} />
            <div className="col-span-2 grid gap-3 sm:grid-cols-3">
              <Schalter label="Auf der Website" name="sichtbar" an={l?.sichtbar ?? true} />
              <Schalter label="Online buchbar" name="online_anfragbar" an={l?.online_anfragbar ?? true} />
              <Schalter label="„ab“-Preis" name="preis_ab" an={l?.preis_ab ?? false} />
            </div>
            <Feld label="Kurzbeschreibung" name="kurz" wert={l?.kurz} className="col-span-2" placeholder="Eine Zeile unter dem Namen" />
            <Textfeld label="Beschreibung" name="beschreibung" wert={l?.beschreibung} zeilen={4} className="col-span-2" />
            <Feld label="Webadresse" name="slug" wert={l?.slug?.startsWith("position-") ? "" : l?.slug} hilfe="z. B. radwechsel. Leer = aus dem Namen." />
            <Feld label="Reihenfolge" name="sortierung" wert={l?.sortierung ?? 0} inputMode="numeric" className="[&_input]:tabular-nums" />
            <div className="col-span-2">
              <DateiFeld name="bild_pfad" label="Bild (optional)" ordner="leistungen" vorhanden={l?.bild_pfad} vorschau={websiteDatei(l?.bild_pfad)} />
            </div>
          </div>
        </fieldset>

        <div className="lg:col-span-2">
          <Senden vorab={neu ? "Angelegt" : "Gespeichert"}>{neu ? "Anlegen" : "Speichern"}</Senden>
        </div>
      </Formular>
    </>
  );
}
