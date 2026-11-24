import Link from "next/link";
import { notFound } from "next/navigation";
import { MobilKopf } from "@/components/mobil/teile";
import { LektionInhalt } from "@/components/schulung/lektion";
import { benutzerMitRecht } from "@/lib/auth";
import { darf } from "@/lib/rollen";
import { bildAdressen, lektionLaden, schulungLaden, sichtbar } from "@/lib/schulung/daten";
import { dauerText } from "@/lib/schulung/inhalt";

export const metadata = { title: "Lektion" };

/** Woher man kam, darf nur eine Seite der Team-App sein (kein Sprung nach außen über den Link). */
const zurueckNach = (von: string | undefined) => (von && /^\/team(\/[\w-]+)*$/.test(von) ? von : "/team/schulung");

/**
 * Eine Lektion in der Team-App. Erreichbar aus der Schulung und als „Anleitung“ vom Auftrag, deshalb reist
 * „zurück“ als `?von=` mit. Entwürfe und archivierte Lektionen sehen nur, wer die Schulung pflegt (Vorschau).
 */
export default async function TeamLektion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ von?: string }> }) {
  const b = await benutzerMitRecht("werkstatt");
  const { id } = await params;
  const { von } = await searchParams;
  const l = await lektionLaden(id);
  const pflegt = darf(b.rolle, "schulung");
  if (!l || (!sichtbar(l) && !pflegt)) notFound();
  const [bilder, { kategorien, lektionen }] = await Promise.all([bildAdressen(l.inhalt), schulungLaden()]);
  const kategorie = kategorien.find((k) => k.id === l.kategorie_id)?.name ?? "";
  // „Siehe auch“ in der gewählten Reihenfolge; gelöschte, archivierte und Entwürfe fallen heraus
  const siehe = l.siehe_auch.map((x) => lektionen.find((y) => y.id === x)).filter((x) => x && sichtbar(x)) as typeof lektionen;
  const zurueck = zurueckNach(von);

  return (
    <>
      <MobilKopf titel={l.titel} unter={kategorie} zurueck={zurueck} />
      <div className="grid gap-4 p-4">
        {!sichtbar(l) ? (
          <p className="rounded-lg border border-linie px-4 py-3 text-sm">
            <span className="font-semibold">{l.archiviert_am ? "Archiviert." : "Entwurf."}</span> Das Team sieht diese Lektion noch nicht.
          </p>
        ) : null}
        <LektionInhalt l={l} bilder={bilder} ohneTitel />
        {siehe.length ? (
          <section className="mt-4 grid gap-2 border-t border-linie pt-4">
            <h2 className="font-semibold">Siehe auch</h2>
            {siehe.map((x) => {
              const info = [x.video_url ? "Video" : "", dauerText(x.dauer_min)].filter(Boolean).join(" · ");
              return (
                <Link key={x.id} href={`/team/schulung/${x.id}${zurueck !== "/team/schulung" ? `?von=${encodeURIComponent(zurueck)}` : ""}`} className="karte block bg-weiss px-4 py-3 active:bg-papier">
                  <p className="font-semibold">{x.titel}</p>
                  {info ? <p className="zahlen text-xs text-grau">{info}</p> : null}
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>
    </>
  );
}
