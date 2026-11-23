import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AbsageKnopf } from "@/components/site/absage";
import { AuftragErteilen } from "@/components/site/auftrag-erteilen";
import { VorschlagAntwort } from "@/components/site/vorschlag-antwort";
import { einstellungen } from "@/lib/einstellungen";
import { auftragStand, erteiltText } from "@/lib/auftrag-regeln";
import { datumLangText, euro, euroGenau, telHref, zeit } from "@/lib/format";
import { berechne, einzelpreisAnzeige, rabattText, zeilenbetrag } from "@/lib/rechnung/berechnung";
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
  // Anfrage zur belegten Zeit und offener Gegenvorschlag haben eigene Texte
  const vorschlag = t.status === "angefragt" && Boolean(t.vorschlag_am);
  const [status, erklaerung] = vorschlag
    ? ["Unser Vorschlag", `${t.wunsch_beginn ? `Am ${datumLangText(t.wunsch_beginn)} um ${zeit(t.wunsch_beginn)} Uhr` : "Zu Ihrer Wunschzeit"} klappt es leider nicht. Passt Ihnen dieser Termin?`]
    : t.status === "angefragt" && t.wunschzeit_frei === false
      ? ["Angefragt", "Zu dieser Zeit ist es bei uns eng. Wir melden uns mit einer Zusage oder einem anderen Vorschlag."]
      : STATUS[t.status];
  const absagbar =
    t.status === "angefragt" || (t.status === "bestaetigt" && new Date(t.beginn).getTime() - jetztMs() >= buchung.stornoFristStd * 3600000);

  return (
    <div className="rand pb-24 *:max-w-3xl pt-8 md:pt-14">
      <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-grau">Ihr Termin</p>
      <h1 className="schmal mb-2 text-4xl md:text-5xl">{t.leistung_name}</h1>
      <p className="mb-8 text-lg">
        <span className={`mr-3 inline-block px-2 py-0.5 text-sm font-semibold ${t.status === "bestaetigt" ? "bg-white/10 text-tinte" : "bg-linie"}`}>{status}</span>
        {erklaerung}
      </p>
      <dl className="grid gap-y-4 border-t border-grau-hell pt-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-grau">{vorschlag ? "Vorschlag" : "Wann"}</dt>
        <dd className="font-semibold">
          {datumLangText(t.beginn)}, {zeit(t.beginn)} Uhr
        </dd>
        {vorschlag && t.vorschlag_nachricht ? (
          <>
            <dt className="text-grau">Nachricht</dt>
            <dd className="whitespace-pre-line">{t.vorschlag_nachricht}</dd>
          </>
        ) : null}
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

      {t.auftrag_nummer ? <Auftrag t={t} token={token} /> : null}

      {rechnungen?.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-semibold">Rechnung</h2>
          <ul className="border-t border-linie">
            {rechnungen.map((r) => (
              <li key={r.token} className="flex items-center justify-between gap-3 border-b border-linie py-3">
                <span className="min-w-0">
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
        {vorschlag ? <VorschlagAntwort token={token} /> : null}
        {absagbar && !vorschlag ? <AbsageKnopf token={token} /> : null}
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

/** Werkstattauftrag für den Kunden: was gemacht wird, zu welchem Preis, und (solange offen) Auftrag erteilen. */
function Auftrag({ t, token }: { t: NonNullable<Awaited<ReturnType<typeof terminPerToken>>>; token: string }) {
  const positionen = t.auftrag_positionen ?? [];
  const s = berechne(positionen);
  const erteilt = auftragStand(t) === "erteilt";
  const offen = ["angefragt", "bestaetigt", "erledigt"].includes(t.status);
  return (
    <section id="auftrag" className="mt-10 scroll-mt-24">
      <h2 className="mb-1 font-semibold">Werkstattauftrag {t.auftrag_nummer}</h2>
      <p className="mb-4 text-grau">{erteilt ? `${erteiltText(t)}.` : "Bitte prüfen Sie die Arbeiten und erteilen Sie uns den Auftrag."}</p>
      {t.auftrag_beschreibung ? <p className="mb-4 whitespace-pre-line">Ihr Anliegen: {t.auftrag_beschreibung}</p> : null}
      {positionen.length ? (
        <>
          <ul className="divide-y divide-linie border-y border-linie">
            {positionen.map((p, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3">
                <span className="min-w-0 break-words">
                  {p.rabatt ? rabattText(p) : p.text}
                  {p.rabatt ? null : (
                    <span className="block text-sm text-grau">
                      {String(p.menge).replace(".", ",")} {p.einheit} × {euroGenau(einzelpreisAnzeige(p, s, i))}
                      {s.preisart === "netto" ? " netto" : ""}
                    </span>
                  )}
                </span>
                <span className="zahlen text-right">{euro(zeilenbetrag(s, i))}</span>
              </li>
            ))}
          </ul>
          <dl className="zahlen ml-auto mt-3 grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 text-right">
            <dt className="font-sans text-grau">Netto</dt>
            <dd>{euro(s.netto)}</dd>
            <dt className="font-sans text-grau">MwSt.</dt>
            <dd>{euro(s.steuer)}</dd>
            <dt className="font-sans font-semibold">Voraussichtlich</dt>
            <dd className="text-xl font-semibold">{euro(s.brutto)}</dd>
          </dl>
        </>
      ) : null}
      {t.auftrag_kostengrenze_cent != null ? (
        <p className="mt-4">Kostengrenze: Arbeiten bis {euro(t.auftrag_kostengrenze_cent)} sind freigegeben. Was darüber hinausgeht, besprechen wir vorher mit Ihnen.</p>
      ) : null}
      <div className="mt-6 grid gap-4">
        {!erteilt && offen && positionen.length ? <AuftragErteilen token={token} name={t.kunde?.name ?? ""} /> : null}
        <a href={`/t/${token}/auftrag`} className="knopf knopf-rahmen justify-self-start">Auftrag als PDF</a>
      </div>
    </section>
  );
}

