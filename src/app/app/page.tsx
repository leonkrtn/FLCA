import Link from "next/link";
import { Marke } from "@/components/admin/ui";
import { PushHinweis } from "@/components/mobil/push-abgleich";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datumLangText, zeit } from "@/lib/format";
import { faelligeAnzahl } from "@/lib/notizen";
import { darf } from "@/lib/rollen";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { weich } from "@/lib/fehler";
import { auftraegeOhneTerminAnzahl, type GeplanterTermin, STATUS_TEXT, TERMIN_FELDER } from "@/lib/termine";
import { berlin, berlinDatum, istDatum, plusTage } from "@/lib/zeit";

export const metadata = { title: "Heute" };

export default async function Heute({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const b = await benutzerMitRecht("termine");
  const { tag: t } = await searchParams;
  const heute = berlinDatum();
  const tag = istDatum(t) ? t : heute;
  const [{ data }, erinnerungen, wartend] = await Promise.all([
    db()
      .from("termine")
      .select(TERMIN_FELDER)
      .in("status", ["angefragt", "bestaetigt", "erledigt", "nicht_erschienen"])
      .gte("beginn", berlin(tag).toISOString())
      .lt("beginn", berlin(plusTage(tag, 1)).toISOString())
      .order("beginn"),
    darf(b.rolle, "notizen") ? faelligeAnzahl(b) : 0,
    weich(auftraegeOhneTerminAnzahl(), 0, "Werkstatt-App: Aufträge ohne Termin zählen"),
  ]);
  // Nach Zeitraum gefragt: Jeder Treffer hat eine Zeit.
  const termine = (data ?? []) as GeplanterTermin[];
  const name = tag === heute ? "Heute" : tag === plusTage(heute, 1) ? "Morgen" : datumLangText(tag);
  return (
    <>
      <MobilKopf
        titel={name}
        unter={tag === heute || tag === plusTage(heute, 1) ? datumLangText(tag) : `${termine.length} Termine`}
        aktion={
          <div className="flex gap-1">
            <Link href={`/app?tag=${plusTage(tag, -1)}`} className="knopf knopf-rahmen knopf-klein w-10 px-0" aria-label="Tag zurück">←</Link>
            <Link href={`/app?tag=${plusTage(tag, 1)}`} className="knopf knopf-rahmen knopf-klein w-10 px-0" aria-label="Tag vor">→</Link>
          </div>
        }
      />
      <PushHinweis />
      {erinnerungen ? (
        <Link href="/app/notizen?ansicht=erinnerungen" className="flex items-center justify-between gap-3 border-b border-linie bg-kreide px-4 py-3 font-semibold text-tinte">
          {erinnerungen === 1 ? "1 Erinnerung fällig" : `${erinnerungen} Erinnerungen fällig`}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
      {wartend ? (
        <Link href="/app/ohne-termin" className="flex items-center justify-between gap-3 border-b border-linie bg-papier px-4 py-3 font-semibold text-tinte">
          {wartend === 1 ? "1 Auftrag wartet auf einen Termin" : `${wartend} Aufträge warten auf einen Termin`}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
      <div className="grid grid-cols-1 gap-px bg-linie">
        {termine.map((x) => (
          <Karte key={x.id} href={`/app/termine/${x.id}`}>
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className="zahlen text-lg">{zeit(x.beginn)}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{x.leistung_name}</span>
                <span className="block truncate text-sm text-grau">{[x.fahrzeug?.kennzeichen, x.kunde?.name].filter(Boolean).join(" · ")}</span>
              </span>
              <Marke ton={TERMIN_TON[x.status]}>{STATUS_TEXT[x.status]}</Marke>
            </div>
          </Karte>
        ))}
      </div>
      {!termine.length ? <p className="px-4 py-10 text-center text-grau">Keine Termine.</p> : null}
      {tag !== heute ? (
        <p className="px-4 pt-4">
          <Link href="/app" className="text-sm underline">zu heute</Link>
        </p>
      ) : null}
    </>
  );
}
