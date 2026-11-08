import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { TerminAktionen } from "@/components/admin/termin-aktionen";
import { Abschnitt, Auswahl, Feld, Kopf, Marke, Textfeld } from "@/components/admin/ui";
import { ablehnenAktion, absagenAktion, bestaetigenAktion, detailsSpeichern, erledigtAktion, rechnungAusTermin, verschiebenAktion } from "@/lib/aktionen/termine";
import { benutzerMitRecht } from "@/lib/auth";
import { datumLangText, datumZeit, euro, telHref, zeit } from "@/lib/format";
import { RECHNUNG_STATUS } from "@/lib/rechnung/rechnungen";
import { TERMIN_TON } from "@/lib/status";
import { terminZusatz } from "@/lib/termin-daten";
import { STATUS_TEXT, terminLaden } from "@/lib/termine";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

export default async function TerminDetail({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("termine");
  const { id } = await params;
  const t = await terminLaden(id);
  if (!t) notFound();
  const z = await terminZusatz(id);
  const haltAbgelaufen = t.status === "angefragt" && t.halten_bis && new Date(t.halten_bis) < new Date();

  return (
    <>
      <Kopf
        zurueck={{ href: "/admin/termine", text: "Termine" }}
        titel={t.leistung_name}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>
            <span>
              {datumLangText(t.beginn)}, {zeit(t.beginn)} bis {zeit(t.ende)} Uhr · Nr. {t.nummer} · {t.quelle === "website" ? "über die Website" : "eingetragen"}
            </span>
          </span>
        }
      />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <Abschnitt titel="Kunde">
            <dl className="grid gap-y-2 sm:grid-cols-[9rem_1fr]">
              <dt className="text-grau">Name</dt>
              <dd>
                {t.kunde ? (
                  <Link href={`/admin/kunden/${t.kunde.id}`} className="font-semibold hover:underline">
                    {t.kunde.name}
                  </Link>
                ) : "–"}
              </dd>
              <dt className="text-grau">Telefon</dt>
              <dd>{t.kunde?.telefon ? <a href={telHref(t.kunde.telefon)} className="underline">{t.kunde.telefon}</a> : "–"}</dd>
              <dt className="text-grau">E-Mail</dt>
              <dd className="break-all">{t.kunde?.email || "–"}</dd>
              <dt className="text-grau">Fahrzeug</dt>
              <dd>{t.fahrzeug ? [t.fahrzeug.kennzeichen, t.fahrzeug.marke_modell].filter(Boolean).join(", ") : "–"}</dd>
              {t.notiz_kunde ? (
                <>
                  <dt className="text-grau">Nachricht</dt>
                  <dd className="whitespace-pre-line">{t.notiz_kunde}</dd>
                </>
              ) : null}
            </dl>
          </Abschnitt>

          <Abschnitt titel="Werkstatt">
            <Formular aktion={detailsSpeichern.bind(null, t.id)} className="grid gap-4 sm:grid-cols-2">
              <Auswahl label="Mitarbeiter" name="zugewiesen_an" wert={t.zugewiesen_an} leer="niemand" optionen={z.team.map((p) => [p.id, p.name || "ohne Namen"])} />
              <Feld label="Kilometerstand" name="km_stand" wert={t.km_stand} inputMode="numeric" />
              <Textfeld label="Interne Notiz" name="notiz_intern" wert={t.notiz_intern} zeilen={3} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <Senden vorab="Gespeichert">Speichern</Senden>
              </div>
            </Formular>
            {z.fotos.length ? (
              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {z.fotos.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-boden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.notiz || "Foto vom Fahrzeug"} className="size-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
          </Abschnitt>

          <Abschnitt titel="Verlauf">
            <ul className="space-y-2 text-sm">
              {z.verlauf.map((v, i) => (
                <li key={i} className="flex gap-4">
                  <span className="zahlen shrink-0 text-grau">{datumZeit(v.erstellt_am)}</span>
                  <span>
                    {v.text}
                    {v.profil?.name ? <span className="text-grau"> · {v.profil.name}</span> : null}
                  </span>
                </li>
              ))}
              <li className="flex gap-4">
                <span className="zahlen shrink-0 text-grau">{datumZeit(t.erstellt_am)}</span>
                <span>{t.quelle === "website" ? "Anfrage über die Website" : "Angelegt"}</span>
              </li>
            </ul>
          </Abschnitt>
        </div>

        <div>
          <Abschnitt titel="Entscheidung">
            {haltAbgelaufen ? <p className="mb-3 text-sm text-warnung">Die Haltezeit ist abgelaufen. Der Slot ist eventuell schon an jemand anderen vergeben.</p> : null}
            <TerminAktionen
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
          </Abschnitt>
          <Abschnitt titel="Rechnung">
            {z.rechnungen.length ? (
              <ul className="mb-4 space-y-2">
                {z.rechnungen.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/rechnungen/${r.id}`} className="flex justify-between gap-2 hover:underline">
                      <span>{r.nummer ? <>{r.nummer} <span className="text-grau">· {RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS]}</span></> : "Entwurf"}</span>
                      <span className="zahlen">{euro(r.summe_brutto_cent)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {!z.rechnungen.some((r) => r.status !== "storniert" && !r.storno_zu) ? (
              <form action={rechnungAusTermin.bind(null, t.id, "/admin/rechnungen")}>
                <button className="knopf knopf-dunkel w-full">Rechnung erstellen</button>
              </form>
            ) : null}
          </Abschnitt>
          <p className="px-1 text-sm text-grau">
            Link für den Kunden: <a href={`/t/${t.token}`} className="underline" target="_blank">Terminseite</a>
          </p>
        </div>
      </div>
    </>
  );
}
