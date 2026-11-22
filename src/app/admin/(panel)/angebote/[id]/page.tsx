import { notFound } from "next/navigation";
import { DateiFeld } from "@/components/admin/datei-feld";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Marke, Schalter, Textfeld } from "@/components/admin/ui";
import { angebotLoeschen, angebotSpeichern } from "@/lib/aktionen/angebote";
import { angebotLaden } from "@/lib/angebote/daten";
import { laeuft, RABATT_ARTEN, reduziert, trifft } from "@/lib/angebote/preise";
import { benutzerMitRecht } from "@/lib/auth";
import { preis } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { db, websiteDatei } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Angebot bearbeiten" };

/** Kästchen mit Wert, damit mehrere gleichnamige Felder als Liste ankommen (FormData.getAll). */
function Kaestchen({ name, wert, an, children }: { name: string; wert: string; an: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
      <input type="checkbox" name={name} value={wert} defaultChecked={an} className="size-5 shrink-0 accent-tinte" />
      {children}
    </label>
  );
}

/**
 * Ein Angebot: links Rabatt und Laufzeit, rechts, was die Website dazu zeigt. Darunter die Auswahl, worauf
 * es wirkt, mit dem Preis, den die Website und neue Belege dann nehmen (Stand: gespeichert).
 */
export default async function AngebotSeite({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("angebote");
  const { id } = await params;
  const neu = id === "neu";
  const [a, { data }] = await Promise.all([neu ? Promise.resolve(null) : angebotLaden(id), db().from("leistungen").select("*").order("sortierung")]);
  if (!neu && !a) notFound();
  const heute = berlinDatum();
  const liste = ((data ?? []) as Leistung[]).filter((l) => l.aktiv !== false);
  const istLeistung = (l: Leistung) => (l.art ?? "leistung") === "leistung";
  const gruppen = [
    ...Object.entries(KATEGORIEN).map(([k, name]) => ({ titel: name, eintraege: liste.filter((l) => istLeistung(l) && l.kategorie === k) })),
    { titel: "Teile, Material, Zuschläge", eintraege: liste.filter((l) => !istLeistung(l)) },
  ].filter((g) => g.eintraege.length);
  const wertText = a ? (a.art === "prozent" ? String(a.wert) : (a.wert / 100).toFixed(2).replace(".", ",").replace(",00", "")) : "";
  const status = !a ? null : laeuft(a, heute) ? "läuft" : !a.aktiv ? "aus" : a.von > heute ? "geplant" : "abgelaufen";

  return (
    <>
      <Kopf titel={neu ? "Neues Angebot" : a!.titel} zurueck={{ href: "/admin/angebote", text: "Angebote" }} unter={status ? <Marke ton={status === "läuft" ? "ok" : "hell"}>{status}</Marke> : undefined}>
        {status === "läuft" ? (
          <a href="/" target="_blank" className="knopf knopf-rahmen">
            Auf der Website ansehen
          </a>
        ) : null}
      </Kopf>

      <Formular aktion={angebotSpeichern.bind(null, neu ? null : id)} className="grid items-start gap-x-8 lg:grid-cols-2">
        <Abschnitt titel="Rabatt und Laufzeit">
          <div className="grid grid-cols-2 gap-4">
            <Feld label="Titel" name="titel" wert={a?.titel} required maxLength={80} className="col-span-2" placeholder="z. B. Reifensaison" />
            <Auswahl label="Art" name="art" wert={a?.art ?? "prozent"} optionen={Object.entries(RABATT_ARTEN)} />
            <Feld
              label="Wert"
              name="wert"
              wert={wertText}
              required
              inputMode="decimal"
              hilfe="Prozent: 20 · Euro weniger: 10 · Festpreis: 29 (brutto)"
              className="[&_input]:text-right [&_input]:tabular-nums"
            />
            <Feld label="Von" name="von" typ="date" wert={a?.von ?? heute} required />
            <Feld label="Bis" name="bis" typ="date" wert={a?.bis} hilfe="Leer = läuft, bis Sie es ausschalten." />
            <div className="col-span-2 border-t border-linie pt-4">
              <Schalter label="Eingeschaltet" name="aktiv" an={a?.aktiv ?? true} hilfe="Aus = wirkt nirgends, auch nicht in der Laufzeit." />
            </div>
            <p className="col-span-2 text-sm text-grau">
              Angebotspreise werden auf volle Euro gerundet. Treffen mehrere Angebote dieselbe Leistung, gilt der günstigste Preis. Wer während der Laufzeit einen Termin anfragt, behält den Angebotspreis
              auch für einen späteren Termin.
            </p>
          </div>
        </Abschnitt>

        <Abschnitt titel="Auf der Website">
          <div className="grid gap-4">
            <Textfeld label="Kurztext" name="kurztext" wert={a?.kurztext} zeilen={3} hilfe="Steht im Hinweis auf der Startseite, z. B. „Jetzt auf Winterreifen wechseln.“" />
            <Textfeld label="Bedingungen" name="bedingungen" wert={a?.bedingungen} zeilen={2} hilfe="Kleingedrucktes, z. B. „Nicht mit anderen Aktionen kombinierbar.“" />
            <DateiFeld name="bild_pfad" label="Bild für die Startseite (optional)" ordner="angebote" vorhanden={a?.bild_pfad} vorschau={websiteDatei(a?.bild_pfad)} />
            <p className="text-sm text-grau">Die Website zeigt außerdem den alten Preis durchgestrichen, einen Hinweis auf den Kacheln und, wenn ein Ende gesetzt ist, die verbleibenden Tage.</p>
          </div>
        </Abschnitt>

        <Abschnitt titel="Gilt für" className="lg:col-span-2">
          <fieldset className="mb-6">
            <legend className="label">Ganze Kategorien (nur Leistungen, keine Teile)</legend>
            <div className="flex flex-wrap gap-x-8">
              {Object.entries(KATEGORIEN).map(([k, name]) => (
                <Kaestchen key={k} name="kategorien" wert={k} an={a?.kategorien.includes(k) ?? false}>
                  <span className="font-semibold">{name}</span>
                </Kaestchen>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Oder einzelne Positionen der Preisliste</legend>
            {a ? <p className="mb-3 text-sm text-grau">Rechts: Preis während des Angebots (gespeicherter Stand).</p> : null}
            <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
              {gruppen.map((g) => (
                <div key={g.titel}>
                  <h3 className="mb-1 border-b border-linie pb-1 text-sm font-semibold text-grau">{g.titel}</h3>
                  {g.eintraege.map((l) => {
                    const getroffen = a && trifft(a, l);
                    const neuerPreis = getroffen ? (l.preis_cent === null ? (a.art === "festpreis" ? a.wert : null) : reduziert(a, l.preis_cent)) : null;
                    return (
                      <Kaestchen key={l.id} name="leistung_ids" wert={l.id} an={a?.leistung_ids.includes(l.id) ?? false}>
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="shrink-0 text-right text-sm tabular-nums">
                          {neuerPreis !== null && neuerPreis !== l.preis_cent ? (
                            <>
                              <s className="text-grau">{preis(l.preis_cent, l.preis_ab)}</s> <span className="font-semibold">{preis(neuerPreis, l.preis_ab)}</span>
                            </>
                          ) : (
                            <span className={getroffen ? "font-semibold" : "text-grau"}>{getroffen && l.preis_cent === null ? `${preis(null)}, Hinweis` : preis(l.preis_cent, l.preis_ab)}</span>
                          )}
                        </span>
                      </Kaestchen>
                    );
                  })}
                </div>
              ))}
            </div>
          </fieldset>
        </Abschnitt>

        <div className="lg:col-span-2">
          <Senden vorab={neu ? "Angelegt" : "Gespeichert"}>{neu ? "Anlegen" : "Speichern"}</Senden>
        </div>
      </Formular>

      {!neu ? (
        <Formular aktion={angebotLoeschen.bind(null, id)} bestaetigen="Angebot endgültig löschen? Termine und Belege behalten ihre Angebotspreise." className="mt-10 border-t border-linie pt-6">
          <Senden art="rahmen" klein vorab="Gelöscht">
            Angebot löschen
          </Senden>
        </Formular>
      ) : null}
    </>
  );
}
