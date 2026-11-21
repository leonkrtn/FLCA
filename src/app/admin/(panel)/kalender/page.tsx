import Link from "next/link";
import { Kopf } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datumKurzText, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, berlinUhrzeit, istDatum, minuten, plusTage, wochenbeginn } from "@/lib/zeit";

export const metadata = { title: "Kalender" };

const STUNDE_PX = 56;

/**
 * Wochenansicht Mo–Sa der Termine. Überlappende Termine bekommen Spalten (gierige Zuordnung), damit
 * nichts verdeckt wird.
 */
export default async function KalenderSeite({ searchParams }: { searchParams: Promise<{ woche?: string }> }) {
  await benutzerMitRecht("termine");
  const { woche } = await searchParams;
  const montag = wochenbeginn(istDatum(woche) ? woche : berlinDatum());
  const { oeffnungszeiten } = await einstellungen();
  const tage = Array.from({ length: 6 }, (_, i) => plusTage(montag, i));
  const von = berlin(montag);
  const bis = berlin(plusTage(montag, 7));

  const alleFenster = Object.values(oeffnungszeiten).flat();
  const startStunde = Math.floor(Math.min(...alleFenster.map(([a]) => minuten(a)), 8 * 60) / 60);
  const endStunde = Math.ceil(Math.max(...alleFenster.map(([, b]) => minuten(b)), 18 * 60) / 60);

  const { data: termine } = await db()
    .from("termine")
    .select(TERMIN_FELDER)
    .in("status", ["angefragt", "bestaetigt", "erledigt"])
    .gte("beginn", von.toISOString())
    .lt("beginn", bis.toISOString())
    .order("beginn");

  type Block = { id: string; beginn: Date; ende: Date; titel: string; unter: string; art: "angefragt" | "bestaetigt" | "erledigt"; href: string; spalte?: number; spalten?: number };
  const bloecke: Block[] = ((termine ?? []) as Termin[]).map((t) => ({
    id: t.id,
    beginn: new Date(t.beginn),
    ende: new Date(t.ende),
    titel: t.leistung_name,
    unter: [t.fahrzeug?.kennzeichen, t.kunde?.name].filter(Boolean).join(" · "),
    art: t.status as Block["art"],
    href: `/admin/termine/${t.id}`,
  }));

  const proTag = tage.map((d) => {
    const liste = bloecke.filter((b) => berlinDatum(b.beginn) === d).sort((a, b) => a.beginn.getTime() - b.beginn.getTime());
    const enden: number[] = [];
    for (const b of liste) {
      let s = enden.findIndex((e) => e <= b.beginn.getTime());
      if (s === -1) s = enden.push(0) - 1;
      enden[s] = b.ende.getTime();
      b.spalte = s;
    }
    for (const b of liste) b.spalten = enden.length;
    return { datum: d, liste };
  });

  const farbe: Record<Block["art"], string> = {
    bestaetigt: "bg-tinte text-weiss",
    angefragt: "bg-kreide text-tinte",
    erledigt: "bg-linie text-grau",
  };
  const heute = berlinDatum();

  return (
    <>
      <Kopf titel="Kalender" unter={`Woche ab ${datumKurzText(montag)}`}>
        <Link href={`/admin/kalender?woche=${plusTage(montag, -7)}`} className="knopf knopf-rahmen knopf-klein">← Vorher</Link>
        <Link href="/admin/kalender" className="knopf knopf-rahmen knopf-klein">Heute</Link>
        <Link href={`/admin/kalender?woche=${plusTage(montag, 7)}`} className="knopf knopf-rahmen knopf-klein">Nächste →</Link>
        <Link href="/admin/termine/neu" className="knopf knopf-dunkel knopf-klein">Termin eintragen</Link>
      </Kopf>
      <div className="-mx-4 quer-scrollen bg-weiss md:mx-0">
        <div className="grid min-w-[880px] grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
          <div />
          {proTag.map((t) => (
            <div key={t.datum} className={`border-b-2 px-2 py-2 text-sm font-semibold ${t.datum === heute ? "border-rot" : "border-tinte"}`}>
              {datumKurzText(t.datum)}
            </div>
          ))}
          <div className="relative" style={{ height: (endStunde - startStunde) * STUNDE_PX }}>
            {Array.from({ length: endStunde - startStunde }, (_, i) => (
              <span key={i} className="zahlen absolute right-2 -translate-y-1/2 text-xs text-grau" style={{ top: i * STUNDE_PX }}>
                {String(startStunde + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {proTag.map((t) => {
            const wt = String(((new Date(`${t.datum}T12:00:00Z`).getUTCDay() + 6) % 7) + 1) as keyof typeof oeffnungszeiten;
            return (
              <div key={t.datum} className="relative border-l border-linie" style={{ height: (endStunde - startStunde) * STUNDE_PX }}>
                {Array.from({ length: endStunde - startStunde }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-linie/60" style={{ top: i * STUNDE_PX }} />
                ))}
                {/* geschlossene Zeit schraffiert */}
                {(() => {
                  const fenster = oeffnungszeiten[wt];
                  const grenzen = [startStunde * 60, ...fenster.flatMap(([a, b]) => [minuten(a), minuten(b)]), endStunde * 60];
                  const zu: [number, number][] = [];
                  for (let i = 0; i < grenzen.length; i += 2) if (grenzen[i + 1] > grenzen[i]) zu.push([grenzen[i], grenzen[i + 1]]);
                  return zu.map(([a, b]) => (
                    <div key={a} className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.04)_6px_12px)]" style={{ top: ((a - startStunde * 60) / 60) * STUNDE_PX, height: ((b - a) / 60) * STUNDE_PX }} />
                  ));
                })()}
                {t.liste.map((b) => {
                  const top = ((minuten(berlinUhrzeit(b.beginn)) - startStunde * 60) / 60) * STUNDE_PX;
                  const hoehe = Math.max(((b.ende.getTime() - b.beginn.getTime()) / 3600000) * STUNDE_PX - 2, 22);
                  const breite = 100 / (b.spalten ?? 1);
                  const inhalt = (
                    <>
                      <span className="block truncate font-semibold">{zeit(b.beginn)} {b.titel}</span>
                      <span className="block truncate opacity-80">{b.unter}</span>
                    </>
                  );
                  const stil = { top, height: hoehe, left: `calc(${(b.spalte ?? 0) * breite}% + 2px)`, width: `calc(${breite}% - 4px)` };
                  const klasse = `absolute overflow-hidden rounded-sm px-1.5 py-1 text-xs leading-tight ${farbe[b.art]}`;
                  return (
                    <Link key={b.id} href={b.href} className={`${klasse} hover:ring-2 hover:ring-rot`} style={stil}>{inhalt}</Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-sm text-grau">
        <span><span className="mr-1 inline-block size-3 bg-tinte align-middle" />bestätigt</span>
        <span><span className="mr-1 inline-block size-3 bg-kreide align-middle" />angefragt</span>
      </p>
    </>
  );
}
