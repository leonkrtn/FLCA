import Link from "next/link";
import { notFound } from "next/navigation";
import { Marke } from "@/components/admin/ui";
import { AuftragKnoepfe, FotoKnopf, MeldungFormular, Uebernehmen } from "@/components/mobil/auftrag";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { arbeitsMinuten, grenzeText } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { weich } from "@/lib/fehler";
import { datum, datumKurzText, datumZeit, telHref, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { terminZusatz } from "@/lib/termin-daten";
import { lektionenZuLeistungen } from "@/lib/schulung/daten";
import { dauerText } from "@/lib/schulung/inhalt";
import { istGeplant, leistungIdsVon, TERMIN_FELDER, type Termin } from "@/lib/termine";
import { auftragZeiten, fahrzeugAkte, MELDUNG_STATUS, MELDUNG_TEXT, meldungenZumTermin } from "@/lib/werkstatt";
import { stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Auftrag" };

/**
 * Ein Auftrag in der Team-App: was zu tun ist (Positionen ohne Preise), Fahrzeug mit früheren Arbeiten, Kunde
 * mit Telefon für Rückfragen, Uhr, Fotos, Befunde und angeforderte Teile. Mitarbeiter sehen nur eigene
 * Aufträge und freie, die sie übernehmen könnten.
 */
export default async function TeamAuftrag({ params }: { params: Promise<{ id: string }> }) {
  const b = await benutzerMitRecht("werkstatt");
  const { id } = await params;
  const { data } = await db().from("termine").select(TERMIN_FELDER).eq("id", id).maybeSingle();
  const t = data as Termin | null;
  // Die Team-App kennt nur eingeplante Aufträge; einer ohne Termin erscheint hier erst mit seiner Zeit.
  if (!t || !["bestaetigt", "erledigt"].includes(t.status) || !istGeplant(t)) notFound();
  const frei = !t.zugewiesen_an;
  if (b.rolle === "mitarbeiter" && t.zugewiesen_an !== b.id && !frei) notFound();
  const eigen = t.zugewiesen_an === b.id || b.rolle !== "mitarbeiter";

  const [akte, zeiten, meldungen, zusatz, anleitungen] = await Promise.all([
    fahrzeugAkte(t.fahrzeug?.id ?? null, t.id),
    weich(auftragZeiten([t.id]), [], "Auftragszeiten am Auftrag"),
    weich(meldungenZumTermin(t.id), [], "Meldungen am Auftrag"),
    eigen ? terminZusatz(t.id) : Promise.resolve(null),
    // Lektionen der Schulung zu den Leistungen dieses Auftrags
    weich(lektionenZuLeistungen(leistungIdsVon(t)), [], "Anleitungen am Auftrag"),
  ]);
  const meine = zeiten.filter((z) => z.profil_id === b.id);
  const laufend = meine.find((z) => !z.ende);
  const f = akte.fahrzeug;
  const positionen = (t.auftrag_positionen ?? []).filter((p) => !p.rabatt);

  return (
    <>
      <MobilKopf titel={t.leistung_name} unter={`${datumKurzText(t.beginn)}, ${zeit(t.beginn)}–${zeit(t.ende)} Uhr`} zurueck="/team" />
      <div className="grid gap-2 p-2">
        <Karte>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="zahlen text-xl font-semibold">{t.fahrzeug?.kennzeichen ?? "ohne Kennzeichen"}</p>
              <p>{f?.marke_modell || t.fahrzeug?.marke_modell}</p>
            </div>
            {t.auftrag_nummer ? <Marke ton={t.auftrag_erteilt_am ? "ok" : "warnung"}>{t.auftrag_erteilt_am ? "erteilt" : "nicht erteilt"}</Marke> : null}
          </div>
          {f ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {f.fin ? (
                <>
                  <dt className="text-grau">FIN</dt>
                  <dd className="zahlen break-all">{f.fin}</dd>
                </>
              ) : null}
              <dt className="text-grau">km-Stand</dt>
              <dd className="zahlen">{(t.km_stand ?? f.km_stand)?.toLocaleString("de-DE") ?? "–"}</dd>
              {f.erstzulassung ? (
                <>
                  <dt className="text-grau">Erstzulassung</dt>
                  <dd className="zahlen">{f.erstzulassung}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {frei && !eigen ? <Uebernehmen id={t.id} /> : null}
          {eigen && t.status === "bestaetigt" ? <AuftragKnoepfe id={t.id} status={t.auftrag_status} seit={laufend?.beginn ?? null} bisher={arbeitsMinuten(meine.filter((z) => z.ende))} foto={false} /> : null}
        </Karte>

        <Karte>
          <h2 className="font-semibold">Zu tun</h2>
          {positionen.length ? (
            <ul className="mt-2 space-y-1">
              {positionen.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="zahlen w-12 shrink-0 text-grau">{String(p.menge).replace(".", ",")} {p.einheit}</span>
                  <span className="min-w-0">{p.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">{t.leistung_name}</p>
          )}
          {t.auftrag_beschreibung || t.notiz_kunde ? <p className="mt-2 text-sm text-grau">Kunde: „{t.auftrag_beschreibung || t.notiz_kunde}“</p> : null}
          {t.notiz_intern ? <p className="mt-1 text-sm">Hinweis: {t.notiz_intern}</p> : null}
          {grenzeText(t) ? <p className="mt-2 text-sm font-semibold text-rot">{grenzeText(t)}</p> : null}
        </Karte>

        {anleitungen.length ? (
          <Karte>
            <h2 className="font-semibold">{anleitungen.length === 1 ? "Anleitung" : "Anleitungen"}</h2>
            <ul className="mt-1 divide-y divide-linie">
              {anleitungen.map((a) => (
                <li key={a.id}>
                  <Link href={`/team/schulung/${a.id}?von=${encodeURIComponent(`/team/auftrag/${t.id}`)}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 active:bg-papier">
                    <span className="min-w-0 truncate">{a.titel}</span>
                    <span className="zahlen shrink-0 text-sm text-grau">{[a.video_url ? "Video" : "", dauerText(a.dauer_min)].filter(Boolean).join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Karte>
        ) : null}

        {t.kunde ? (
          <Karte>
            <h2 className="font-semibold">Kunde</h2>
            <p className="mt-1">{t.kunde.firma ? `${t.kunde.name} · ${t.kunde.firma}` : t.kunde.name}</p>
            {t.kunde.telefon ? (
              <a href={telHref(t.kunde.telefon)} className="knopf knopf-rahmen mt-2 w-full">
                Anrufen: {t.kunde.telefon}
              </a>
            ) : null}
          </Karte>
        ) : null}

        {eigen ? (
          <>
            <h2 className="px-2 pt-4 font-semibold">Befund oder Teil ans Büro</h2>
            <Karte>
              <MeldungFormular id={t.id} />
            </Karte>
            {meldungen.map((m) => (
              <Karte key={m.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0">
                    <span className="font-semibold">{MELDUNG_TEXT[m.art]}{m.art === "teil" ? ` · ${String(m.menge).replace(".", ",")} ×` : ""}</span> {m.text}
                  </p>
                  <Marke ton={m.status === "erledigt" ? "ok" : m.status === "bestellt" ? "hell" : "warnung"}>{MELDUNG_STATUS[m.status]}</Marke>
                </div>
                <p className="text-xs text-grau">{m.profil?.name ?? "?"} · {datumZeit(m.erstellt_am)}{m.dringend ? " · dringend" : ""}</p>
              </Karte>
            ))}

            <h2 className="px-2 pt-4 font-semibold">Fotos</h2>
            <Karte>
              <FotoKnopf id={t.id} />
              {zusatz?.fotos.filter((x) => x.art !== "vorschaden").length ? (
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {zusatz.fotos.filter((x) => x.art !== "vorschaden").map((x) => (
                    <a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-boden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.url} alt={x.notiz || "Foto vom Fahrzeug"} className="size-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
            </Karte>

            {zeiten.length ? (
              <>
                <h2 className="px-2 pt-4 font-semibold">Arbeitszeit: {stunden(arbeitsMinuten(zeiten))}</h2>
                <Karte>
                  <ul className="space-y-1 text-sm">
                    {zeiten.map((z) => (
                      <li key={z.id} className="flex justify-between gap-3">
                        <span>{z.profil?.name ?? "?"}</span>
                        <span className="zahlen text-grau">
                          {zeit(z.beginn)}–{z.ende ? zeit(z.ende) : "läuft"} · {stunden(arbeitsMinuten([z]))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Karte>
              </>
            ) : null}
          </>
        ) : null}

        {akte.frueher.length ? (
          <>
            <h2 className="px-2 pt-4 font-semibold">Frühere Arbeiten an diesem Fahrzeug</h2>
            <Karte>
              <ul className="space-y-1 text-sm">
                {akte.frueher.map((x) => (
                  <li key={x.id} className="flex gap-3">
                    <span className="zahlen w-20 shrink-0 text-grau">{datum(x.beginn)}</span>
                    <span className="min-w-0 flex-1">{x.leistung_name}</span>
                    {x.km_stand ? <span className="zahlen shrink-0 text-grau">{x.km_stand.toLocaleString("de-DE")} km</span> : null}
                  </li>
                ))}
              </ul>
            </Karte>
          </>
        ) : null}
      </div>
    </>
  );
}
