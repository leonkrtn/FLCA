import Link from "next/link";
import { Senden } from "@/components/admin/formular";
import { notFound } from "next/navigation";
import { AnnahmeFormular, AuftragBereich, KvAmTerminBereich } from "@/components/admin/auftrag";
import { TerminAktionen } from "@/components/admin/termin-aktionen";
import { TerminLoeschen } from "@/components/admin/termin-loeschen";
import { AusDerWerkstatt } from "@/components/admin/werkstatt-meldungen";
import { Marke } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { ablehnenAktion, absagenAktion, bestaetigenAktion, erledigtAktion, gegenvorschlagAktion, rechnungAusTermin, verschiebenAktion } from "@/lib/aktionen/termine";
import { auftragLaden } from "@/lib/auftrag";
import { AUFTRAG_STAND_TEXT, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { darf } from "@/lib/rollen";
import { kvsZumTermin, terminZusatz } from "@/lib/termin-daten";
import { datumLangText, euro, telHref, whatsappHref, zeit } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { anfrageLage, STATUS_TEXT } from "@/lib/termine";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

export default async function AppTermin({ params }: { params: Promise<{ id: string }> }) {
  const b = await benutzerMitRecht("termine");
  const { id } = await params;
  const t = await auftragLaden(id);
  if (!t) notFound();
  const mitRechnungen = darf(b.rolle, "rechnungen");
  const [{ data: rechnungen }, lage, z, kvs] = await Promise.all([
    db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, storno_zu").eq("termin_id", id),
    t.status === "angefragt" ? anfrageLage(t) : Promise.resolve(undefined),
    terminZusatz(id),
    mitRechnungen ? kvsZumTermin(id, t.kunde?.id ?? null) : Promise.resolve(null),
  ]);
  const stand = auftragStand(t);
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
              <a href={whatsappHref(t.kunde.telefon)} className="knopf knopf-rahmen" rel="noopener noreferrer">WhatsApp</a>
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
              gegenvorschlag: gegenvorschlagAktion.bind(null, t.id),
            }}
            lage={lage}
            vorschlagOffen={t.status === "angefragt" && t.vorschlag_am ? "Vorschlag ist beim Kunden, er sagt über seinen Link zu oder ab." : undefined}
          />
          {!["angefragt", "bestaetigt"].includes(t.status) ? <p className="text-grau">Keine offene Entscheidung.</p> : null}
        </Karte>
        <Karte>
          <h2 className="mb-3 flex items-center justify-between gap-2 font-semibold">
            Werkstattauftrag
            {stand === "kein" ? null : <span className="text-sm font-normal text-grau">{AUFTRAG_STAND_TEXT[stand]}</span>}
          </h2>
          <AuftragBereich t={t} ort="app" />
        </Karte>
        {/* Befunde, angeforderte Teile und Arbeitszeit aus der Team-App; ohne sie bleibt die Karte weg */}
        <div className="bg-flaeche px-4 py-3 empty:hidden">
          <AusDerWerkstatt terminId={t.id} basis="/app" titel="Aus der Werkstatt" />
        </div>
        <Karte>
          <details open={stand !== "kein" && !t.annahme?.tank && t.km_stand == null}>
            <summary className="cursor-pointer font-semibold">Fahrzeugannahme</summary>
            <div className="mt-3">
              <AnnahmeFormular t={t} fotos={z.fotos} kompakt />
            </div>
          </details>
        </Karte>
        {kvs ? (
          <Karte>
            <h2 className="mb-3 font-semibold">Kostenvoranschlag</h2>
            <KvAmTerminBereich terminId={t.id} ort="app" kvs={kvs} />
          </Karte>
        ) : null}
        <Karte>
          {offene ? (
            <Link href={`/app/rechnungen/${offene.id}`} className="flex items-center justify-between gap-3">
              <span className="min-w-0 font-semibold">{offene.nummer ? `Rechnung ${offene.nummer}` : "Rechnungsentwurf bearbeiten"}</span>
              <span className="zahlen shrink-0">{euro(offene.summe_brutto_cent)}</span>
            </Link>
          ) : (
            <form action={rechnungAusTermin.bind(null, t.id, "/app/rechnungen")}>
              <Senden className="w-full">Rechnung erstellen</Senden>
            </form>
          )}
        </Karte>
        <Karte>
          <Link href={`/app/notizen/neu?termin=${t.id}`} className="knopf knopf-rahmen w-full">Notiz zum Termin</Link>
        </Karte>
        <Karte>
          <TerminLoeschen id={t.id} nummer={t.nummer} status={t.status} ziel="/app" gross />
        </Karte>
      </div>
    </>
  );
}
