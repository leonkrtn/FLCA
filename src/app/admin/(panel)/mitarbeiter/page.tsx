import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { StandortFelder } from "@/components/admin/standort-felder";
import { Abschnitt, Auswahl, Feld, Kopf, Leer, Marke, Reiter, Schalter, Tabelle } from "@/components/admin/ui";
import { FaehigkeitenMatrix } from "@/components/admin/faehigkeiten";
import { einladen, standortSpeichern } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datum, datumKurzText, datumLangText, zeit } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { istPlanbar, planPersonen, urlaubKonten } from "@/lib/mitarbeiter";
import { abwesenheitAm, abwesenheitText, arbeitsfenster, farbeVon, kalenderwoche, type PlanAbwesenheit, type PlanPerson, planFenster, verfuegbareMinuten } from "@/lib/planung";
import { darf, ROLLEN, rollenName, type Rolle } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlin, berlinDatum, berlinUhrzeit, istDatum, minuten as minutenVon, plusTage, wochenbeginn, wochentag } from "@/lib/zeit";
import { stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Mitarbeiter" };

type Profil = { id: string; name: string; email: string; rolle: Rolle | null; aktiv: boolean; zeiterfassung: boolean; nimmt_auftraege: boolean; urlaubstage: number };
type Antrag = PlanAbwesenheit & { id: string; profil_id: string; status: string; notiz: string };
const ANSICHTEN = ["wochenplan", "faehigkeiten", "urlaub", "personen"] as const;
type Ansicht = (typeof ANSICHTEN)[number];

const zeitraumText = (a: Pick<PlanAbwesenheit, "von" | "bis" | "von_zeit" | "bis_zeit">) =>
  `${datum(a.von)}${a.bis !== a.von ? ` bis ${datum(a.bis)}` : ""}${a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)} Uhr` : ""}`;
const tageText = (n: number) => `${String(n).replace(".", ",")} ${n === 1 ? "Tag" : "Tage"}`;

/**
 * Mitarbeiter: alles zur Planung auf einer Seite, für den Rechner gebaut. Der Wochenplan zeigt, wer wann da ist
 * und wie viel verplant ist; Fähigkeiten, Urlaub und Konten haben eigene Reiter. Einzelheiten je Person
 * (Arbeitszeiten, Ausnahmen, Zeiterfassung) stehen auf der Personenseite.
 */
export default async function Mitarbeiter({ searchParams }: { searchParams: Promise<{ ansicht?: string; woche?: string; jahr?: string; tag?: string; monat?: string }> }) {
  const b = await benutzerMitRecht("team");
  const sp = await searchParams;
  const ansicht: Ansicht = ANSICHTEN.includes(sp.ansicht as Ansicht) ? (sp.ansicht as Ansicht) : "wochenplan";
  const [{ data: profile }, { data: offen }] = await Promise.all([
    db().from("profile").select("id, name, email, rolle, aktiv, zeiterfassung, nimmt_auftraege, urlaubstage").order("name"),
    db().from("abwesenheiten").select("id, profil_id, art, von, bis, von_zeit, bis_zeit, status, notiz").eq("status", "beantragt").order("von"),
  ]);
  const personen = (profile ?? []) as Profil[];
  const name = (id: string) => {
    const p = personen.find((x) => x.id === id);
    return p?.name || p?.email || "?";
  };
  const reiter = (a: Ansicht) => `/admin/mitarbeiter${a === "wochenplan" ? "" : `?ansicht=${a}`}`;
  const antragHref = (id: string) => `/admin/mitarbeiter/antrag/${id}?zurueck=${encodeURIComponent(reiter(ansicht))}`;
  // Ohne Planbare (nimmt_auftraege) läuft die Website nur nach Arbeitsplätzen: Das soll hier auffallen.
  const keinerPlanbar = !personen.some((p) => p.aktiv && p.rolle && istPlanbar(p.rolle, p.nimmt_auftraege));

  return (
    <>
      <Kopf titel="Mitarbeiter" />
      {keinerPlanbar ? (
        <Abschnitt className="border-l-4 border-kreide">
          <p>
            Noch wird niemand in der Werkstatt eingeplant. Personen mit der Rolle Mitarbeiter sind es automatisch; Inhaber und Büro lassen sich auf ihrer Seite zuschalten. Bis dahin richten sich
            freie Termine nur nach den Arbeitsplätzen.
          </p>
        </Abschnitt>
      ) : null}
      {offen?.length ? (
        <Abschnitt titel="Offene Anträge" className="border-l-4 border-kreide">
          <ul className="divide-y divide-linie">
            {(offen as Antrag[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={antragHref(a.id)} className="min-w-0 hover:underline">
                  <span className="font-semibold">{name(a.profil_id)}</span> · {abwesenheitText(a)} {zeitraumText(a)}
                  {a.notiz ? <span className="block text-sm text-grau">{a.notiz}</span> : null}
                </Link>
                {/* Entschieden wird auf der Antragsseite: erst sehen, wer sonst fehlt und wer die Termine übernimmt. */}
                <Link href={antragHref(a.id)} className="knopf knopf-dunkel knopf-klein">Ansehen und entscheiden</Link>
              </li>
            ))}
          </ul>
        </Abschnitt>
      ) : null}
      <Reiter
        aktiv={reiter(ansicht)}
        eintraege={[
          { href: reiter("wochenplan"), text: "Wochenplan" },
          { href: reiter("faehigkeiten"), text: "Fähigkeiten" },
          { href: reiter("urlaub"), text: "Urlaub", anzahl: offen?.length },
          { href: reiter("personen"), text: "Personen und Zugang" },
        ]}
      />
      {ansicht === "wochenplan" ? (istDatum(sp.tag) || sp.tag === "heute" ? <Tagesplan tag={istDatum(sp.tag) ? sp.tag : berlinDatum()} /> : <Wochenplan woche={sp.woche} />) : null}
      {ansicht === "faehigkeiten" ? <Faehigkeiten personen={personen} /> : null}
      {ansicht === "urlaub" ? <Urlaub personen={personen} jahrWahl={sp.jahr} monatWahl={sp.monat} /> : null}
      {ansicht === "personen" ? <Personen personen={personen} standortRecht={darf(b.rolle, "einstellungen")} einladenRecht={darf(b.rolle, "benutzer")} /> : null}
    </>
  );
}

/** Raster Personen × Tage mit Arbeitszeit, Abwesenheit und Terminen, dazu die Auslastung der Woche. */
async function Wochenplan({ woche }: { woche?: string }) {
  const montag = wochenbeginn(istDatum(woche) ? woche : berlinDatum());
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
  const sonntag = tage[6];
  const [personen, { data: termine }, { data: beantragt }, { data: profile }] = await Promise.all([
    planPersonen(montag, sonntag, false),
    db()
      .from("termine")
      .select("id, beginn, ende, zugewiesen_an, status")
      .in("status", ["angefragt", "bestaetigt", "erledigt"])
      .gte("beginn", berlin(montag).toISOString())
      .lt("beginn", berlin(plusTage(montag, 7)).toISOString()),
    db().from("abwesenheiten").select("profil_id, art, von, bis").eq("status", "beantragt").lte("von", sonntag).gte("bis", montag),
    db().from("profile").select("id, nimmt_auftraege"),
  ]);
  const auftraege = new Set((profile ?? []).filter((p) => p.nimmt_auftraege).map((p) => p.id as string));
  // Wer eingeplant wird, zuerst: Das sind die Zeilen, auf die es bei der Planung ankommt.
  const sortiert = [...personen].sort((a, b) => Number(auftraege.has(b.id)) - Number(auftraege.has(a.id)) || a.name.localeCompare(b.name, "de"));
  type T = { beginn: string; ende: string; zugewiesen_an: string | null; status: string };
  const amTag = (profil: string | null, d: string) => ((termine ?? []) as T[]).filter((t) => t.zugewiesen_an === profil && berlinDatum(new Date(t.beginn)) === d);
  const minuten = (liste: T[]) => liste.reduce((s, t) => s + (new Date(t.ende).getTime() - new Date(t.beginn).getTime()) / 60000, 0);
  const heute = berlinDatum();
  const kw = kalenderwoche(montag);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          KW {kw} <span className="font-normal text-grau">({kw % 2 === 0 ? "gerade" : "ungerade"}) · {datumKurzText(montag)} bis {datumKurzText(sonntag)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <PlanUmschalter aktiv="woche" tag={montag <= heute && heute <= sonntag ? heute : montag} woche={montag} />
          <Link href={`/admin/mitarbeiter?woche=${plusTage(montag, -7)}`} className="knopf knopf-rahmen knopf-klein">← Vorher</Link>
          <Link href="/admin/mitarbeiter" className="knopf knopf-rahmen knopf-klein">Diese Woche</Link>
          <Link href={`/admin/mitarbeiter?woche=${plusTage(montag, 7)}`} className="knopf knopf-rahmen knopf-klein">Nächste →</Link>
        </div>
      </div>
      {sortiert.length ? (
        <div className="-mx-4 quer-scrollen bg-weiss md:mx-0">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-tinte text-left">
                <th className="w-44 px-3 py-2 font-semibold first:pl-4">Person</th>
                {tage.map((d) => (
                  <th key={d} className={`px-2 py-2 font-semibold ${d === heute ? "text-rot" : ""}`}>
                    <Link href={`/admin/mitarbeiter?tag=${d}`} className="hover:underline" title="Tag als Zeitleiste">{datumKurzText(d)}</Link>
                  </th>
                ))}
                <th className="w-44 px-3 py-2 text-right font-semibold">Auslastung</th>
              </tr>
            </thead>
            <tbody>
              {sortiert.map((p) => {
                const verplant = tage.reduce((s, d) => s + minuten(amTag(p.id, d)), 0);
                const verfuegbar = tage.reduce((s, d) => s + verfuegbareMinuten(p, d), 0);
                const anteil = verfuegbar ? Math.round((verplant / verfuegbar) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-linie align-top">
                    <td className="py-2.5 pl-4 pr-3">
                      <Link href={`/admin/mitarbeiter/${p.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                        <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: farbeVon(auftraege.has(p.id) ? p.farbe : -1) }} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                      {!auftraege.has(p.id) ? <span className="block text-xs text-grau">nicht eingeplant</span> : null}
                      {p.planAusOeffnung ? <span className="block text-xs text-grau">kein eigener Plan: Öffnungszeiten</span> : null}
                    </td>
                    {tage.map((d) => (
                      <Zelle key={d} p={p} d={d} anzahl={amTag(p.id, d).length} beantragt={(beantragt ?? []).find((a) => a.profil_id === p.id && a.von <= d && a.bis >= d)} />
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <span className="zahlen">{stunden(verplant)} / {stunden(verfuegbar)}</span>
                      <span className="mt-1 block h-1.5 w-full bg-boden" aria-hidden>
                        <span className={`block h-full ${anteil > 100 ? "bg-rot" : anteil > 85 ? "bg-kreide" : "bg-tinte"}`} style={{ width: `${Math.min(anteil, 100)}%` }} />
                      </span>
                      <span className="zahlen text-xs text-grau">{anteil} %</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="text-grau">
                <td className="py-2.5 pl-4 pr-3 text-sm">ohne Mitarbeiter</td>
                {tage.map((d) => {
                  const n = amTag(null, d).filter((t) => t.status !== "erledigt").length;
                  return (
                    <td key={d} className="px-2 py-2.5">
                      {n ? <Link href={`/admin/kalender?tag=${d}`} className="font-semibold text-rot underline">{n} offen</Link> : "–"}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <Leer>Noch niemand angelegt.</Leer>
      )}
      <p className="mt-3 text-sm text-grau">
        Klick auf einen Tag ändert die Arbeitszeit nur für dieses Datum (Ausnahme). Den festen Wochenplan gibt es auf der Seite der Person. Ein Klick auf das Datum oben zeigt den Tag als Zeitleiste.
      </p>
    </>
  );
}

function Zelle({ p, d, anzahl, beantragt }: { p: PlanPerson; d: string; anzahl: number; beantragt?: { art: string } }) {
  const abw = abwesenheitAm(p, d);
  const ganz = abw && !abw.von_zeit;
  const f = arbeitsfenster(p, d);
  const abweichend = d in p.ausnahmen;
  return (
    <td className={`px-1 py-1.5 ${ganz ? "bg-kreide/40" : !f.length ? "bg-boden/60" : ""}`}>
      <Link href={`/admin/mitarbeiter/${p.id}?datum=${d}#ausnahmen`} className="block rounded-sm px-1.5 py-1 hover:bg-boden" title="Arbeitszeit an diesem Tag ändern">
        {ganz ? (
          <span className="font-semibold">{abwesenheitText(abw)}</span>
        ) : f.length ? (
          <span className="zahlen block leading-snug">
            {f.map(([a, b]) => (
              <span key={a} className="block">{a}–{b}</span>
            ))}
          </span>
        ) : (
          <span className="text-grau">frei</span>
        )}
        {abw?.von_zeit ? <span className="block text-xs text-grau">{abwesenheitText(abw)} {abw.von_zeit.slice(0, 5)}–{abw.bis_zeit?.slice(0, 5)}</span> : null}
        {abweichend ? <span className="block text-xs text-grau">abweichend</span> : null}
        {beantragt ? <span className="block text-xs text-warnung">{beantragt.art === "urlaub" ? "Urlaub" : "frei"} beantragt</span> : null}
        {anzahl ? <span className="block text-xs font-semibold">{anzahl} {anzahl === 1 ? "Termin" : "Termine"}</span> : null}
      </Link>
    </td>
  );
}

/** Wer darf was, nach Kategorien. Spalten: alle, die eingeplant werden (Mitarbeiter immer, Inhaber/Büro zugeschaltet). */
async function Faehigkeiten({ personen }: { personen: Profil[] }) {
  const [{ data: l }, { data: sperren }] = await Promise.all([
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
    db().from("leistung_sperren").select("profil_id, leistung_id"),
  ]);
  const leistungen = ((l ?? []) as Leistung[]).filter(istTerminLeistung);
  const spalten = personen.filter((p) => p.aktiv && p.rolle && istPlanbar(p.rolle, p.nimmt_auftraege));
  if (!spalten.length) return <Leer>Noch wird niemand eingeplant. Mitarbeiter erscheinen hier von selbst; Inhaber und Büro lassen sich auf ihrer Seite zuschalten.</Leer>;
  return (
    <Abschnitt titel="Wer darf was" aktion={<span className="text-sm text-grau">Die Werkstatt trägt ein, die Team-App zeigt es nur an.</span>}>
      <FaehigkeitenMatrix
        leistungen={leistungen.map((x) => ({ id: x.id, name: x.name, kategorie: x.kategorie }))}
        personen={spalten.map((p) => ({ id: p.id, name: p.name || p.email }))}
        gesperrt={(sperren ?? []).map((x) => `${x.profil_id}_${x.leistung_id}`)}
        kategorien={KATEGORIEN}
      />
    </Abschnitt>
  );
}

/** Urlaubskonto je Person, Monatskalender (wer fehlt wann) und wer demnächst nicht da ist. */
async function Urlaub({ personen, jahrWahl, monatWahl }: { personen: Profil[]; jahrWahl?: string; monatWahl?: string }) {
  const heute = berlinDatum();
  const jahr = jahrWahl && /^\d{4}$/.test(jahrWahl) ? jahrWahl : monatWahl && /^\d{4}-\d{2}$/.test(monatWahl) ? monatWahl.slice(0, 4) : heute.slice(0, 4);
  const monat = monatWahl && /^\d{4}-\d{2}$/.test(monatWahl) && monatWahl.startsWith(jahr) ? monatWahl : heute.startsWith(jahr) ? heute.slice(0, 7) : `${jahr}-01`;
  const [konten, { data: abw }] = await Promise.all([
    urlaubKonten(jahr),
    db().from("abwesenheiten").select("id, profil_id, art, von, bis, von_zeit, bis_zeit, status, notiz").neq("status", "abgelehnt").lte("von", `${jahr}-12-31`).gte("bis", `${jahr}-01-01`).order("von"),
  ]);
  const liste = (abw ?? []) as Antrag[];
  const aktive = personen.filter((p) => p.aktiv && p.rolle);
  const kommend = liste.filter((a) => a.status === "genehmigt" && a.bis >= heute).slice(0, 20);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Urlaubskonto {jahr} <span className="font-normal text-grau">(gezählt werden Arbeitstage laut Wochenplan)</span></p>
        <div className="flex gap-2">
          <Link href={`/admin/mitarbeiter?ansicht=urlaub&jahr=${Number(jahr) - 1}`} className="knopf knopf-rahmen knopf-klein">← {Number(jahr) - 1}</Link>
          <Link href={`/admin/mitarbeiter?ansicht=urlaub&jahr=${Number(jahr) + 1}`} className="knopf knopf-rahmen knopf-klein">{Number(jahr) + 1} →</Link>
        </div>
      </div>
      <Abschnitt>
        <Tabelle kopf={["Person", { text: "Anspruch", zahl: true }, { text: "Genehmigt", zahl: true }, { text: "Beantragt", zahl: true }, { text: "Rest", zahl: true }, { text: "Krank", zahl: true }]}>
          {aktive.map((p) => {
            const k = konten.get(p.id) ?? { anspruch: 0, genehmigt: 0, beantragt: 0, rest: 0, krank: 0 };
            return (
              <tr key={p.id}>
                <td><Link href={`/admin/mitarbeiter/${p.id}#abwesenheiten`} className="font-semibold hover:underline">{p.name || p.email}</Link></td>
                <td className="zahl">{k.anspruch || "–"}</td>
                <td className="zahl">{tageText(k.genehmigt)}</td>
                <td className="zahl">{k.beantragt ? tageText(k.beantragt) : "–"}</td>
                <td className={`zahl font-semibold ${k.anspruch && k.rest < 0 ? "text-rot" : ""}`}>{k.anspruch ? tageText(k.rest) : "–"}</td>
                <td className="zahl">{k.krank ? tageText(k.krank) : "–"}</td>
              </tr>
            );
          })}
        </Tabelle>
      </Abschnitt>
      <UrlaubsKalender personen={aktive} monat={monat} abwesenheiten={liste} />
      <Abschnitt titel="Demnächst nicht da">
        {kommend.length ? (
          <ul className="space-y-1">
            {kommend.map((a) => (
              <li key={a.id}>
                {personen.find((p) => p.id === a.profil_id)?.name} <span className="text-grau">· {abwesenheitText(a)} {zeitraumText(a)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-grau">Niemand.</p>
        )}
      </Abschnitt>
    </>
  );
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Monat als Raster Personen × Tage: Urlaub, krank, frei, beantragt; freie Tage laut Wochenplan grau. */
async function UrlaubsKalender({ personen, monat, abwesenheiten }: { personen: Profil[]; monat: string; abwesenheiten: Antrag[] }) {
  const [j, m] = monat.split("-").map(Number);
  const erster = `${monat}-01`;
  const anzahl = new Date(Date.UTC(j, m, 0)).getUTCDate();
  const tage = Array.from({ length: anzahl }, (_, i) => plusTage(erster, i));
  const plan = await planPersonen(erster, tage[tage.length - 1], false);
  const heute = berlinDatum();
  const nach = (d: number) => new Date(Date.UTC(j, m - 1 + d, 1)).toISOString().slice(0, 7);
  const FARBE: Record<string, string> = { urlaub: "bg-kreide", krank: "bg-grau-hell", sonstiges: "bg-linie" };
  return (
    <Abschnitt
      titel={`Wer fehlt wann: ${MONATE[m - 1]} ${j}`}
      aktion={
        <div className="flex gap-2">
          <Link href={`/admin/mitarbeiter?ansicht=urlaub&monat=${nach(-1)}`} className="knopf knopf-rahmen knopf-klein">←</Link>
          <Link href={`/admin/mitarbeiter?ansicht=urlaub&monat=${nach(1)}`} className="knopf knopf-rahmen knopf-klein">→</Link>
        </div>
      }
    >
      <div className="-mx-4 quer-scrollen md:mx-0">
        <table className="w-full min-w-[960px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-40 py-1 pl-4 text-left font-semibold md:pl-0">Person</th>
              {tage.map((d) => (
                <th key={d} className={`zahlen w-7 py-1 text-center font-normal ${d === heute ? "font-semibold text-rot" : wochentag(d) >= 6 ? "text-grau" : ""}`}>
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personen.map((p) => {
              const pp = plan.find((x) => x.id === p.id);
              return (
                <tr key={p.id} className="border-t border-linie">
                  <td className="truncate py-1 pl-4 pr-2 text-sm md:pl-0">{p.name || p.email}</td>
                  {tage.map((d) => {
                    const a = abwesenheiten.find((x) => x.profil_id === p.id && x.von <= d && x.bis >= d);
                    const arbeitet = pp ? (d in pp.ausnahmen ? pp.ausnahmen[d].length > 0 : pp.planAusOeffnung ? wochentag(d) <= 5 : planFenster(pp, d).length > 0) : false;
                    const titel = a ? `${abwesenheitText(a)}${a.status === "beantragt" ? " (beantragt)" : ""}${a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)}` : ""}` : arbeitet ? "" : "arbeitet nicht";
                    return (
                      <td key={d} className="p-0.5" title={titel || undefined}>
                        {a?.status === "beantragt" ? (
                          <Link
                            href={`/admin/mitarbeiter/antrag/${a.id}?zurueck=${encodeURIComponent(`/admin/mitarbeiter?ansicht=urlaub&monat=${monat}`)}`}
                            className={`block h-6 rounded-sm border-2 border-dashed border-kreide hover:bg-kreide/40 ${a.von_zeit ? "opacity-60" : ""}`}
                            aria-label={`${p.name || p.email}: ${titel}, Antrag öffnen`}
                          />
                        ) : (
                          <span className={`block h-6 rounded-sm ${a ? FARBE[a.art] : arbeitet ? "bg-papier" : "bg-boden"} ${a?.von_zeit ? "opacity-60" : ""}`} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
      </p>
    </Abschnitt>
  );
}

async function Personen({ personen, standortRecht, einladenRecht }: { personen: Profil[]; standortRecht: boolean; einladenRecht: boolean }) {
  const [{ data: laufend }, { standort }] = await Promise.all([db().from("zeiteintraege").select("profil_id").is("ende", null), einstellungen()]);
  const eingestempelt = new Set((laufend ?? []).map((z) => z.profil_id));
  return (
    <>
      <Abschnitt titel="Personen">
        {personen.length ? (
          <Tabelle kopf={["Name", "Rolle", "Eingeplant", "Zeiterfassung", "Jetzt", "Status"]}>
            {personen.map((p) => (
              <tr key={p.id} className="hover:bg-papier">
                <td>
                  <Link href={`/admin/mitarbeiter/${p.id}`} className="font-semibold hover:underline">{p.name || p.email}</Link>
                  <span className="block text-grau">{p.email}</span>
                </td>
                <td>{rollenName(p.rolle)}</td>
                <td>{istPlanbar(p.rolle, p.nimmt_auftraege) ? "ja" : <span className="text-grau">nein</span>}</td>
                <td>{p.zeiterfassung ? "an" : "aus"}</td>
                <td>{eingestempelt.has(p.id) ? <Marke ton="ok">eingestempelt</Marke> : null}</td>
                <td>{p.aktiv ? "aktiv" : <Marke ton="hell">deaktiviert</Marke>}</td>
              </tr>
            ))}
          </Tabelle>
        ) : (
          <Leer>Noch niemand angelegt.</Leer>
        )}
      </Abschnitt>
      <div className="grid gap-x-8 lg:grid-cols-2">
        {einladenRecht ? (
        <Abschnitt titel="Person einladen">
          <Formular aktion={einladen} zuruecksetzen className="grid gap-4">
            <Feld label="Name" name="name" required />
            <Feld label="E-Mail" name="email" typ="email" required />
            <Auswahl label="Rolle" name="rolle" wert="mitarbeiter" optionen={ROLLEN.map((r) => [r.wert, `${r.name}: ${r.beschreibung}`])} />
            <Schalter label="Inhaber oder Büro auch einplanen" name="nimmt_auftraege" an={false} hilfe="Mitarbeiter werden immer eingeplant (freie Termine auf der Website, Zuteilen)" />
            <Schalter label="Zeiterfassung einschalten" name="zeiterfassung" an={false} />
            <div><Senden vorab="Wird gesendet">Einladung senden</Senden></div>
          </Formular>
        </Abschnitt>
        ) : null}
        {standortRecht ? (
          <Abschnitt titel="Einstempeln nur vor Ort">
            <Formular aktion={standortSpeichern} className="grid gap-4">
              <Schalter label="Nur in der Werkstatt einstempeln" name="nurVorOrt" an={standort.nurVorOrt} hilfe="Das Handy schickt beim Einstempeln seinen Standort. Versuche von außerhalb meldet die App dem Inhaber per Push. Ausstempeln geht überall." />
              <StandortFelder lat={standort.lat} lng={standort.lng} radiusM={standort.radiusM} />
              <div><Senden vorab="Gespeichert">Speichern</Senden></div>
            </Formular>
          </Abschnitt>
        ) : null}
      </div>
    </>
  );
}

/** Umschalter Woche ↔ Tag (Zeitleiste). */
function PlanUmschalter({ aktiv, tag, woche }: { aktiv: "woche" | "tag"; tag: string; woche: string }) {
  const k = (an: boolean) => `knopf knopf-klein ${an ? "knopf-dunkel" : "knopf-rahmen"}`;
  return (
    <span className="mr-2 inline-flex gap-1">
      <Link href={`/admin/mitarbeiter?woche=${woche}`} className={k(aktiv === "woche")} aria-current={aktiv === "woche" ? "page" : undefined}>Woche</Link>
      <Link href={`/admin/mitarbeiter?tag=${tag}`} className={k(aktiv === "tag")} aria-current={aktiv === "tag" ? "page" : undefined}>Tag</Link>
    </span>
  );
}

/**
 * Ein Tag als Zeitleiste: je Person eine Zeile mit Arbeitszeit (hell), Abwesenheit und Terminen in der Farbe der
 * Person. Darunter die Termine ohne Mitarbeiter. Ein Klick auf einen Termin öffnet ihn.
 */
async function Tagesplan({ tag }: { tag: string }) {
  const [personen, { data: termine }, { data: profile }, { oeffnungszeiten }] = await Promise.all([
    planPersonen(tag, tag, false),
    db()
      .from("termine")
      .select("id, beginn, ende, zugewiesen_an, status, leistung_name, auftrag_status, fahrzeug:fahrzeuge(kennzeichen)")
      .in("status", ["angefragt", "bestaetigt", "erledigt"])
      .gte("beginn", berlin(tag).toISOString())
      .lt("beginn", berlin(plusTage(tag, 1)).toISOString())
      .order("beginn"),
    db().from("profile").select("id, nimmt_auftraege"),
    einstellungen(),
  ]);
  type T = { id: string; beginn: string; ende: string; zugewiesen_an: string | null; status: string; leistung_name: string; auftrag_status: string; fahrzeug: { kennzeichen: string } | null };
  const liste = (termine ?? []) as unknown as T[];
  const eingeplant = new Set((profile ?? []).filter((p) => p.nimmt_auftraege).map((p) => p.id as string));
  const zeilen = personen.filter((p) => eingeplant.has(p.id) || liste.some((t) => t.zugewiesen_an === p.id) || arbeitsfenster(p, tag).length);
  zeilen.sort((a, b) => Number(eingeplant.has(b.id)) - Number(eingeplant.has(a.id)) || a.name.localeCompare(b.name, "de"));
  const oeffnung = oeffnungszeiten[String(wochentag(tag)) as keyof typeof oeffnungszeiten] ?? [];
  // Sichtbarer Bereich: von der frühesten bis zur spätesten Zeit des Tages, auf volle Stunden
  const punkte = [
    ...oeffnung.flat().map(minutenVon),
    ...zeilen.flatMap((p) => arbeitsfenster(p, tag).flat().map(minutenVon)),
    ...liste.flatMap((t) => [minutenVon(berlinUhrzeit(new Date(t.beginn))), minutenVon(berlinUhrzeit(new Date(t.ende))) || 24 * 60]),
  ];
  const von = Math.floor((punkte.length ? Math.min(...punkte) : 7 * 60) / 60) * 60;
  const bis = Math.ceil((punkte.length ? Math.max(...punkte) : 18 * 60) / 60) * 60;
  const spanne = Math.max(60, bis - von);
  const lage = (a: number, b: number) => ({ left: `${((Math.max(a, von) - von) / spanne) * 100}%`, width: `${((Math.min(b, bis) - Math.max(a, von)) / spanne) * 100}%` });
  const min = (iso: string) => minutenVon(berlinUhrzeit(new Date(iso)));
  const heute = berlinDatum();
  const jetzt = tag === heute ? minutenVon(berlinUhrzeit(new Date())) : null;
  const stundenMarken = Array.from({ length: spanne / 60 + 1 }, (_, i) => von + i * 60);
  const ohne = liste.filter((t) => !t.zugewiesen_an && t.status !== "erledigt");

  // Hilfsfunktionen statt Komponenten: Sie hängen an den Werten dieses Tages (Bereich, jetzt).
  const spur = (children: React.ReactNode) => (
    <div className="relative h-14 overflow-hidden bg-boden">
      {stundenMarken.map((m) => (
        <span key={m} className="absolute inset-y-0 border-l border-linie" style={{ left: `${((m - von) / spanne) * 100}%` }} />
      ))}
      {children}
      {jetzt !== null && jetzt >= von && jetzt <= bis ? <span className="absolute inset-y-0 z-10 w-0.5 bg-rot" style={{ left: `${((jetzt - von) / spanne) * 100}%` }} title="jetzt" /> : null}
    </div>
  );
  const block = (t: T, farbe: string) => (
    <Link
      key={t.id}
      href={`/admin/termine/${t.id}`}
      className={`absolute inset-y-1 overflow-hidden rounded-sm px-1.5 py-0.5 text-xs leading-tight text-tinte hover:ring-2 hover:ring-tinte ${t.status === "angefragt" ? "border-2 border-dashed border-tinte/40" : ""} ${t.status === "erledigt" || t.auftrag_status === "fertig" ? "opacity-60" : ""}`}
      style={{ ...lage(min(t.beginn), min(t.ende) || 24 * 60), background: farbe }}
      title={`${zeit(t.beginn)}–${zeit(t.ende)} ${t.leistung_name}${t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}`}
    >
      <span className="block truncate font-semibold">{t.leistung_name}</span>
      <span className="zahlen block truncate">{zeit(t.beginn)} {t.fahrzeug?.kennzeichen}</span>
    </Link>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">{datumLangText(tag)}</p>
        <div className="flex flex-wrap gap-2">
          <PlanUmschalter aktiv="tag" tag={tag} woche={wochenbeginn(tag)} />
          <Link href={`/admin/mitarbeiter?tag=${plusTage(tag, -1)}`} className="knopf knopf-rahmen knopf-klein">← Vortag</Link>
          <Link href={`/admin/mitarbeiter?tag=${heute}`} className="knopf knopf-rahmen knopf-klein">Heute</Link>
          <Link href={`/admin/mitarbeiter?tag=${plusTage(tag, 1)}`} className="knopf knopf-rahmen knopf-klein">Nächster →</Link>
        </div>
      </div>
      {zeilen.length ? (
        <div className="-mx-4 quer-scrollen bg-flaeche p-4 md:mx-0">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-3">
              <span />
              <div className="relative h-5 text-xs text-grau">
                {stundenMarken.map((m) => (
                  <span key={m} className="zahlen absolute -translate-x-1/2" style={{ left: `${((m - von) / spanne) * 100}%` }}>
                    {String(m / 60).padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-y-1.5">
              {zeilen.map((p) => {
                const abw = abwesenheitAm(p, tag);
                const ganz = abw && !abw.von_zeit;
                const eigene = liste.filter((t) => t.zugewiesen_an === p.id);
                const verplant = eigene.reduce((s, t) => s + (new Date(t.ende).getTime() - new Date(t.beginn).getTime()) / 60000, 0);
                const frei = verfuegbareMinuten(p, tag);
                return (
                  <div key={p.id} className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-x-3">
                    <Link href={`/admin/mitarbeiter/${p.id}?datum=${tag}#ausnahmen`} className="min-w-0 hover:underline" title="Arbeitszeit an diesem Tag ändern">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: farbeVon(eingeplant.has(p.id) ? p.farbe : -1) }} />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="zahlen block text-xs text-grau">{ganz ? abwesenheitText(abw) : frei ? `${stunden(verplant)} / ${stunden(frei)}` : "frei"}</span>
                    </Link>
                    {spur(
                      <>
                      {ganz ? (
                        <span className="absolute inset-0 flex items-center bg-kreide/40 px-3 text-sm font-semibold">{abwesenheitText(abw)}</span>
                      ) : (
                        arbeitsfenster(p, tag).map(([a, b]) => <span key={a} className="absolute inset-y-0 bg-papier" style={lage(minutenVon(a), minutenVon(b))} />)
                      )}
                      {abw?.von_zeit && abw.bis_zeit ? (
                        <span className="absolute inset-y-0 flex items-center bg-kreide/40 px-1 text-xs" style={lage(minutenVon(abw.von_zeit.slice(0, 5)), minutenVon(abw.bis_zeit.slice(0, 5)))}>
                          {abwesenheitText(abw)}
                        </span>
                      ) : null}
                      {eigene.map((t) => block(t, farbeVon(eingeplant.has(p.id) ? p.farbe : -1)))}
                      </>,
                    )}
                  </div>
                );
              })}
              {ohne.length ? (
                <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-x-3">
                  <span className="text-sm font-semibold text-rot">ohne Mitarbeiter</span>
                  {spur(ohne.map((t) => block(t, "var(--color-flaeche)")))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <Leer>An diesem Tag arbeitet niemand.</Leer>
      )}
      <p className="mt-3 text-sm text-grau">
        Heller Grund = Arbeitszeit, gestrichelt = Anfrage, blass = fertig. Ein Klick auf den Namen ändert die Arbeitszeit für diesen Tag, ein Klick auf einen Termin öffnet ihn; zuteilen geht im{" "}
        <Link href={`/admin/kalender?tag=${tag}`} className="underline">Kalender</Link>.
      </p>
    </>
  );
}
