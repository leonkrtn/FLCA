import Link from "next/link";
import { notFound } from "next/navigation";
import { TerminAktionen } from "@/components/admin/termin-aktionen";
import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { ablehnenAktion, absagenAktion, bestaetigenAktion, erledigtAktion, rechnungAusTermin, verschiebenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { datumLangText, euro, telHref, whatsappHref, zeit } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, terminLaden } from "@/lib/termine";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

export default async function AppTermin({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("termine");
  const { id } = await params;
  const t = await terminLaden(id);
  if (!t) notFound();
  const { data: rechnungen } = await db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, storno_zu").eq("termin_id", id);
  const offene = (rechnungen ?? []).find((r) => r.status !== "storniert" && !r.storno_zu);
  return (
    <>
      <MobilKopf titel={t.leistung_name} unter={`${datumLangText(t.beginn)}, ${zeit(t.beginn)}–${zeit(t.ende)} Uhr`} zurueck="/app" aktion={<Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>} />
      <div className="grid gap-2 p-2">
        <Karte>
          <p className="text-lg font-semibold">{t.kunde?.name}</p>
          <p className="text-grau">{[t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
          {t.notiz_kunde ? <p className="mt-2 whitespace-pre-line">„{t.notiz_kunde}“</p> : null}
          {t.notiz_intern ? <p className="mt-2 text-sm text-grau">Intern: {t.notiz_intern}</p> : null}
          {t.kunde?.telefon ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={telHref(t.kunde.telefon)} className="knopf knopf-rahmen">Anrufen</a>
              <a href={whatsappHref(t.kunde.telefon.replace(/^0/, "49"))} className="knopf knopf-rahmen" rel="noopener noreferrer">WhatsApp</a>
            </div>
          ) : null}
        </Karte>
        <Karte>
          <TerminAktionen
            gross
            status={t.status}
            datum={berlinDatum(new Date(t.beginn))}
            uhrzeit={berlinUhrzeit(new Date(t.beginn))}
            aktionen={{
              bestaetigen: bestaetigenAktion.bind(null, t.id),
              ablehnen: ablehnenAktion.bind(null, t.id),
              absagen: absagenAktion.bind(null, t.id),
              verschieben: verschiebenAktion.bind(null, t.id),
              erledigt: erledigtAktion.bind(null, t.id),
            }}
          />
          {!["angefragt", "bestaetigt"].includes(t.status) ? <p className="text-grau">Keine offene Entscheidung.</p> : null}
        </Karte>
        <Karte>
          {offene ? (
            <Link href={`/app/rechnungen/${offene.id}`} className="flex items-center justify-between">
              <span className="font-semibold">{offene.nummer ? `Rechnung ${offene.nummer}` : "Rechnungsentwurf"}</span>
              <span className="zahlen">{euro(offene.summe_brutto_cent)}</span>
            </Link>
          ) : (
            <form action={rechnungAusTermin.bind(null, t.id, "/app/rechnungen")}>
              <button className="knopf knopf-dunkel w-full">Rechnung erstellen</button>
            </form>
          )}
        </Karte>
      </div>
    </>
  );
}
