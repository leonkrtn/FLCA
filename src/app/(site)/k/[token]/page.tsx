import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KvAntwort } from "@/components/site/kv-antwort";
import { einstellungen } from "@/lib/einstellungen";
import { datum, datumZeit, euro, telHref } from "@/lib/format";
import { berechne } from "@/lib/rechnung/berechnung";
import { kvAbgelaufen, kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ihr Kostenvoranschlag", robots: { index: false, follow: false } };

/** Kundenlink aus der Mail: Kostenvoranschlag ansehen, als PDF laden, annehmen oder ablehnen. */
export default async function KundenKostenvoranschlag({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const k = await kvPerToken(token);
  if (!k) notFound();
  const { firma } = await einstellungen();
  const s = berechne(k.positionen);
  const abgelaufen = kvAbgelaufen(k);
  const [status, erklaerung] =
    k.status === "angenommen"
      ? ["Angenommen", `Danke! Sie haben am ${datumZeit(k.beantwortet_am)} zugesagt. Wir melden uns für den Termin.`]
      : k.status === "abgelehnt"
        ? ["Abgelehnt", "Sie haben diesen Kostenvoranschlag abgelehnt. Möchten Sie es sich anders überlegen, rufen Sie uns einfach an."]
        : abgelaufen
          ? ["Abgelaufen", `Dieser Kostenvoranschlag galt bis zum ${datum(k.gueltig_bis)}. Rufen Sie uns an, wir prüfen die Preise gern neu.`]
          : ["Offen", `Gültig bis zum ${datum(k.gueltig_bis)}. Passt alles? Dann nehmen Sie ihn unten an.`];

  return (
    <div className="rand max-w-3xl pb-24 pt-8 md:pt-14">
      <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-grau">Kostenvoranschlag {k.nummer}</p>
      {/* „Kostenvoranschlag“ ist ein langes Wort: auf schmalen Telefonen eine Stufe kleiner, sonst ragt es über den Rand. */}
      <h1 className="schmal mb-2 text-3xl break-words min-[400px]:text-4xl md:text-5xl">Ihr Kostenvoranschlag</h1>
      <p className="mb-8 text-lg">
        <span className={`mr-3 inline-block rounded-sm px-2 py-0.5 text-sm font-semibold ${k.status === "angenommen" ? "bg-white/10 text-tinte" : "bg-linie"}`}>{status}</span>
        {erklaerung}
      </p>

      <dl className="grid gap-y-4 border-t border-grau-hell pt-5 sm:grid-cols-[10rem_1fr]">
        <dt className="text-grau">Für</dt>
        <dd className="font-semibold">{[k.empfaenger.firma, k.empfaenger.name].filter(Boolean).join(", ")}</dd>
        {k.fahrzeug?.kennzeichen ? (
          <>
            <dt className="text-grau">Fahrzeug</dt>
            <dd>{[k.fahrzeug.kennzeichen, k.fahrzeug.modell].filter(Boolean).join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-grau">Datum</dt>
        <dd>{datum(k.datum)}</dd>
      </dl>

      <section className="mt-10">
        <h2 className="mb-3 font-semibold">Leistungen</h2>
        <ul className="divide-y divide-linie border-y border-linie">
          {k.positionen.map((p, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3">
              <span className="min-w-0 break-words">
                {p.text}
                <span className="block text-sm text-grau">
                  {String(p.menge).replace(".", ",")} {p.einheit} × {euro(p.einzel_brutto_cent)}
                </span>
              </span>
              <span className="zahlen text-right">{euro(s.zeilenBrutto[i])}</span>
            </li>
          ))}
        </ul>
        <dl className="zahlen ml-auto mt-3 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-right">
          <dt className="font-sans text-grau">Netto</dt>
          <dd>{euro(s.netto)}</dd>
          <dt className="font-sans text-grau">MwSt.</dt>
          <dd>{euro(s.steuer)}</dd>
          <dt className="font-sans font-semibold">Gesamt</dt>
          <dd className="text-xl font-semibold">{euro(s.brutto)}</dd>
        </dl>
        {k.hinweis ? <p className="mt-6 whitespace-pre-line">{k.hinweis}</p> : null}
      </section>

      <div className="mt-12 flex flex-wrap items-start gap-3">
        {k.status === "offen" && !abgelaufen ? <KvAntwort token={token} /> : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`/k/${token}/pdf`} className="knopf knopf-rahmen">Als PDF</a>
        <a href={telHref(firma.telefon)} className="knopf knopf-rahmen">Anrufen</a>
      </div>
    </div>
  );
}
