import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Zurueck } from "@/components/icons";
import { absaetze, preis } from "@/lib/format";
import { oeffentlicheLeistungen } from "@/lib/inhalte";
import { websiteDatei } from "@/lib/supabase/admin";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await oeffentlicheLeistungen()).map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = (await oeffentlicheLeistungen()).find((x) => x.slug === slug);
  return l ? { title: l.name, description: `${l.name} in Dietzenbach: ${l.kurz}. ${l.preis_cent ? preis(l.preis_cent, l.preis_ab) : ""}` } : {};
}

export default async function LeistungSeite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = (await oeffentlicheLeistungen()).find((x) => x.slug === slug);
  if (!l) notFound();
  const bild = websiteDatei(l.bild_pfad);
  const dauer = l.dauer_min >= 420 ? "ganzer Tag" : l.dauer_min >= 60 ? `ca. ${String(Math.round((l.dauer_min / 60) * 2) / 2).replace(".", ",")} Stunden` : `ca. ${l.dauer_min} Minuten`;
  return (
    <div className="rand grid gap-10 pb-24 pt-8 md:grid-cols-12 md:pt-14">
      <div className="md:col-span-7">
        <Link href="/leistungen" className="mb-8 inline-flex items-center gap-2 text-sm text-grau hover:text-tinte">
          <Zurueck className="size-4" /> Alle Leistungen
        </Link>
        <h1 className="schmal mb-6 text-4xl md:text-6xl">{l.name}</h1>
        <div className="fliesstext max-w-prose text-lg">
          {absaetze(l.beschreibung).map((a) => (
            <p key={a.slice(0, 24)}>{a}</p>
          ))}
        </div>
        <dl className="mt-10 grid max-w-md grid-cols-2 border-t border-grau-hell pt-4">
          <div>
            <dt className="text-sm text-grau">Preis</dt>
            <dd className="zahlen text-2xl">{preis(l.preis_cent, l.preis_ab)}</dd>
          </div>
          <div>
            <dt className="text-sm text-grau">Dauer</dt>
            <dd className="text-lg">{dauer}</dd>
          </div>
        </dl>
        {l.online_anfragbar ? (
          <Link href={`/termin?leistung=${l.slug}`} className="knopf knopf-rot mt-10">
            Termin für {l.name} anfragen
          </Link>
        ) : null}
      </div>
      {bild ? (
        <div className="relative aspect-[4/5] md:col-span-5">
          <Image src={bild} alt={l.name} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
        </div>
      ) : null}
    </div>
  );
}
