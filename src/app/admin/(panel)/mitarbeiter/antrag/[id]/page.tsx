import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Kopf, Leer, Marke } from "@/components/admin/ui";
import { abwesenheitEntscheiden } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, datumKurzText, datumZeit, zeit } from "@/lib/format";
import { planPersonen, urlaubKonten } from "@/lib/mitarbeiter";
import { abwesenheitText, type PlanAbwesenheit, planFenster, tagesLage, type TagesLage, urlaubstage } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { type GeplanterTermin, STATUS_TEXT, TERMIN_FELDER, umverteilungVorschau } from "@/lib/termine";
import { berlin, berlinDatum, plusTage, wochentag } from "@/lib/zeit";
import { stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Antrag" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WOCHENTAG = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const FARBE: Record<string, string> = { urlaub: "bg-kreide", krank: "bg-grau-hell", sonstiges: "bg-linie" };

type Abw = PlanAbwesenheit & { id: string; profil_id: string; status: "beantragt" | "genehmigt" | "abgelehnt"; notiz: string; erstellt_am: string; entschieden_von: string | null };
type Profil = { id: string; name: string; email: string; rolle: string | null; aktiv: boolean; nimmt_auftraege: boolean };

const zeitraumText = (a: Pick<PlanAbwesenheit, "von" | "bis" | "von_zeit" | "bis_zeit">) =>
  `${datum(a.von)}${a.bis !== a.von ? ` bis ${datum(a.bis)}` : ""}${a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)} Uhr` : ""}`;
const tageText = (n: number) => `${String(n).replace(".", ",")} ${n === 1 ? "Tag" : "Tage"}`;
const vonBis = (t: Pick<GeplanterTermin, "beginn" | "ende">) => `${zeit(t.beginn)}–${zeit(t.ende)}`;

/**
 * Ein Antrag auf Urlaub oder frei, geöffnet zum Entscheiden: wer im Zeitraum sonst fehlt, ob die Zeit der
 * Übrigen für die Termine reicht, welche Aufträge anliegen und wer die Termine des Antragstellers übernimmt.
 * Die Übernahme ist vorgeschlagen wie beim automatischen Verteilen und lässt sich vor dem Genehmigen ändern.
 */
export default async function Antrag({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ zurueck?: string }> }) {
  await benutzerMitRecht("team");
  const { id } = await params;
  const { zurueck: z } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { data } = await db().from("abwesenheiten").select("id, profil_id, art, von, bis, von_zeit, bis_zeit, status, notiz, erstellt_am, entschieden_von").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Abw;
  // Man kommt aus der Übersicht, dem Urlaubsreiter oder von der Person: dorthin auch zurück (Fehlerbuch „Zurück“).
  const zurueck = z?.startsWith("/admin/mitarbeiter") && !z.startsWith("//") ? z : "/admin/mitarbeiter?ansicht=urlaub";
  const zurueckText = zurueck.includes("ansicht=urlaub") ? "Urlaub" : /^\/admin\/mitarbeiter\/[0-9a-f-]{36}/.test(zurueck) ? "Person" : "Mitarbeiter";

  const tage: string[] = [];
  for (let d = a.von; d <= a.bis; d = plusTage(d, 1)) tage.push(d);
  const jahr = a.von.slice(0, 4);
  const offen = a.status === "beantragt";
  const [{ data: profile }, { data: abwRoh }, { data: terminRoh }, plan, konten, vorschau] = await Promise.all([
    db().from("profile").select("id, name, email, rolle, aktiv, nimmt_auftraege").order("name"),
    db().from("abwesenheiten").select("id, profil_id, art, von, bis, von_zeit, bis_zeit, status").neq("status", "abgelehnt").neq("id", a.id).lte("von", a.bis).gte("bis", a.von).order("von"),
    db()
      .from("termine")
      .select(TERMIN_FELDER)
      .in("status", ["angefragt", "bestaetigt"])
      .gte("beginn", berlin(a.von).toISOString())
      .lt("beginn", berlin(plusTage(a.bis, 1)).toISOString())
      .order("beginn"),
    planPersonen(a.von, a.bis, false),
    a.art === "urlaub" ? urlaubKonten(jahr, [a.profil_id]) : Promise.resolve(null),
    offen ? umverteilungVorschau(a.profil_id, a) : Promise.resolve(null),
  ]);
  const personen = (profile ?? []) as Profil[];
  const name = (pid: string | null | undefined) => {
    const p = personen.find((x) => x.id === pid);
    return p?.name || p?.email || "?";
  };
  const wer = name(a.profil_id);
  const vorname = wer.split(" ")[0];
  const andere = (abwRoh ?? []) as Abw[];
  // Nach Zeitraum gefragt: Jeder Treffer hat eine Zeit.
  const termine = (terminRoh ?? []) as GeplanterTermin[];
  const eigene = termine.filter((t) => t.zugewiesen_an === a.profil_id);

  // Reihen: der Antragsteller, dann wer eingeplant wird, dann der Rest. Deaktivierte fehlen ohnehin.
  const zeilen = [...plan].sort(
    (x, y) => Number(y.id === a.profil_id) - Number(x.id === a.profil_id) || Number(Boolean(y.nimmtAuftraege)) - Number(Boolean(x.nimmtAuftraege)) || x.name.localeCompare(y.name, "de"),
  );
  const planbar = plan.filter((p) => p.nimmtAuftraege);
  const zeitTermine = termine.map((t) => ({ beginn: new Date(t.beginn), ende: new Date(t.ende) }));
  // Wer zusätzlich ganz fehlt, weil sein Antrag noch offen ist: als zweite Lage, falls beide genehmigt werden.
  const lage = new Map<string, { jetzt: TagesLage; mitAnderen: TagesLage | null }>(
    tage.map((d) => {
      const beantragt = andere.filter((x) => x.status === "beantragt" && !x.von_zeit && x.von <= d && x.bis >= d).map((x) => x.profil_id);
      return [d, { jetzt: tagesLage(d, planbar, zeitTermine, [a.profil_id]), mitAnderen: beantragt.length ? tagesLage(d, planbar, zeitTermine, [a.profil_id, ...beantragt]) : null }];
    }),
  );
  const antragsteller = plan.find((p) => p.id === a.profil_id);
  const arbeitstage = antragsteller ? urlaubstage(antragsteller, a) : null;
  const konto = konten?.get(a.profil_id);
  // Der Rest im Konto zählt den offenen Antrag schon mit; ist er entschieden, ist er unter „genehmigt“.
  const engeTage = tage.filter((d) => lage.get(d)!.jetzt.verplant > 0 && lage.get(d)!.jetzt.stufe !== "ok");
  const ohneVorschlag = vorschau?.aktiv ? vorschau.termine.filter((t) => !t.vorschlag).length : 0;
  const beantragtAm = (pid: string, d: string) => andere.some((x) => x.profil_id === pid && x.status === "beantragt" && x.von <= d && x.bis >= d);

  const hinweise = [
    ...engeTage.map((d) => {
      const l = lage.get(d)!.jetzt;
      return l.da === 0
        ? `${datumKurzText(d)}: Niemand sonst ist eingeplant, aber ${stunden(l.verplant)} Termine.`
        : `${datumKurzText(d)}: ${stunden(l.verplant)} Termine, die Übrigen haben ${stunden(l.verfuegbar)}${l.stufe === "zu_viel" ? " – reicht nicht." : " – knapp."}`;
    }),
    ...tage
      .filter((d) => lage.get(d)!.mitAnderen && lage.get(d)!.mitAnderen!.stufe !== "ok" && lage.get(d)!.jetzt.stufe === "ok" && lage.get(d)!.mitAnderen!.verplant > 0)
      .map((d) => `${datumKurzText(d)}: Werden auch die anderen offenen Anträge genehmigt, wird es ${lage.get(d)!.mitAnderen!.stufe === "zu_viel" ? "zu viel" : "knapp"}.`),
    ...(ohneVorschlag ? [`${ohneVorschlag} ${ohneVorschlag === 1 ? "Termin" : "Termine"} von ${vorname} ${ohneVorschlag === 1 ? "findet" : "finden"} niemanden, der frei ist und die Arbeit darf.`] : []),
    ...(konto && konto.anspruch && konto.rest < 0 ? [`Mit diesem Antrag ${konto.rest === -1 ? "fehlt" : "fehlen"} ${tageText(-konto.rest)} Urlaub für ${jahr}.`] : []),
  ];

  return (
    <>
      <Kopf
        titel={`${a.art === "urlaub" ? "Urlaub" : a.art === "krank" ? "Krank" : "Frei"}: ${wer}`}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <span>{zeitraumText(a)}</span>
            {offen ? <Marke ton="warnung">beantragt</Marke> : a.status === "genehmigt" ? <Marke ton="ok">genehmigt</Marke> : <Marke ton="hell">abgelehnt</Marke>}
          </span>
        }
        zurueck={{ href: zurueck, text: zurueckText }}
      />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {hinweise.length ? (
            <Abschnitt titel="Worauf achten" className="border-l-4 border-kreide">
              <ul className="space-y-1">
                {hinweise.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </Abschnitt>
          ) : null}

          <Abschnitt titel="Wer fehlt in der Zeit">
            <div className="-mx-4 quer-scrollen md:mx-0">
              <table className="w-full border-collapse text-xs" style={{ minWidth: `${10 + tage.length * 2.5}rem` }}>
                <thead>
                  <tr>
                    <th className="w-40 py-1 pl-4 text-left font-semibold md:pl-0">Person</th>
                    {tage.map((d) => (
                      <th key={d} className={`zahlen min-w-9 py-1 text-center font-normal ${wochentag(d) >= 6 ? "text-grau" : ""}`}>
                        <span className="block">{WOCHENTAG[wochentag(d)]}</span>
                        {Number(d.slice(8))}.{Number(d.slice(5, 7))}.
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((p) => (
                    <tr key={p.id} className={`border-t border-linie ${p.id === a.profil_id ? "font-semibold" : ""}`}>
                      <td className="truncate py-1 pl-4 pr-2 text-sm md:pl-0">
                        {p.name}
                        {!p.nimmtAuftraege ? <span className="block text-xs font-normal text-grau">nicht eingeplant</span> : null}
                      </td>
                      {tage.map((d) => {
                        const eigen = p.id === a.profil_id && a.status !== "abgelehnt";
                        const x = eigen ? a : andere.find((y) => y.profil_id === p.id && y.von <= d && y.bis >= d);
                        const arbeitet = d in p.ausnahmen ? p.ausnahmen[d].length > 0 : p.planAusOeffnung ? wochentag(d) <= 5 : planFenster(p, d).length > 0;
                        const titel = x ? `${abwesenheitText(x)}${x.status === "beantragt" ? " (beantragt)" : ""}${x.von_zeit ? `, ${x.von_zeit.slice(0, 5)}–${x.bis_zeit?.slice(0, 5)}` : ""}` : arbeitet ? "da" : "arbeitet nicht";
                        return (
                          <td key={d} className="p-0.5" title={titel}>
                            <span
                              className={`block h-6 rounded-sm ${x ? (x.status === "beantragt" ? "border-2 border-dashed border-kreide" : FARBE[x.art]) : arbeitet ? "bg-papier" : "bg-boden"} ${x?.von_zeit ? "opacity-60" : ""}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-tinte">
                    <td className="py-1.5 pl-4 pr-2 text-sm md:pl-0">Termine</td>
                    {tage.map((d) => {
                      const n = termine.filter((t) => berlinDatum(new Date(t.beginn)) === d).length;
                      return (
                        <td key={d} className="zahlen py-1.5 text-center">
                          {n ? <Link href={`/admin/kalender?tag=${d}`} className="font-semibold hover:underline">{n}</Link> : <span className="text-grau">–</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {planbar.length ? (
                    <tr className="border-t border-linie">
                      <td className="py-1.5 pl-4 pr-2 text-sm md:pl-0">
                        Auslastung
                        <span className="block text-xs text-grau">ohne {vorname}</span>
                      </td>
                      {tage.map((d) => {
                        const l = lage.get(d)!.jetzt;
                        const anteil = l.verfuegbar ? Math.round((l.verplant / l.verfuegbar) * 100) : null;
                        return (
                          <td
                            key={d}
                            className={`zahlen py-1.5 text-center ${l.verplant && l.stufe === "zu_viel" ? "font-semibold text-rot" : l.verplant && l.stufe === "knapp" ? "font-semibold text-warnung" : "text-grau"}`}
                            title={`${stunden(l.verplant)} verplant, ${stunden(l.verfuegbar)} verfügbar, ${l.da} ${l.da === 1 ? "Person" : "Personen"} da`}
                          >
                            {anteil === null ? (l.verplant ? <span className="text-[0.65rem]">niemand</span> : "–") : `${anteil}%`}
                          </td>
                        );
                      })}
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-grau">
              <span><span className="mr-1 inline-block size-3 rounded-sm bg-kreide align-middle" />Urlaub</span>
              <span><span className="mr-1 inline-block size-3 rounded-sm bg-grau-hell align-middle" />krank</span>
              <span><span className="mr-1 inline-block size-3 rounded-sm bg-linie align-middle" />frei</span>
              <span><span className="mr-1 inline-block size-3 rounded-sm border-2 border-dashed border-kreide align-middle" />beantragt</span>
              <span><span className="mr-1 inline-block size-3 rounded-sm bg-boden align-middle" />arbeitet nicht</span>
              <span>blass = halber Tag</span>
              {planbar.length ? <span>Auslastung: Termine des Tages gegen die Arbeitszeit der übrigen Eingeplanten</span> : null}
            </p>
            {andere.length ? (
              <ul className="mt-4 space-y-1 border-t border-linie pt-3 text-sm">
                {andere.map((x) => (
                  <li key={x.id}>
                    <span className="font-semibold">{name(x.profil_id)}</span> · {abwesenheitText(x)} {zeitraumText(x)}
                    {x.status === "beantragt" ? (
                      <>
                        {" "}
                        <Link href={`/admin/mitarbeiter/antrag/${x.id}?zurueck=${encodeURIComponent(zurueck)}`} className="text-grau underline">beantragt</Link>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-linie pt-3 text-sm text-grau">Sonst fehlt in der Zeit niemand.</p>
            )}
          </Abschnitt>

          <Abschnitt titel="Aufträge im Zeitraum" aktion={<span className="text-sm text-grau">{termine.length} {termine.length === 1 ? "Termin" : "Termine"}, {eigene.length} bei {vorname}</span>}>
            {termine.length ? (
              <ul className="divide-y divide-linie">
                {termine.map((t) => {
                  const eigen = t.zugewiesen_an === a.profil_id;
                  return (
                    <li key={t.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 ${eigen ? "-mx-2 bg-kreide/30 px-2" : ""}`}>
                      <span className="zahlen w-36 shrink-0">{datumKurzText(t.beginn)} {vonBis(t)}</span>
                      <Link href={`/admin/termine/${t.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="font-semibold">{t.leistung_name || "Termin"}</span>
                        <span className="text-grau"> · {[t.kunde?.name, t.fahrzeug?.kennzeichen].filter(Boolean).join(" · ") || "ohne Kunde"}</span>
                      </Link>
                      <span className="flex items-center gap-2 text-sm">
                        {eigen ? <Marke ton="warnung">{vorname}</Marke> : t.mitarbeiter ? <span>{t.mitarbeiter.name}</span> : <span className="text-rot">ohne Mitarbeiter</span>}
                        {t.status === "angefragt" ? <Marke ton="hell">{STATUS_TEXT[t.status]}</Marke> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Leer>In der Zeit stehen keine Termine an.</Leer>
            )}
          </Abschnitt>

          {offen && vorschau ? (
            <Abschnitt titel="Entscheiden">
              <Formular aktion={abwesenheitEntscheiden.bind(null, a.id)} className="grid gap-4">
                {!vorschau.termine.length ? (
                  <p className="text-grau">{vorname} hat in der Zeit keine offenen Termine.</p>
                ) : !vorschau.aktiv ? (
                  <p>
                    Niemand wird eingeplant, deshalb verteilt sich nichts von selbst: Die {vorschau.termine.length} {vorschau.termine.length === 1 ? "Termin bleibt" : "Termine bleiben"} bei {vorname} und
                    {vorschau.termine.length === 1 ? " muss" : " müssen"} im Kalender jemand anderem gegeben werden.
                  </p>
                ) : (
                  <>
                    <p className="text-grau">
                      Beim Genehmigen gehen die Termine von {vorname} an Kollegen. Vorgeschlagen ist, wer frei ist, die Arbeit darf und am wenigsten zu tun hat. Zur Wahl steht nur, wer den Termin
                      machen kann.
                    </p>
                    <ul className="divide-y divide-linie border-y border-linie">
                      {vorschau.termine.map((t) => {
                        const tag = berlinDatum(new Date(t.beginn));
                        const optionen = t.moeglich.map((pid): [string, string] => [
                          pid,
                          `${name(pid)}${pid === t.vorschlag ? " (Vorschlag)" : ""}${beantragtAm(pid, tag) ? ", hat Urlaub beantragt" : ""}`,
                        ]);
                        return (
                          <li key={t.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
                            <span className="min-w-0">
                              <span className="zahlen block">{datumKurzText(t.beginn)} {vonBis(t)}</span>
                              <span className="font-semibold">{t.leistung_name || "Termin"}</span>
                              <span className="text-grau"> · {[t.kunde?.name, t.fahrzeug?.kennzeichen].filter(Boolean).join(" · ") || "ohne Kunde"}</span>
                            </span>
                            <Auswahl label="Übernimmt" name={`person_${t.id}`} wert={t.vorschlag ?? ""} optionen={optionen} leer="Niemand, im Kalender zuteilen" />
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                <div className="knopfreihe knopfreihe-frei">
                  <Senden name="entscheidung" value="genehmigt" vorab="Genehmigt">Genehmigen</Senden>
                  <Senden art="rahmen" name="entscheidung" value="abgelehnt" vorab="Abgelehnt">Ablehnen</Senden>
                </div>
              </Formular>
            </Abschnitt>
          ) : null}
        </div>

        <div>
          <Abschnitt titel="Antrag">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-grau">Wer</dt>
                <dd>
                  <Link href={`/admin/mitarbeiter/${a.profil_id}#abwesenheiten`} className="font-semibold hover:underline">{wer}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-grau">Was</dt>
                <dd>{abwesenheitText(a)}</dd>
              </div>
              <div>
                <dt className="text-grau">Zeitraum</dt>
                <dd>
                  {zeitraumText(a)}
                  {arbeitstage !== null ? <span className="block text-grau">{tageText(arbeitstage)} laut Wochenplan</span> : null}
                </dd>
              </div>
              {a.notiz ? (
                <div>
                  <dt className="text-grau">Notiz</dt>
                  <dd className="whitespace-pre-line">{a.notiz}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-grau">Gestellt</dt>
                <dd className="zahlen">{datumZeit(a.erstellt_am)}</dd>
              </div>
              {!offen && a.entschieden_von ? (
                <div>
                  <dt className="text-grau">{a.status === "genehmigt" ? "Genehmigt von" : "Abgelehnt von"}</dt>
                  <dd>{name(a.entschieden_von)}</dd>
                </div>
              ) : null}
            </dl>
          </Abschnitt>
          {konto ? (
            <Abschnitt titel={`Urlaubskonto ${jahr}`}>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt>Anspruch</dt>
                <dd className="zahlen text-right">{konto.anspruch ? tageText(konto.anspruch) : "–"}</dd>
                <dt>Genehmigt</dt>
                <dd className="zahlen text-right">{tageText(konto.genehmigt)}</dd>
                <dt>Beantragt{offen ? " (mit diesem)" : ""}</dt>
                <dd className="zahlen text-right">{konto.beantragt ? tageText(konto.beantragt) : "–"}</dd>
                <dt className="font-semibold">Rest</dt>
                <dd className={`zahlen text-right font-semibold ${konto.anspruch && konto.rest < 0 ? "text-rot" : ""}`}>{konto.anspruch ? tageText(konto.rest) : "–"}</dd>
              </dl>
            </Abschnitt>
          ) : null}
        </div>
      </div>
    </>
  );
}
