import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { StandortFelder } from "@/components/admin/standort-felder";
import { Abschnitt, Auswahl, Feld, Kopf, Leer, Marke, Reiter, Schalter, Tabelle } from "@/components/admin/ui";
import { abwesenheitEntscheiden, einladen, faehigkeitenSpeichern, standortSpeichern } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datum, datumKurzText } from "@/lib/format";
import { planPersonen } from "@/lib/mitarbeiter";
import { abwesenheitAm, abwesenheitText, arbeitsfenster, farbeVon, kalenderwoche, type PlanAbwesenheit, type PlanPerson, urlaubstage, verfuegbareMinuten } from "@/lib/planung";
import { darf, ROLLEN, rollenName, type Rolle } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlin, berlinDatum, istDatum, plusTage, wochenbeginn } from "@/lib/zeit";
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
export default async function Mitarbeiter({ searchParams }: { searchParams: Promise<{ ansicht?: string; woche?: string; jahr?: string }> }) {
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

  return (
    <>
      <Kopf titel="Mitarbeiter" />
      {offen?.length ? (
        <Abschnitt titel="Offene Anträge" className="border-l-4 border-kreide">
          <ul className="divide-y divide-linie">
            {(offen as Antrag[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="font-semibold">{name(a.profil_id)}</span> · {abwesenheitText(a)} {zeitraumText(a)}
                  {a.notiz ? <span className="block text-sm text-grau">{a.notiz}</span> : null}
                </span>
                <Formular aktion={abwesenheitEntscheiden.bind(null, a.id)} className="flex flex-wrap items-center gap-2">
                  <Senden klein name="entscheidung" value="genehmigt" vorab="Genehmigt">Genehmigen</Senden>
                  <Senden klein art="rahmen" name="entscheidung" value="abgelehnt" vorab="Abgelehnt">Ablehnen</Senden>
                </Formular>
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
      {ansicht === "wochenplan" ? <Wochenplan woche={sp.woche} /> : null}
      {ansicht === "faehigkeiten" ? <Faehigkeiten personen={personen} /> : null}
      {ansicht === "urlaub" ? <Urlaub personen={personen} jahrWahl={sp.jahr} /> : null}
      {ansicht === "personen" ? <Personen personen={personen} standortRecht={darf(b.rolle, "einstellungen")} /> : null}
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
  // Wer Aufträge annimmt, zuerst: Das sind die Zeilen, auf die es bei der Planung ankommt.
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
        <div className="flex gap-2">
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
                    <Link href={`/admin/kalender?tag=${d}`} className="hover:underline">{datumKurzText(d)}</Link>
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
                      {!auftraege.has(p.id) ? <span className="block text-xs text-grau">nimmt keine Aufträge</span> : null}
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
        Klick auf einen Tag ändert die Arbeitszeit nur für dieses Datum (Ausnahme). Den festen Wochenplan gibt es auf der Seite der Person. Ein Klick auf das Datum oben öffnet den Tag im Kalender.
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

/** Matrix Leistungen × Personen. Häkchen = darf; neue Leistungen gelten automatisch für alle. */
async function Faehigkeiten({ personen }: { personen: Profil[] }) {
  const [{ data: l }, { data: sperren }] = await Promise.all([
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
    db().from("leistung_sperren").select("profil_id, leistung_id"),
  ]);
  const leistungen = ((l ?? []) as Leistung[]).filter(istTerminLeistung);
  const spalten = personen.filter((p) => p.aktiv && p.rolle && p.nimmt_auftraege);
  const gesperrt = new Set((sperren ?? []).map((s) => `${s.profil_id}_${s.leistung_id}`));
  if (!spalten.length) return <Leer>Noch niemand nimmt Aufträge an. Das Häkchen dafür steht auf der Seite der Person.</Leer>;
  return (
    <Abschnitt titel="Wer darf was" aktion={<span className="text-sm text-grau">Neue Leistungen darf erst einmal jeder.</span>}>
      <Formular aktion={faehigkeitenSpeichern.bind(null, null)}>
        {spalten.map((p) => <input key={p.id} type="hidden" name="personen" value={p.id} />)}
        {leistungen.map((x) => <input key={x.id} type="hidden" name="leistungen" value={x.id} />)}
        <div className="-mx-4 quer-scrollen md:mx-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-weiss">
              <tr className="border-b-2 border-tinte text-left">
                <th className="px-3 py-2 pl-4 font-semibold md:pl-0">Leistung</th>
                {spalten.map((p) => (
                  <th key={p.id} className="w-28 px-2 py-2 text-center font-semibold">
                    <Link href={`/admin/mitarbeiter/${p.id}`} className="hover:underline">{p.name || p.email}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leistungen.map((x, i) => (
                <tr key={x.id} className={`border-b border-linie ${x.kategorie !== leistungen[i - 1]?.kategorie ? "border-t-2 border-t-linie" : ""}`}>
                  <td className="py-2 pl-4 pr-3 md:pl-0">
                    {x.name} <span className="text-xs text-grau">{x.kategorie}</span>
                  </td>
                  {spalten.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center">
                      <input type="checkbox" name={`darf_${p.id}_${x.id}`} defaultChecked={!gesperrt.has(`${p.id}_${x.id}`)} className="size-5 accent-tinte" aria-label={`${p.name}: ${x.name}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4"><Senden vorab="Gespeichert">Fähigkeiten speichern</Senden></div>
      </Formular>
    </Abschnitt>
  );
}

/** Urlaubskonto je Person: Anspruch, genehmigt, beantragt, Rest; dazu, wer demnächst fehlt. */
async function Urlaub({ personen, jahrWahl }: { personen: Profil[]; jahrWahl?: string }) {
  const jahr = jahrWahl && /^\d{4}$/.test(jahrWahl) ? jahrWahl : berlinDatum().slice(0, 4);
  const heute = berlinDatum();
  const [plan, { data: abw }] = await Promise.all([
    planPersonen(`${jahr}-01-01`, `${jahr}-12-31`, false),
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
            const pp = plan.find((x) => x.id === p.id) ?? { wochenplan: [], ausnahmen: {} };
            const summe = (art: string, status: string) => liste.filter((a) => a.profil_id === p.id && a.art === art && a.status === status).reduce((s, a) => s + urlaubstage(pp, a, jahr), 0);
            const genehmigt = summe("urlaub", "genehmigt");
            const offen = summe("urlaub", "beantragt");
            const rest = p.urlaubstage - genehmigt - offen;
            return (
              <tr key={p.id}>
                <td><Link href={`/admin/mitarbeiter/${p.id}#abwesenheiten`} className="font-semibold hover:underline">{p.name || p.email}</Link></td>
                <td className="zahl">{p.urlaubstage || "–"}</td>
                <td className="zahl">{tageText(genehmigt)}</td>
                <td className="zahl">{offen ? tageText(offen) : "–"}</td>
                <td className={`zahl font-semibold ${p.urlaubstage && rest < 0 ? "text-rot" : ""}`}>{p.urlaubstage ? tageText(rest) : "–"}</td>
                <td className="zahl">{summe("krank", "genehmigt") ? tageText(summe("krank", "genehmigt")) : "–"}</td>
              </tr>
            );
          })}
        </Tabelle>
      </Abschnitt>
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

async function Personen({ personen, standortRecht }: { personen: Profil[]; standortRecht: boolean }) {
  const [{ data: laufend }, { standort }] = await Promise.all([db().from("zeiteintraege").select("profil_id").is("ende", null), einstellungen()]);
  const eingestempelt = new Set((laufend ?? []).map((z) => z.profil_id));
  return (
    <>
      <Abschnitt titel="Personen">
        {personen.length ? (
          <Tabelle kopf={["Name", "Rolle", "Aufträge", "Zeiterfassung", "Jetzt", "Status"]}>
            {personen.map((p) => (
              <tr key={p.id} className="hover:bg-papier">
                <td>
                  <Link href={`/admin/mitarbeiter/${p.id}`} className="font-semibold hover:underline">{p.name || p.email}</Link>
                  <span className="block text-grau">{p.email}</span>
                </td>
                <td>{rollenName(p.rolle)}</td>
                <td>{p.nimmt_auftraege ? "nimmt an" : <span className="text-grau">nein</span>}</td>
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
        <Abschnitt titel="Person einladen">
          <Formular aktion={einladen} zuruecksetzen className="grid gap-4">
            <Feld label="Name" name="name" required />
            <Feld label="E-Mail" name="email" typ="email" required />
            <Auswahl label="Rolle" name="rolle" wert="mitarbeiter" optionen={ROLLEN.map((r) => [r.wert, `${r.name}: ${r.beschreibung}`])} />
            <Schalter label="Nimmt Aufträge an" name="nimmt_auftraege" an hilfe="Wird bei freien Terminen auf der Website und beim Zuteilen berücksichtigt" />
            <Schalter label="Zeiterfassung einschalten" name="zeiterfassung" an={false} />
            <div><Senden>Einladung senden</Senden></div>
          </Formular>
        </Abschnitt>
        {standortRecht ? (
          <Abschnitt titel="Einstempeln nur vor Ort">
            <Formular aktion={standortSpeichern} className="grid gap-4">
              <Schalter label="Nur in der Werkstatt einstempeln" name="nurVorOrt" an={standort.nurVorOrt} hilfe="Das Handy schickt beim Einstempeln seinen Standort. Ausstempeln geht überall." />
              <StandortFelder lat={standort.lat} lng={standort.lng} radiusM={standort.radiusM} />
              <div><Senden vorab="Gespeichert">Speichern</Senden></div>
            </Formular>
          </Abschnitt>
        ) : null}
      </div>
    </>
  );
}
