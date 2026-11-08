import Link from "next/link";
import { notFound } from "next/navigation";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datumKurzText, zeit } from "@/lib/format";
import { berlinDatum, jetztMs } from "@/lib/zeit";
import { monatszeiten, stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Zeiten" };

export default async function Zeiten({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const b = await benutzerMitRecht("werkstatt");
  const { module } = await einstellungen();
  if (!module.zeiterfassung || !b.zeiterfassung) notFound();
  const { monat: m } = await searchParams;
  const monat = m && /^\d{4}-\d{2}$/.test(m) ? m : berlinDatum().slice(0, 7);
  const { eintraege, minuten } = await monatszeiten(b.id, monat);
  const vor = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const nach = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)), 1)).toISOString().slice(0, 7);
  return (
    <>
      <MobilKopf
        titel={`${monat.slice(5)}/${monat.slice(0, 4)}: ${stunden(minuten)}`}
        unter="Korrekturen trägt der Inhaber ein"
        aktion={
          <div className="flex gap-1">
            <Link href={`?monat=${vor}`} className="knopf knopf-rahmen knopf-klein w-10 px-0" aria-label="Vormonat">←</Link>
            <Link href={`?monat=${nach}`} className="knopf knopf-rahmen knopf-klein w-10 px-0" aria-label="Nächster Monat">→</Link>
          </div>
        }
      />
      <div className="grid gap-px bg-linie">
        {eintraege.map((z) => (
          <Karte key={z.id}>
            <div className="zahlen grid grid-cols-[6rem_1fr_auto] gap-3">
              <span className="font-sans">{datumKurzText(z.beginn)}</span>
              <span>{zeit(z.beginn)}–{z.ende ? zeit(z.ende) : "läuft"}</span>
              <span className="text-right">{stunden(Math.round(((z.ende ? new Date(z.ende).getTime() : jetztMs()) - new Date(z.beginn).getTime()) / 60000))}</span>
            </div>
          </Karte>
        ))}
      </div>
      {!eintraege.length ? <p className="px-4 py-10 text-center text-grau">Keine Einträge.</p> : null}
    </>
  );
}
