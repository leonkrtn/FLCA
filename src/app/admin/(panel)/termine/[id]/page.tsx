import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnahmeFormular, AuftragBereich, KvAmTerminBereich } from "@/components/admin/auftrag";
import { Absenden, Formular, Senden } from "@/components/admin/formular";
import { NotizenAbschnitt } from "@/components/admin/notizen";
import { TerminAktionen } from "@/components/admin/termin-aktionen";
import { AusDerWerkstatt } from "@/components/admin/werkstatt-meldungen";
import { TerminKundeAendern } from "@/components/admin/termin-kunde-aendern";
import { TerminLoeschen } from "@/components/admin/termin-loeschen";
import { Abschnitt, Auswahl, Kopf, Marke, Textfeld } from "@/components/admin/ui";
import {
  ablehnenAktion,
  absagenAktion,
  bestaetigenAktion,
  detailsSpeichern,
  einplanenAktion,
  erledigtAktion,
  gegenvorschlagAktion,
  kundeVerknuepfen,
  rechnungAusTermin,
  rechnungLoesen,
  rechnungVerknuepfen,
  verschiebenAktion,
} from "@/lib/aktionen/termine";
import { auftragLaden } from "@/lib/auftrag";
import { AUFTRAG_STAND_TEXT, AUFTRAG_STAND_TON, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, datumLangText, datumZeit, euro, preis, telHref, zeit } from "@/lib/format";
import { kalenderHref, kalLesen, kalWert } from "@/lib/kalender-ansicht";
import { kundenSuchen } from "@/lib/kunden";
import { RECHNUNG_STATUS } from "@/lib/rechnung/rechnungen";
import { darf } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { TERMIN_TON } from "@/lib/status";
import { freieRechnungen, kvsZumTermin, terminZusatz } from "@/lib/termin-daten";
import { anfrageLage, einplanenVorgabe, STATUS_TEXT } from "@/lib/termine";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";

export default async function TerminDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kal?: string }> }) {
  const b = await benutzerMitRecht("termine");
  const { id } = await params;
  // Aus dem Kalender geöffnet: „Zurück“ und Löschen führen in genau diese Ansicht
  const kal = kalLesen((await searchParams).kal);
  const t = await auftragLaden(id);
  if (!t) notFound();
  const mitRechnungen = darf(b.rolle, "rechnungen");
  const [z, zuletzt, frei, lage, kvs, vorgabe] = await Promise.all([
    terminZusatz(id),
    darf(b.rolle, "kunden") ? kundenSuchen("", 8) : Promise.resolve([]),
    mitRechnungen ? freieRechnungen(t.kunde?.id ?? null) : Promise.resolve([]),
    t.status === "angefragt" ? anfrageLage(t) : Promise.resolve(undefined),
    mitRechnungen ? kvsZumTermin(id, t.kunde?.id ?? null) : Promise.resolve(null),
    t.beginn ? Promise.resolve(null) : einplanenVorgabe(t),
  ]);
  const stand = auftragStand(t);
  const entwurf = z.rechnungen.find((r) => r.status === "entwurf" && !r.storno_zu);
  const angebotPreise = Object.entries(t.angebot_preise ?? {});
  // Namen stehen nur als Text am Termin; je Leistung den Namen aus der Preisliste holen
  const { data: namen } = angebotPreise.length ? await db().from("leistungen").select("id, name").in("id", angebotPreise.map(([lid]) => lid)) : { data: [] };
  const leistungName = (lid: string) => (namen ?? []).find((n) => n.id === lid)?.name ?? "Leistung";
  // Anfragen zu einer belegten Zeit halten von Anfang an nichts; dort ist der Hinweis überflüssig.
  const haltAbgelaufen = t.status === "angefragt" && t.wunschzeit_frei !== false && t.halten_bis && new Date(t.halten_bis) < new Date();
  const vorschlagOffen =
    t.status === "angefragt" && t.vorschlag_am && t.beginn
      ? `Vorschlag ${datumLangText(t.beginn)}, ${zeit(t.beginn)} Uhr ist beim Kunden (gesendet ${datumZeit(t.vorschlag_am)}${t.wunsch_beginn ? `, Wunsch war ${datumLangText(t.wunsch_beginn)}, ${zeit(t.wunsch_beginn)} Uhr` : ""}). Er sagt über seinen Link zu oder ab.`
      : undefined;

  return (
    <>
      <Kopf
        zurueck={kal ? { href: kalenderHref(kal), text: "Kalender" } : { href: "/admin/termine", text: "Termine" }}
        titel={t.leistung_name}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>
            {stand !== "kein" ? <Marke ton={AUFTRAG_STAND_TON[stand]}>{`Auftrag ${AUFTRAG_STAND_TEXT[stand].toLowerCase()}`}</Marke> : null}
            <span>
              {t.beginn && t.ende ? `${datumLangText(t.beginn)}, ${zeit(t.beginn)} bis ${zeit(t.ende)} Uhr` : "noch ohne Termin"} ·{" "}
              {t.quelle === "website" ? "über die Website" : "eingetragen"}
            </span>
          </span>
        }
      >
        <TerminLoeschen id={t.id} status={t.status} ziel="/admin/termine" kal={kal ? kalWert(kal) : undefined} />
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <Abschnitt titel="Kunde">
            <dl className="grid gap-y-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
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
              {angebotPreise.length ? (
                <>
                  <dt className="text-grau">Angebot</dt>
                  <dd>
                    {/* Am Tag der Anfrage festgehalten; die Rechnung zum Termin nimmt diesen Preis. */}
                    {angebotPreise.map(([lid, a]) => (
                      <span key={lid} className="block">
                        {a.titel} {a.rabatt}
                        {a.cent !== null && a.listen_cent !== null ? (
                          <span className="tabular-nums text-grau">
                            {" "}
                            · {leistungName(lid)} {preis(a.cent)} statt {preis(a.listen_cent)}
                          </span>
                        ) : (
                          <span className="text-grau"> · {leistungName(lid)}</span>
                        )}
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
              {t.notiz_kunde ? (
                <>
                  <dt className="text-grau">Nachricht</dt>
                  <dd className="whitespace-pre-line">{t.notiz_kunde}</dd>
                </>
              ) : null}
            </dl>
            {darf(b.rolle, "kunden") ? <TerminKundeAendern hatKunde={Boolean(t.kunde)} zuletzt={zuletzt} aktion={kundeVerknuepfen.bind(null, t.id)} /> : null}
          </Abschnitt>

          <Abschnitt titel="Werkstattauftrag">
            <AuftragBereich t={t} ort="admin" kal={kal} />
          </Abschnitt>

          <Abschnitt titel="Fahrzeugannahme">
            <AnnahmeFormular t={t} fotos={z.fotos} />
          </Abschnitt>

          <Abschnitt titel="Werkstatt">
            <div className="mb-6 empty:hidden">
              <AusDerWerkstatt terminId={t.id} />
            </div>
            <Formular aktion={detailsSpeichern.bind(null, t.id)} className="grid gap-4 sm:grid-cols-2">
              <Auswahl label="Mitarbeiter" name="zugewiesen_an" wert={t.zugewiesen_an} leer="niemand" optionen={z.team.map((p) => [p.id, p.name || "ohne Namen"])} />
              <Textfeld label="Interne Notiz" name="notiz_intern" wert={t.notiz_intern} zeilen={3} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <Senden vorab="Gespeichert">Speichern</Senden>
              </div>
            </Formular>
            {z.fotos.some((f) => f.art !== "vorschaden") ? (
              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {z.fotos.filter((f) => f.art !== "vorschaden").map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-boden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.notiz || "Foto vom Fahrzeug"} className="size-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : null}
          </Abschnitt>

          {darf(b.rolle, "notizen") ? <NotizenAbschnitt b={b} terminId={t.id} /> : null}

          <Abschnitt titel="Verlauf">
            <ul className="space-y-2 text-sm">
              {z.verlauf.map((v, i) => (
                <li key={i} className="flex gap-4">
                  <span className="zahlen shrink-0 text-grau">{datumZeit(v.erstellt_am)}</span>
                  <span className="min-w-0">
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
          <Abschnitt titel={t.status === "ungeplant" ? "Termin" : "Entscheidung"}>
            {haltAbgelaufen ? <p className="mb-3 text-sm text-warnung">Die Haltezeit ist abgelaufen. Der Slot ist eventuell schon an jemand anderen vergeben.</p> : null}
            <TerminAktionen
              status={t.status}
              datum={t.beginn ? berlinDatum(new Date(t.beginn)) : (vorgabe?.datum ?? "")}
              uhrzeit={t.beginn ? berlinUhrzeit(new Date(t.beginn)) : (vorgabe?.uhrzeit ?? "")}
              aktionen={{
                bestaetigen: bestaetigenAktion.bind(null, t.id),
                ablehnen: ablehnenAktion.bind(null, t.id),
                absagen: absagenAktion.bind(null, t.id),
                verschieben: verschiebenAktion.bind(null, t.id),
                erledigt: erledigtAktion.bind(null, t.id),
                gegenvorschlag: gegenvorschlagAktion.bind(null, t.id),
                einplanen: einplanenAktion.bind(null, t.id),
              }}
              lage={lage}
              vorschlagOffen={vorschlagOffen}
              team={z.team}
              person={t.zugewiesen_an}
              dauer={vorgabe?.dauer}
              auftragBleibt={Boolean(t.auftrag_nummer) && t.auftrag_status === "offen"}
            />
            {!["ungeplant", "angefragt", "bestaetigt"].includes(t.status) ? <p className="text-grau">Keine offene Entscheidung.</p> : null}
          </Abschnitt>
          {kvs ? (
            <Abschnitt titel="Kostenvoranschlag">
              <KvAmTerminBereich terminId={t.id} ort="admin" kvs={kvs} ohneZeit={t.status === "ungeplant"} />
            </Abschnitt>
          ) : null}
          <Abschnitt titel="Rechnung">
            {entwurf ? (
              <Link href={`/admin/rechnungen/${entwurf.id}`} className="knopf knopf-dunkel mb-4 w-full">
                Rechnungsentwurf bearbeiten
              </Link>
            ) : null}
            {z.rechnungen.length ? (
              <ul className="mb-4 space-y-2">
                {z.rechnungen.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Link href={`/admin/rechnungen/${r.id}`} className="flex min-w-0 flex-1 justify-between gap-2 hover:underline">
                      <span className="min-w-0">{r.nummer ? <>{r.nummer} <span className="text-grau">· {r.storno_zu ? "Storno" : RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS]}</span></> : "Entwurf"}</span>
                      <span className="zahlen">{euro(r.summe_brutto_cent)}</span>
                    </Link>
                    {/* Stornorechnungen hängen an ihrem Original und gehen mit ihm */}
                    {mitRechnungen && !r.storno_zu ? (
                      <form action={rechnungLoesen.bind(null, t.id, r.id)}>
                        <Absenden className="text-xs text-grau underline hover:text-tinte" title="Verknüpfung mit dem Termin lösen, die Rechnung bleibt">
                          lösen
                        </Absenden>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {!z.rechnungen.some((r) => r.status !== "storniert" && !r.storno_zu) ? (
              <form action={rechnungAusTermin.bind(null, t.id, "/admin/rechnungen")}>
                <Senden className="w-full">Rechnung erstellen</Senden>
                <p className="mt-2 text-sm text-grau">Entsteht sonst von selbst, wenn die Werkstatt fertig meldet.</p>
              </form>
            ) : null}
            {frei.length ? (
              <Formular aktion={rechnungVerknuepfen.bind(null, t.id)} className="mt-4 grid gap-2">
                <Auswahl
                  label={t.kunde ? `Vorhandene Rechnung von ${t.kunde.name}` : "Vorhandene Rechnung"}
                  name="rechnung"
                  leer="bitte wählen"
                  optionen={frei.map((r) => [
                    r.id,
                    [r.nummer ?? `Entwurf vom ${datum(r.erstellt_am)}`, euro(r.summe_brutto_cent), RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS], t.kunde ? "" : r.empfaenger?.firma || r.empfaenger?.name]
                      .filter(Boolean)
                      .join(" · "),
                  ])}
                />
                <Senden art="rahmen" klein vorab="Verknüpft">Mit Termin verknüpfen</Senden>
              </Formular>
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
