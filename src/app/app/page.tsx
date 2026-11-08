import Link from "next/link";
import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { datumLangText, zeit } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, istDatum, plusTage } from "@/lib/zeit";

export const metadata = { title: "Heute" };

export default async function Heute({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  await benutzerMitRecht("termine");
  const { tag: t } = await searchParams;
  const heute = berlinDatum();
  const tag = istDatum(t) ? t : heute;
  const { data } = await db()
    .from("termine")
    .select(TERMIN_FELDER)
    .in("status", ["angefragt", "bestaetigt", "erledigt", "nicht_erschienen"])
    .gte("beginn", berlin(tag).toISOString())
    .lt("beginn", berlin(plusTage(tag, 1)).toISOString())
    .order("beginn");
  const termine = (data ?? []) as Termin[];
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
      <div className="grid gap-px bg-linie">
        {termine.map((x) => (
          <Karte key={x.id} href={`/app/termine/${x.id}`}>
            <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
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
