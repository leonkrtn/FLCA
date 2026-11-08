import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AbsageKnopf } from "@/components/site/absage";
import { einstellungen } from "@/lib/einstellungen";
import { datumLangText, euro, telHref, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { terminPerToken } from "@/lib/termine";
import { jetztMs } from "@/lib/zeit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ihr Termin", robots: { index: false, follow: false } };

const STATUS: Record<string, [string, string]> = {
  angefragt: ["Angefragt", "Wir halten den Termin für Sie frei und bestätigen ihn per E-Mail."],
  bestaetigt: ["Bestätigt", "Ihr Termin steht. Wir freuen uns auf Sie."],
  abgelehnt: ["Nicht möglich", "Zu dieser Zeit klappt es leider nicht. Bitte wählen Sie einen anderen Termin."],
  storniert: ["Abgesagt", "Dieser Termin ist abgesagt."],
  erledigt: ["Erledigt", "Danke für Ihren Besuch."],
  nicht_erschienen: ["Abgeschlossen", ""],
};

export default async function KundenTermin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await terminPerToken(token);
  if (!t) notFound();
  const { firma, buchung } = await einstellungen();
  const { data: rechnungen } = await db()
    .from("rechnungen")
    .select("nummer, token, summe_brutto_cent, status, storno_zu")
    .eq("termin_id", t.id)
    .in("status", ["gestellt", "bezahlt", "storniert"]);
  const [status, erklaerung] = STATUS[t.status];
  const absagbar =
    t.status === "angefragt" || (t.status === "bestaetigt" && new Date(t.beginn).getTime() - jetztMs() >= buchung.stornoFristStd * 3600000);

  return (
    <div className="rand max-w-3xl pb-24 pt-8 md:pt-14">
      <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-grau">Termin Nr. {t.nummer}</p>
      <h1 className="schmal mb-2 text-4xl md:text-5xl">{t.leistung_name}</h1>
      <p className="mb-8 text-lg">
        <span className={`mr-3 inline-block px-2 py-0.5 text-sm font-semibold ${t.status === "bestaetigt" ? "bg-tinte text-weiss" : "bg-linie"}`}>{status}</span>
        {erklaerung}
      </p>
      <dl className="grid gap-y-4 border-t-2 border-tinte pt-5 sm:grid-cols-[10rem_1fr]">
        <dt className="text-grau">Wann</dt>
        <dd className="font-semibold">
          {datumLangText(t.beginn)}, {zeit(t.beginn)} Uhr
        </dd>
        {t.fahrzeug ? (
          <>
            <dt className="text-grau">Fahrzeug</dt>
            <dd>{[t.fahrzeug.kennzeichen, t.fahrzeug.marke_modell].filter(Boolean).join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-grau">Wo</dt>
        <dd>
          {firma.strasse}, {firma.plz} {firma.ort}
          <br />
          <span className="text-grau">{firma.hinweisAnfahrt}</span>
        </dd>
      </dl>

      {rechnungen?.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Rechnung</h2>
          <ul className="border-t border-linie">
            {rechnungen.map((r) => (
              <li key={r.token} className="flex items-center justify-between border-b border-linie py-3">
                <span>
                  {r.storno_zu ? "Stornorechnung" : "Rechnung"} {r.nummer} <span className="zahlen ml-2 text-grau">{euro(r.summe_brutto_cent)}</span>
                </span>
                <a href={`/r/${r.token}`} className="font-semibold underline">
                  PDF
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-12 flex flex-wrap items-start gap-3">
        {absagbar ? <AbsageKnopf token={token} /> : null}
        <a href={telHref(firma.telefon)} className="knopf knopf-rahmen">
          Anrufen
        </a>
        {["abgelehnt", "storniert"].includes(t.status) ? (
          <Link href="/termin" className="knopf knopf-rot">
            Neuen Termin wählen
          </Link>
        ) : null}
      </div>
      {t.status === "bestaetigt" && !absagbar ? (
        <p className="mt-4 text-sm text-grau">Online absagen geht nur bis {buchung.stornoFristStd} Stunden vorher. Bitte rufen Sie uns an.</p>
      ) : null}
    </div>
  );
}
