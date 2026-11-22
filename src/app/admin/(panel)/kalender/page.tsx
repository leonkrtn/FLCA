import Link from "next/link";
import { KalenderTag, type TagSpalte, type TagTermin } from "@/components/admin/kalender-tag";
import { Kopf } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen, type Fenster } from "@/lib/einstellungen";
import { datumKurzText, datumLangText, zeit } from "@/lib/format";
import { planPersonen, planungAktiv } from "@/lib/mitarbeiter";
import { abwesenheitAm, abwesenheitText, arbeitsfenster, farbeVon, konflikte, type PersonBelegung, type PlanPerson } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, berlinUhrzeit, istDatum, minuten, plusTage, uhrzeit, wochenbeginn, wochentag } from "@/lib/zeit";

export const metadata = { title: "Kalender" };

const STUNDE_PX = 56;
const OHNE = "ohne";

type Art = "angefragt" | "bestaetigt" | "erledigt";

/**
 * Kalender der Werkstatt. Woche (Mo–Sa): Termine je Tag, farbig nach Mitarbeiter, filterbar. Tag: eine Spalte je
 * Mitarbeiter mit Arbeitszeit und Abwesenheit; Termine lassen sich per Ziehen oder Auswahl umverteilen.
 * Ein Klick auf eine freie Stelle öffnet „Termin eintragen“ mit Datum, Uhrzeit (und Person) vorausgefüllt.
 */
export default async function KalenderSeite({ searchParams }: { searchParams: Promise<{ woche?: string; tag?: string; person?: string }> }) {
  await benutzerMitRecht("termine");
  const sp = await searchParams;
  const { oeffnungszeiten, buchung } = await einstellungen();
  const tagAnsicht = istDatum(sp.tag);
  const bezug = tagAnsicht ? sp.tag! : istDatum(sp.woche) ? sp.woche : berlinDatum();
  const montag = wochenbeginn(bezug);
  const von = tagAnsicht ? bezug : montag;
  const bis = tagAnsicht ? bezug : plusTage(montag, 6);

  const alleFenster = Object.values(oeffnungszeiten).flat();
  const [personen, aktiv, { data: termine }, { data: ohnePerson }] = await Promise.all([
    planPersonen(von, bis, false),
    planungAktiv(),
    db()
      .from("termine")
      .select(TERMIN_FELDER)
      .in("status", ["angefragt", "bestaetigt", "erledigt"])
      .gte("beginn", berlin(von).toISOString())
      .lt("beginn", berlin(plusTage(bis, 1)).toISOString())
      .order("beginn"),
    db()
      .from("termine")
      .select("id, beginn, leistung_name, fahrzeug:fahrzeuge(kennzeichen)")
      .is("zugewiesen_an", null)
      .eq("status", "bestaetigt")
      .gte("beginn", new Date().toISOString())
      .order("beginn")
      .limit(8),
  ]);
  const liste = (termine ?? []) as Termin[];
  // Personen-Arbeitszeiten können vor oder nach den Öffnungszeiten liegen; das Raster deckt beides ab.
  const personenFenster = personen.flatMap((p) => Array.from({ length: tagAnsicht ? 1 : 6 }, (_, i) => arbeitsfenster(p, plusTage(von, i))).flat());
  const startStunde = Math.floor(Math.min(...[...alleFenster, ...personenFenster].map(([a]) => minuten(a)), 8 * 60) / 60);
  const endStunde = Math.ceil(Math.max(...[...alleFenster, ...personenFenster].map(([, b]) => minuten(b)), 18 * 60) / 60);
  // Klickfelder im Raster der Buchung, aber höchstens halbstündlich: Bei 60 Minuten träfe man 9:30 nie
  const schritt = Math.min(Math.max(buchung.rasterMin, 15), 30);
  const farbeVonPerson = (id: string | null) => {
    const p = personen.find((x) => x.id === id);
    return p ? farbeVon(p.nimmtAuftraege ? p.farbe : -1) : "var(--color-boden)";
  };
  const heute = berlinDatum();

  const ansichtLinks = (
    <>
      {tagAnsicht ? (
        <>
          <Link href={`/admin/kalender?tag=${plusTage(bezug, -1)}`} className="knopf knopf-rahmen knopf-klein">← Vortag</Link>
          <Link href={`/admin/kalender?tag=${heute}`} className="knopf knopf-rahmen knopf-klein">Heute</Link>
          <Link href={`/admin/kalender?tag=${plusTage(bezug, 1)}`} className="knopf knopf-rahmen knopf-klein">Nächster →</Link>
          <Link href={`/admin/kalender?woche=${montag}`} className="knopf knopf-rahmen knopf-klein">Woche</Link>
        </>
      ) : (
        <>
          <Link href={`/admin/kalender?woche=${plusTage(montag, -7)}`} className="knopf knopf-rahmen knopf-klein">← Vorher</Link>
          <Link href="/admin/kalender" className="knopf knopf-rahmen knopf-klein">Heute</Link>
          <Link href={`/admin/kalender?woche=${plusTage(montag, 7)}`} className="knopf knopf-rahmen knopf-klein">Nächste →</Link>
          <Link href={`/admin/kalender?tag=${montag <= heute && heute <= plusTage(montag, 6) ? heute : montag}`} className="knopf knopf-rahmen knopf-klein">Tag</Link>
        </>
      )}
      <Link href={`/admin/termine/neu?${tagAnsicht ? `datum=${bezug}&tag=${bezug}` : `kalender=${montag}`}`} className="knopf knopf-dunkel knopf-klein">Termin eintragen</Link>
    </>
  );

  const hinweisOhne =
    aktiv && ohnePerson?.length ? (
      <div className="mb-4 border-l-4 border-rot bg-weiss px-4 py-3 text-sm">
        <p className="font-semibold">Ohne Mitarbeiter</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {(ohnePerson as unknown as { id: string; beginn: string; leistung_name: string; fahrzeug: { kennzeichen: string } | null }[]).map((t) => (
            <li key={t.id}>
              <Link href={`/admin/kalender?tag=${berlinDatum(new Date(t.beginn))}`} className="underline">
                <span className="zahlen">{datumKurzText(t.beginn)} {zeit(t.beginn)}</span> {t.leistung_name}
                {t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (tagAnsicht) {
    const fenster = oeffnungszeiten[String(wochentag(bezug)) as keyof typeof oeffnungszeiten];
    // Spalten: wer eingeplant wird, dazu jeder, der an dem Tag einen Termin hat; zuletzt „ohne Mitarbeiter“.
    const mitTermin = new Set(liste.map((t) => t.zugewiesen_an));
    const spaltenPersonen = personen.filter((p) => p.nimmtAuftraege || mitTermin.has(p.id));
    const spalten: TagSpalte[] = [
      ...spaltenPersonen.map((p) => spalteVon(p, bezug)),
      { id: null, name: "Ohne Mitarbeiter", farbe: "var(--color-boden)", fenster: null, hinweis: "" },
    ];
    // Belegungen des Tages für die Prüfung, ob ein Termin (noch) zur Person passt
    const belegungen: PersonBelegung[] = liste
      .filter((t) => t.status === "angefragt" || t.status === "bestaetigt")
      .map((t) => ({ id: t.id, beginn: new Date(t.beginn).getTime(), bis: new Date(t.belegt_bis).getTime(), gewicht: 1, profil: t.zugewiesen_an }));
    const warnung = (t: Termin) => {
      const p = spaltenPersonen.find((x) => x.id === t.zugewiesen_an);
      if (!p || (t.status !== "angefragt" && t.status !== "bestaetigt")) return undefined;
      const z = { beginn: new Date(t.beginn), ende: new Date(t.ende), bis: new Date(t.belegt_bis), leistungIds: t.leistung_ids ?? [], id: t.id };
      return konflikte(p, z, belegungen).join(" ") || undefined;
    };
    const tagTermine: TagTermin[] = liste.map((t) => ({
      id: t.id,
      beginnMin: minuten(berlinUhrzeit(new Date(t.beginn))),
      endeMin: Math.max(minuten(berlinUhrzeit(new Date(t.beginn))) + 15, berlinDatum(new Date(t.ende)) === bezug ? minuten(berlinUhrzeit(new Date(t.ende))) : 24 * 60),
      titel: t.leistung_name,
      unter: [t.fahrzeug?.kennzeichen, t.kunde?.name].filter(Boolean).join(" · "),
      art: t.status as Art,
      profil: spaltenPersonen.some((p) => p.id === t.zugewiesen_an) ? t.zugewiesen_an : null,
      beweglich: t.status === "angefragt" || t.status === "bestaetigt",
      warnung: warnung(t),
    }));
    return (
      <>
        <Kopf titel="Kalender" unter={datumLangText(bezug)}>{ansichtLinks}</Kopf>
        {hinweisOhne}
        <KalenderTag
          datum={bezug}
          startStunde={startStunde}
          endStunde={endStunde}
          stundePx={STUNDE_PX}
          schritt={schritt}
          oeffnung={fenster}
          spalten={spalten}
          termine={tagTermine}
        />
        <Legende personen={spaltenPersonen} />
      </>
    );
  }

  const tage = Array.from({ length: 6 }, (_, i) => plusTage(montag, i));
  const filter = sp.person === OHNE || personen.some((p) => p.id === sp.person) ? sp.person : undefined;
  type Block = { id: string; beginn: Date; ende: Date; titel: string; unter: string; person: string; art: Art; profil: string | null; href: string; spalte?: number; spalten?: number };
  const bloecke: Block[] = liste
    .filter((t) => !filter || (filter === OHNE ? !t.zugewiesen_an : t.zugewiesen_an === filter))
    .map((t) => ({
      id: t.id,
      beginn: new Date(t.beginn),
      ende: new Date(t.ende),
      titel: t.leistung_name,
      unter: [t.fahrzeug?.kennzeichen, t.kunde?.name].filter(Boolean).join(" · "),
      person: t.mitarbeiter?.name ?? (aktiv ? "ohne Mitarbeiter" : ""),
      art: t.status as Art,
      profil: t.zugewiesen_an,
      href: `/admin/termine/${t.id}`,
    }));

  const proTag = tage.map((d) => {
    const tagListe = bloecke.filter((b) => berlinDatum(b.beginn) === d).sort((a, b) => a.beginn.getTime() - b.beginn.getTime());
    const enden: number[] = [];
    for (const b of tagListe) {
      let s = enden.findIndex((e) => e <= b.beginn.getTime());
      if (s === -1) s = enden.push(0) - 1;
      enden[s] = b.ende.getTime();
      b.spalte = s;
    }
    for (const b of tagListe) b.spalten = enden.length;
    return { datum: d, liste: tagListe };
  });

  const farbe: Record<Art, string> = {
    bestaetigt: "text-tinte",
    angefragt: "bg-kreide/60 text-tinte",
    erledigt: "bg-boden text-grau",
  };
  const neuerTermin = (datum: string, uhr?: string) => `/admin/termine/neu?datum=${datum}${uhr ? `&uhrzeit=${uhr}` : ""}&kalender=${montag}`;
  const filterLink = (person?: string) => `/admin/kalender?woche=${montag}${person ? `&person=${person}` : ""}`;
  const imFilter = personen.filter((p) => p.nimmtAuftraege || liste.some((t) => t.zugewiesen_an === p.id));

  return (
    <>
      <Kopf titel="Kalender" unter={`Woche ab ${datumKurzText(montag)}`}>{ansichtLinks}</Kopf>
      {hinweisOhne}
      {imFilter.length ? (
        <nav aria-label="Nach Mitarbeiter filtern" className="mb-3 flex flex-wrap gap-2 text-sm">
          <Link href={filterLink()} aria-current={!filter ? "page" : undefined} className={`${!filter ? "bg-tinte text-weiss" : "bg-weiss"} rounded px-3 py-1.5 font-semibold`}>
            Alle
          </Link>
          {imFilter.map((p) => (
            <Link key={p.id} href={filterLink(p.id)} aria-current={filter === p.id ? "page" : undefined} className={`flex items-center gap-2 rounded px-3 py-1.5 font-semibold ${filter === p.id ? "bg-tinte text-weiss" : "bg-weiss"}`}>
              <span className="inline-block size-3 rounded-sm" style={{ background: farbeVonPerson(p.id) }} />
              {p.name}
            </Link>
          ))}
          {aktiv ? (
            <Link href={filterLink(OHNE)} aria-current={filter === OHNE ? "page" : undefined} className={`rounded px-3 py-1.5 font-semibold ${filter === OHNE ? "bg-tinte text-weiss" : "bg-weiss"}`}>
              Ohne Mitarbeiter
            </Link>
          ) : null}
        </nav>
      ) : null}
      <div className="-mx-4 quer-scrollen bg-weiss md:mx-0">
        <div className="grid min-w-[880px] grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
          <div />
          {proTag.map((t) => (
            <div key={t.datum} className={`group flex items-center justify-between border-b-2 px-2 py-2 text-sm font-semibold ${t.datum === heute ? "border-rot" : "border-tinte"}`}>
              <Link href={`/admin/kalender?tag=${t.datum}`} title="Tag mit Spalte je Mitarbeiter öffnen" className="hover:underline">
                {datumKurzText(t.datum)}
              </Link>
              <Link href={neuerTermin(t.datum)} prefetch={false} title={`Neuer Termin am ${datumKurzText(t.datum)}`} className="text-xs font-normal text-grau hover:text-tinte">
                + Termin
              </Link>
            </div>
          ))}
          <div className="relative" style={{ height: (endStunde - startStunde) * STUNDE_PX }}>
            {Array.from({ length: endStunde - startStunde }, (_, i) => (
              <span key={i} className="zahlen absolute right-2 -translate-y-1/2 text-xs text-grau" style={{ top: i * STUNDE_PX }}>
                {String(startStunde + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {proTag.map((t) => {
            const fenster = oeffnungszeiten[String(wochentag(t.datum)) as keyof typeof oeffnungszeiten];
            return (
              <div key={t.datum} className="relative border-l border-linie" style={{ height: (endStunde - startStunde) * STUNDE_PX }}>
                {Array.from({ length: endStunde - startStunde }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-linie/60" style={{ top: i * STUNDE_PX }} />
                ))}
                {/* geschlossene Zeit schraffiert */}
                {geschlossen(fenster, startStunde, endStunde).map(([a, b]) => (
                  <div key={a} className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.04)_6px_12px)]" style={{ top: ((a - startStunde * 60) / 60) * STUNDE_PX, height: ((b - a) / 60) * STUNDE_PX }} />
                ))}
                {/* Freie Stellen: Klick öffnet einen neuen Termin zu dieser Zeit. Termine liegen darüber und
                    bleiben klickbar. Ohne Tab-Stopp (sonst über hundert pro Woche); per Tastatur gehen „+ Termin“
                    oben und „Termin eintragen“. */}
                {Array.from({ length: ((endStunde - startStunde) * 60) / schritt }, (_, i) => {
                  const uhr = uhrzeit(startStunde * 60 + i * schritt);
                  return (
                    <Link
                      key={uhr}
                      href={neuerTermin(t.datum, uhr)}
                      prefetch={false}
                      tabIndex={-1}
                      aria-label={`Neuer Termin ${datumKurzText(t.datum)}, ${uhr} Uhr`}
                      className="group absolute inset-x-0 overflow-hidden px-1.5 pt-0.5 hover:bg-boden"
                      style={{ top: ((i * schritt) / 60) * STUNDE_PX, height: (schritt / 60) * STUNDE_PX }}
                    >
                      <span className="zahlen hidden text-xs leading-none text-grau group-hover:block">+ {uhr}</span>
                    </Link>
                  );
                })}
                {t.liste.map((b) => {
                  const top = ((minuten(berlinUhrzeit(b.beginn)) - startStunde * 60) / 60) * STUNDE_PX;
                  const hoehe = Math.max(((b.ende.getTime() - b.beginn.getTime()) / 3600000) * STUNDE_PX - 2, 22);
                  const breite = 100 / (b.spalten ?? 1);
                  const stil = {
                    top,
                    height: hoehe,
                    left: `calc(${(b.spalte ?? 0) * breite}% + 2px)`,
                    width: `calc(${breite}% - 4px)`,
                    borderLeftColor: b.profil ? farbeVonPerson(b.profil) : aktiv ? "var(--color-rot)" : "var(--color-tinte)",
                    // Bestätigt: ganz in der Farbe der Person, damit man die Aufteilung auf einen Blick sieht
                    ...(b.art === "bestaetigt" && { background: b.profil ? farbeVonPerson(b.profil) : "var(--color-weiss)" }),
                  };
                  return (
                    <Link
                      key={b.id}
                      href={b.href}
                      className={`absolute overflow-hidden rounded-sm border border-l-[6px] border-linie px-1.5 py-1 text-xs leading-tight shadow-sm hover:ring-2 hover:ring-tinte ${farbe[b.art]}`}
                      style={stil}
                    >
                      <span className="block truncate font-semibold">{zeit(b.beginn)} {b.titel}</span>
                      <span className="block truncate opacity-80">{b.unter}</span>
                      {b.person ? <span className={`block truncate ${b.profil ? "" : "font-semibold text-rot"}`}>{b.person}</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-sm text-grau">
        <span><span className="mr-1 inline-block size-3 border border-linie bg-weiss align-middle" />bestätigt (Fläche in der Farbe der Person)</span>
        <span><span className="mr-1 inline-block size-3 bg-kreide/60 align-middle" />angefragt</span>
        <span><span className="mr-1 inline-block size-3 bg-boden align-middle" />erledigt</span>
        <span>Farbiger Rand = Mitarbeiter{aktiv ? ", rot = noch niemand" : ""}. Klick auf das Datum öffnet den Tag mit einer Spalte je Mitarbeiter.</span>
      </p>
    </>
  );
}

/** Geschlossene Zeiten eines Tages als Minutenbereiche (für die Schraffur). */
function geschlossen(fenster: Fenster[], startStunde: number, endStunde: number): [number, number][] {
  const grenzen = [startStunde * 60, ...[...fenster].sort((a, b) => minuten(a[0]) - minuten(b[0])).flatMap(([a, b]) => [minuten(a), minuten(b)]), endStunde * 60];
  const zu: [number, number][] = [];
  for (let i = 0; i < grenzen.length; i += 2) if (grenzen[i + 1] > grenzen[i]) zu.push([grenzen[i], grenzen[i + 1]]);
  return zu;
}

function spalteVon(p: PlanPerson, datum: string): TagSpalte {
  const abw = abwesenheitAm(p, datum);
  const f = arbeitsfenster(p, datum);
  const hinweis = abw && !abw.von_zeit ? abwesenheitText(abw) : abw ? `${abwesenheitText(abw)} ${abw.von_zeit?.slice(0, 5)}–${abw.bis_zeit?.slice(0, 5)}` : f.length ? f.map(([a, b]) => `${a}–${b}`).join(", ") : "frei";
  return { id: p.id, name: p.name, farbe: farbeVon(p.nimmtAuftraege ? p.farbe : -1), fenster: f, hinweis };
}

function Legende({ personen }: { personen: PlanPerson[] }) {
  return (
    <p className="mt-3 flex flex-wrap gap-4 text-sm text-grau">
      <span>Termin ziehen = andere Person oder Uhrzeit, Klick = Auswahl. Grau schraffiert: Person arbeitet nicht.</span>
      {!personen.length ? <span>Noch wird niemand eingeplant (Mitarbeiter sind es von selbst, Inhaber und Büro auf ihrer Seite zuschalten).</span> : null}
    </p>
  );
}
