import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { SchulungEditor } from "@/components/admin/schulung-editor";
import { Auswahl, Kopf, Marke, Schalter } from "@/components/admin/ui";
import { lektionArchivieren, lektionLoeschen, lektionSpeichern } from "@/lib/aktionen/schulung";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { bildAdressen, lektionLaden, schulungLaden } from "@/lib/schulung/daten";
import { db } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";

export const metadata = { title: "Lektion bearbeiten" };

/** Kästchen mit Wert, damit mehrere gleichnamige Felder als Liste ankommen (FormData.getAll). */
function Kaestchen({ name, wert, an, children }: { name: string; wert: string; an: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 py-0.5">
      <input type="checkbox" name={name} value={wert} defaultChecked={an} className="size-5 shrink-0 accent-tinte" />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}

/**
 * Eine Lektion: links Titel, Video, Text mit Knöpfen und Angaben, rechts die Vorschau im iPhone-Rahmen.
 * Darunter Einordnung: Kategorie, veröffentlicht, Leistungen (dann steht sie am Auftrag) und „Siehe auch“.
 */
export default async function LektionSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kategorie?: string }> }) {
  await benutzerMitRecht("schulung");
  const { id } = await params;
  const { kategorie } = await searchParams;
  const neu = id === "neu";
  const [l, { kategorien, lektionen }, { data: leistungenRoh }] = await Promise.all([
    neu ? Promise.resolve(null) : lektionLaden(id),
    schulungLaden(),
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
  ]);
  if (!neu && !l) notFound();
  const bilder = l ? await bildAdressen(l.inhalt) : {};

  const leistungen = ((leistungenRoh ?? []) as Leistung[]).filter((x) => (x.art ?? "leistung") === "leistung" && (x.aktiv !== false || l?.leistung_ids.includes(x.id)));
  const leistungsGruppen = Object.entries(KATEGORIEN)
    .map(([k, name]) => ({ name, eintraege: leistungen.filter((x) => x.kategorie === k) }))
    .filter((g) => g.eintraege.length);
  const andere = lektionen.filter((x) => x.id !== id && !x.archiviert_am);
  const kategorieId = l?.kategorie_id ?? (kategorien.some((k) => k.id === kategorie) ? kategorie! : kategorien[0]?.id);
  if (!kategorieId) notFound();
  const status = !l ? null : l.archiviert_am ? "archiviert" : l.veroeffentlicht ? "veröffentlicht" : "Entwurf";

  const einordnung = (
    <section className="grid gap-5 bg-weiss p-4 md:p-6">
      <h2 className="text-lg font-semibold">Einordnung</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Auswahl label="Kategorie" name="kategorie_id" wert={kategorieId} optionen={kategorien.map((k) => [k.id, k.name])} />
        <Schalter
          label="Veröffentlicht"
          name="veroeffentlicht"
          an={l?.veroeffentlicht ?? false}
          zeile
          hilfe={l?.archiviert_am ? "Im Archiv: Das Team sieht sie erst, wenn sie zurückgeholt ist." : "Aus = Entwurf, das Team sieht die Lektion noch nicht."}
        />
      </div>

      <details open={Boolean(l?.leistung_ids.length)} className="border-t border-linie pt-4">
        <summary className="cursor-pointer font-semibold">
          Leistungen der Preisliste <span className="font-normal tabular-nums text-grau">{l?.leistung_ids.length ? `${l.leistung_ids.length} gewählt` : ""}</span>
        </summary>
        <p className="mt-1 text-sm text-grau">Hat ein Auftrag eine dieser Leistungen, steht dort in der Team-App „Anleitung“ mit dieser Lektion.</p>
        <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {leistungsGruppen.map((g) => (
            <div key={g.name}>
              <h3 className="mb-1 border-b border-linie pb-1 text-sm font-semibold text-grau">{g.name}</h3>
              {g.eintraege.map((x) => (
                <Kaestchen key={x.id} name="leistung_ids" wert={x.id} an={l?.leistung_ids.includes(x.id) ?? false}>
                  {x.name}
                </Kaestchen>
              ))}
            </div>
          ))}
        </div>
      </details>

      <details open={Boolean(l?.siehe_auch.length)} className="border-t border-linie pt-4">
        <summary className="cursor-pointer font-semibold">
          Siehe auch <span className="font-normal tabular-nums text-grau">{l?.siehe_auch.length ? `${l.siehe_auch.length} gewählt` : ""}</span>
        </summary>
        <p className="mt-1 text-sm text-grau">Verwandte Lektionen, stehen in der Team-App am Ende dieser Lektion.</p>
        {andere.length ? (
          <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {kategorien.map((k) => {
              const hier = andere.filter((x) => x.kategorie_id === k.id);
              return hier.length ? (
                <div key={k.id}>
                  <h3 className="mb-1 border-b border-linie pb-1 text-sm font-semibold text-grau">{k.name}</h3>
                  {hier.map((x) => (
                    <Kaestchen key={x.id} name="siehe_auch" wert={x.id} an={l?.siehe_auch.includes(x.id) ?? false}>
                      {x.titel}
                      {!x.veroeffentlicht ? <span className="text-grau"> (Entwurf)</span> : null}
                    </Kaestchen>
                  ))}
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-grau">Noch keine anderen Lektionen.</p>
        )}
      </details>

      <div className="border-t border-linie pt-4">
        <Senden vorab={neu ? "Angelegt" : "Gespeichert"}>{neu ? "Anlegen" : "Speichern"}</Senden>
      </div>
    </section>
  );

  return (
    <>
      <Kopf
        titel={neu ? "Neue Lektion" : l!.titel}
        zurueck={{ href: l?.archiviert_am ? "/admin/schulung?ansicht=archiv" : "/admin/schulung", text: "Schulung" }}
        unter={
          status ? (
            <span className="flex flex-wrap items-center gap-2">
              <Marke ton={status === "veröffentlicht" ? "ok" : status === "Entwurf" ? "warnung" : "hell"}>{status}</Marke>
              <span className="text-sm">zuletzt geändert {datumZeit(l!.aktualisiert_am)}</span>
            </span>
          ) : undefined
        }
      >
        {l && status === "veröffentlicht" ? (
          <Link href={`/team/schulung/${l.id}`} target="_blank" className="knopf knopf-rahmen">
            In der Team-App ansehen
          </Link>
        ) : null}
      </Kopf>

      <Formular aktion={lektionSpeichern.bind(null, neu ? null : id)}>
        <SchulungEditor
          start={{
            titel: l?.titel ?? "",
            kurz: l?.kurz ?? "",
            inhalt: l?.inhalt ?? "",
            video_url: l?.video_url ?? "",
            dauer_min: l?.dauer_min ? String(l.dauer_min) : "",
            schlagwoerter: l?.schlagwoerter.join(", ") ?? "",
            werkzeug: l?.werkzeug ?? "",
            sicherheit: l?.sicherheit ?? "",
          }}
          bilder={bilder}
          kategorieName={kategorien.find((k) => k.id === kategorieId)?.name}
          hinten={einordnung}
        />
      </Formular>

      {l ? (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-linie pt-6">
          {l.archiviert_am ? (
            <>
              <Formular aktion={lektionArchivieren.bind(null, l.id, false)}>
                <Senden art="rahmen" klein vorab="Zurückgeholt">
                  Aus dem Archiv zurückholen
                </Senden>
              </Formular>
              <Formular aktion={lektionLoeschen.bind(null, l.id)} bestaetigen={`„${l.titel}“ endgültig löschen? Text und Bilder sind danach weg.`}>
                <Senden art="rahmen" klein vorab="Gelöscht">
                  Endgültig löschen
                </Senden>
              </Formular>
            </>
          ) : (
            <Formular aktion={lektionArchivieren.bind(null, l.id, true)} bestaetigen="Lektion archivieren? Das Team sieht sie dann nicht mehr. Aus dem Archiv lässt sie sich zurückholen.">
              <Senden art="rahmen" klein vorab="Archiviert">
                Archivieren
              </Senden>
            </Formular>
          )}
        </div>
      ) : null}
    </>
  );
}
