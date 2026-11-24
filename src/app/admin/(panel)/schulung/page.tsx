import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { SchulungListe } from "@/components/admin/schulung-liste";
import { Kopf, Leer, Reiter } from "@/components/admin/ui";
import { kategorieSpeichern, lektionArchivieren, lektionLoeschen } from "@/lib/aktionen/schulung";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { schulungLaden } from "@/lib/schulung/daten";

export const metadata = { title: "Schulung" };

/**
 * Schulung: Lektionen für die Team-App. Oben die Kategorien mit ihren Lektionen in der Reihenfolge, in der das
 * Team sie sieht (Entwürfe grau), darunter neue Kategorie. Im Archiv steht, was aus der Team-App genommen ist.
 */
export default async function SchulungSeite({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  await benutzerMitRecht("schulung");
  const { ansicht } = await searchParams;
  const archiv = ansicht === "archiv";
  const { kategorien, lektionen, unmigriert } = await schulungLaden();
  const archiviert = lektionen.filter((l) => l.archiviert_am).sort((a, b) => (b.archiviert_am ?? "").localeCompare(a.archiviert_am ?? ""));
  const kategorieName = new Map(kategorien.map((k) => [k.id, k.name]));

  const liste = kategorien.map((k) => ({
    id: k.id,
    name: k.name,
    archiviert: archiviert.filter((l) => l.kategorie_id === k.id).length,
    lektionen: lektionen
      .filter((l) => l.kategorie_id === k.id && !l.archiviert_am)
      .map((l) => ({ id: l.id, titel: l.titel, veroeffentlicht: l.veroeffentlicht, dauer_min: l.dauer_min, video: Boolean(l.video_url), leistungen: l.leistung_ids.length })),
  }));
  // Neuer Stand vom Server (nach Speichern, Archivieren …) baut die Liste neu auf, sonst hält sie ihre eigene Reihenfolge
  const stand = JSON.stringify(liste);

  return (
    <>
      <Kopf titel="Schulung" unter="Anleitungen und Videos für das Team. Erscheinen in der Team-App unter Mehr → Schulung, sobald sie veröffentlicht sind.">
        {!unmigriert && kategorien.length ? (
          <Link href="/admin/schulung/neu" className="knopf knopf-dunkel">
            Neue Lektion
          </Link>
        ) : null}
      </Kopf>

      {unmigriert ? (
        <p className="mb-6 border-l-2 border-rot bg-weiss px-4 py-3">
          Die Datenbank ist noch nicht auf dem neuen Stand. Bitte im Supabase SQL-Editor <span className="font-semibold">supabase/migrations/20261129100000_schulung.sql</span> ausführen.
        </p>
      ) : (
        <>
          <Reiter
            aktiv={archiv ? "/admin/schulung?ansicht=archiv" : "/admin/schulung"}
            eintraege={[
              { href: "/admin/schulung", text: "Lektionen" },
              { href: "/admin/schulung?ansicht=archiv", text: "Archiv", anzahl: archiviert.length },
            ]}
          />

          {archiv ? (
            <section className="bg-weiss">
              {archiviert.length ? (
                <ul className="divide-y divide-linie">
                  {archiviert.map((l) => (
                    <li key={l.id} className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 md:px-6">
                      <Link href={`/admin/schulung/${l.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="block truncate font-semibold">{l.titel}</span>
                        <span className="block truncate text-sm text-grau">
                          {kategorieName.get(l.kategorie_id)} · archiviert am <span className="tabular-nums">{datum(l.archiviert_am!)}</span>
                        </span>
                      </Link>
                      <Formular aktion={lektionArchivieren.bind(null, l.id, false)}>
                        <Senden art="rahmen" klein vorab="Zurückgeholt">
                          Zurückholen
                        </Senden>
                      </Formular>
                      <Formular aktion={lektionLoeschen.bind(null, l.id)} bestaetigen={`„${l.titel}“ endgültig löschen? Text und Bilder sind danach weg.`}>
                        <Senden art="rahmen" klein vorab="Gelöscht">
                          Endgültig löschen
                        </Senden>
                      </Formular>
                    </li>
                  ))}
                </ul>
              ) : (
                <Leer>Das Archiv ist leer.</Leer>
              )}
            </section>
          ) : (
            <>
              {kategorien.length ? <SchulungListe key={stand} start={liste} /> : <Leer>Noch keine Kategorie. Legen Sie unten die erste an.</Leer>}
              <section className="mt-8 bg-weiss p-4 md:p-6">
                <h2 className="mb-3 font-semibold">Neue Kategorie</h2>
                <Formular aktion={kategorieSpeichern.bind(null, null)} zuruecksetzen className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-60 flex-1">
                    <span className="label">Name</span>
                    <input name="name" required maxLength={60} className="feld" placeholder="z. B. Reifen und Räder" />
                  </label>
                  <Senden vorab="Angelegt">Anlegen</Senden>
                </Formular>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
