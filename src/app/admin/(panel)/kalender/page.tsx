import Link from "next/link";
import { KalenderTag, type TagSpalte, type TagTermin } from "@/components/admin/kalender-tag";
import { Kopf } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen, type Fenster } from "@/lib/einstellungen";
import { datumKurzText, datumLangText, monatText, zeit } from "@/lib/format";
import { KalenderMerken } from "@/lib/hooks/kalender-merken";
import { ansichtAusSuche, kalenderHref, type KalenderAnsicht, mitKal, monatsRaster } from "@/lib/kalender-ansicht";
import { planPersonen, planungAktiv } from "@/lib/mitarbeiter";
import { abwesenheitAm, abwesenheitText, arbeitsfenster, farbeVon, konflikte, type PersonBelegung, type PlanPerson } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { auftraegeOhneTerminAnzahl, type GeplanterTermin, TERMIN_FELDER } from "@/lib/termine";
import { weich } from "@/lib/fehler";
import { berlin, berlinDatum, berlinUhrzeit, minuten, plusMonate, plusTage, uhrzeit, wochenbeginn, wochentag } from "@/lib/zeit";

export const metadata = { title: "Kalender" };

const STUNDE_PX = 56;
const OHNE = "ohne";

type Art = "angefragt" | "bestaetigt" | "erledigt";

/**
 * Kalender der Werkstatt. Woche (Mo–Sa): Termine je Tag, farbig nach Mitarbeiter, filterbar. Tag: eine Spalte je
 * Mitarbeiter mit Arbeitszeit und Abwesenheit; Termine lassen sich per Ziehen oder Auswahl umverteilen.
 * Monat (Mo–So): je Tag die ersten Termine als Zeile, der Rest als „+ n weitere“ (öffnet den Tag).
 * Ein Klick auf eine freie Stelle öffnet „Termin eintragen“ mit Datum, Uhrzeit (und Person) vorausgefüllt.
 * Termine und „Termin eintragen“ tragen die Ansicht als `?kal=…` mit, damit es von dort hierher zurückgeht.
 */
export default async function KalenderSeite({ searchParams }: { searchParams: Promise<{ woche?: string; tag?: string; monat?: string; person?: string }> }) {
  await benutzerMitRecht("termine");
  const sp = await searchParams;
  const { oeffnungszeiten, buchung } = await einstellungen();
  const heute = berlinDatum();
  const ansicht = ansichtAusSuche(sp, heute);
  const tagAnsicht = ansicht.art === "tag";
  const bezug = ansicht.datum;
  const montag = wochenbeginn(bezug);
  const raster = ansicht.art === "monat" ? monatsRaster(bezug) : [];
  const von = tagAnsicht ? bezug : ansicht.art === "monat" ? raster[0] : montag;
  const bis = tagAnsicht ? bezug : ansicht.art === "monat" ? raster[raster.length - 1] : plusTage(montag, 6);

  const alleFenster = Object.values(oeffnungszeiten).flat();
  const [personen, aktiv, { data: termine }, { data: ohnePerson }, wartend] = await Promise.all([
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
    weich(auftraegeOhneTerminAnzahl(), 0, "Kalender: Aufträge ohne Termin zählen"),
  ]);
  // Nach Zeitraum gefragt: Aufträge ohne Termin sind nicht dabei, jeder Treffer hat eine Zeit.
  const liste = (termine ?? []) as GeplanterTermin[];
  // Personen-Arbeitszeiten können vor oder nach den Öffnungszeiten liegen; das Raster deckt beides ab.
  const personenFenster = ansicht.art === "monat" ? [] : personen.flatMap((p) => Array.from({ length: tagAnsicht ? 1 : 6 }, (_, i) => arbeitsfenster(p, plusTage(von, i))).flat());
  const startStunde = Math.floor(Math.min(...[...alleFenster, ...personenFenster].map(([a]) => minuten(a)), 8 * 60) / 60);
  const endStunde = Math.ceil(Math.max(...[...alleFenster, ...personenFenster].map(([, b]) => minuten(b)), 18 * 60) / 60);
  // Klickfelder im Raster der Buchung, aber höchstens halbstündlich: Bei 60 Minuten träfe man 9:30 nie
  const schritt = Math.min(Math.max(buchung.rasterMin, 15), 30);
  const farbeVonPerson = (id: string | null) => {
    const p = personen.find((x) => x.id === id);
    return p ? farbeVon(p.nimmtAuftraege ? p.farbe : -1) : "var(--color-boden)";
  };

  // Der Tag, der beim Wechsel der Ansicht im Blick bleibt: heute, wenn er in der gezeigten Woche bzw. im Monat liegt
  const fokus =
    ansicht.art === "tag" ? bezug
    : ansicht.art === "woche" ? (montag <= heute && heute <= plusTage(montag, 6) ? heute : montag)
    : heute.slice(0, 7) === bezug.slice(0, 7) ? heute : bezug;
  const person = ansicht.person;
  const umschalten: [KalenderAnsicht, string][] = [
    [{ art: "tag", datum: fokus }, "Tag"],
    [{ art: "woche", datum: wochenbeginn(fokus), person }, "Woche"],
    [{ art: "monat", datum: `${fokus.slice(0, 7)}-01`, person }, "Monat"],
  ];
  const blaettern = (n: number): KalenderAnsicht =>
    ansicht.art === "tag" ? { art: "tag", datum: plusTage(bezug, n) }
    : ansicht.art === "woche" ? { ...ansicht, datum: plusTage(montag, 7 * n) }
    : { ...ansicht, datum: plusMonate(bezug, n) };
  const heuteAnsicht: KalenderAnsicht = ansicht.art === "tag" ? { art: "tag", datum: heute } : ansicht.art === "woche" ? { ...ansicht, datum: wochenbeginn(heute) } : { ...ansicht, datum: `${heute.slice(0, 7)}-01` };
  const zurueckText = { tag: ["← Vortag", "Nächster →"], woche: ["← Vorher", "Nächste →"], monat: ["← Vormonat", "Nächster →"] }[ansicht.art];
  const termin = (id: string) => mitKal(`/admin/termine/${id}`, ansicht);
  const neuerTermin = (datum: string, uhr?: string) => mitKal(`/admin/termine/neu?datum=${datum}${uhr ? `&uhrzeit=${uhr}` : ""}`, ansicht);

  const ansichtLinks = (
    <>
      <nav aria-label="Ansicht" className="flex overflow-hidden rounded-md border border-linie bg-weiss text-sm font-semibold">
        {umschalten.map(([a, text]) => (
          <Link key={a.art} href={kalenderHref(a)} aria-current={a.art === ansicht.art ? "page" : undefined} className={`px-3 py-1.5 ${a.art === ansicht.art ? "bg-tinte text-weiss" : "hover:bg-boden"}`}>
            {text}
          </Link>
        ))}
      </nav>
      <Link href={kalenderHref(blaettern(-1))} className="knopf knopf-rahmen knopf-klein">{zurueckText[0]}</Link>
      <Link href={kalenderHref(heuteAnsicht)} className="knopf knopf-rahmen knopf-klein">Heute</Link>
      <Link href={kalenderHref(blaettern(1))} className="knopf knopf-rahmen knopf-klein">{zurueckText[1]}</Link>
      <Link href={neuerTermin(tagAnsicht ? bezug : fokus)} className="knopf knopf-dunkel knopf-klein">Termin eintragen</Link>
    </>
  );
  // Merkt sich die Ansicht für „Kalender“ im Menü (je Tab, nur heute)
  const merken = <KalenderMerken href={kalenderHref(ansicht)} />;

  const hinweisPerson =
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
  const hinweisOhne = (
    <>
      {wartend ? (
        <Link href="/admin/auftraege?ansicht=ohne" className="mb-4 flex items-center justify-between gap-3 border-l-4 border-kreide bg-weiss px-4 py-3 text-sm font-semibold hover:underline">
          {wartend === 1 ? "1 Werkstattauftrag wartet auf einen Termin" : `${wartend} Werkstattaufträge warten auf einen Termin`}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
      {hinweisPerson}
    </>
  );

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
    const warnung = (t: GeplanterTermin) => {
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
        {merken}
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

  const filter = person === OHNE || personen.some((p) => p.id === person) ? person : undefined;
  const gefiltert = liste.filter((t) => !filter || (filter === OHNE ? !t.zugewiesen_an : t.zugewiesen_an === filter));
  const filterLink = (p?: string) => kalenderHref({ ...ansicht, person: p });
  const imFilter = personen.filter((p) => p.nimmtAuftraege || liste.some((t) => t.zugewiesen_an === p.id));
  const filterLeiste = imFilter.length ? (
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
  ) : null;
  const farbe: Record<Art, string> = {
    bestaetigt: "text-tinte",
    angefragt: "bg-kreide/60 text-tinte",
    erledigt: "bg-boden text-grau",
  };

  if (ansicht.art === "monat") {
    const monat = bezug.slice(0, 7);
    const proTag = new Map<string, GeplanterTermin[]>();
    for (const t of gefiltert) {
      const d = berlinDatum(new Date(t.beginn));
      proTag.set(d, [...(proTag.get(d) ?? []), t]);
    }
    // Wie im Monatskalender am Handy: Passt nicht alles, stehen drei Zeilen und „+ n weitere“ in der vierten
    const PLATZ = 4;
    return (
      <>
        {merken}
        <Kopf titel="Kalender" unter={monatText(bezug)}>{ansichtLinks}</Kopf>
        {hinweisOhne}
        {filterLeiste}
        <div className="-mx-4 quer-scrollen md:mx-0">
          <div className="grid min-w-[760px] grid-cols-7 gap-px border border-linie bg-linie">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
              <div key={w} className="bg-weiss px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-grau">{w}</div>
            ))}
            {raster.map((d) => {
              const imMonat = d.slice(0, 7) === monat;
              const zu = !oeffnungszeiten[String(wochentag(d)) as keyof typeof oeffnungszeiten]?.length;
              const tagListe = proTag.get(d) ?? [];
              const zeigen = tagListe.length > PLATZ ? tagListe.slice(0, PLATZ - 1) : tagListe;
              const rest = tagListe.length - zeigen.length;
              return (
                <div
                  key={d}
                  className={`relative flex min-h-[7.5rem] flex-col gap-0.5 px-1.5 pb-1.5 pt-1 ${imMonat ? "bg-weiss" : "bg-boden/60"} ${
                    zu ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.04)_6px_12px)]" : ""
                  }`}
                >
                  {/* Freie Fläche: neuer Termin an diesem Tag. Liegt unter den Terminen, ohne Tab-Stopp (per Tastatur „Termin eintragen“). */}
                  <Link href={neuerTermin(d)} prefetch={false} tabIndex={-1} aria-label={`Neuer Termin am ${datumKurzText(d)}`} className="absolute inset-0 hover:bg-boden/50" />
                  <Link
                    href={kalenderHref({ art: "tag", datum: d })}
                    title="Tag mit Spalte je Mitarbeiter öffnen"
                    className={`zahlen relative grid size-7 place-items-center self-start rounded-full text-sm font-semibold hover:ring-2 hover:ring-tinte ${
                      d === heute ? "bg-rot text-weiss" : imMonat ? "text-tinte" : "text-grau-hell"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </Link>
                  {zeigen.map((t) => {
                    const art = t.status as Art;
                    return (
                      <Link
                        key={t.id}
                        href={termin(t.id)}
                        title={[`${zeit(t.beginn)} ${t.leistung_name}`, t.fahrzeug?.kennzeichen, t.kunde?.name, t.mitarbeiter?.name].filter(Boolean).join(" · ")}
                        className={`relative block truncate rounded-sm border-l-4 px-1.5 py-0.5 text-xs leading-tight hover:ring-2 hover:ring-tinte ${farbe[art]} ${imMonat ? "" : "opacity-70"}`}
                        style={{
                          borderLeftColor: t.zugewiesen_an ? farbeVonPerson(t.zugewiesen_an) : aktiv ? "var(--color-rot)" : "var(--color-tinte)",
                          ...(art === "bestaetigt" && { background: t.zugewiesen_an ? farbeVonPerson(t.zugewiesen_an) : "var(--color-boden)" }),
                        }}
                      >
                        <span className="zahlen font-semibold">{zeit(t.beginn)}</span> {t.leistung_name}
                        {t.fahrzeug?.kennzeichen ? <span className="opacity-80"> · {t.fahrzeug.kennzeichen}</span> : null}
                      </Link>
                    );
                  })}
                  {rest ? (
                    <Link href={kalenderHref({ art: "tag", datum: d })} className="relative px-1.5 text-xs font-semibold text-grau hover:text-tinte hover:underline">
                      + {rest} weitere
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 flex flex-wrap gap-4 text-sm text-grau">
          <span><span className="mr-1 inline-block size-3 border border-linie bg-weiss align-middle" />bestätigt (Fläche in der Farbe der Person)</span>
          <span><span className="mr-1 inline-block size-3 bg-kreide/60 align-middle" />angefragt</span>
          <span><span className="mr-1 inline-block size-3 bg-boden align-middle" />erledigt</span>
          <span>Klick auf die Zahl öffnet den Tag, auf eine freie Stelle einen neuen Termin.</span>
        </p>
      </>
    );
  }

  const tage = Array.from({ length: 6 }, (_, i) => plusTage(montag, i));
  type Block = { id: string; beginn: Date; ende: Date; titel: string; unter: string; person: string; art: Art; profil: string | null; href: string; spalte?: number; spalten?: number };
  const bloecke: Block[] = gefiltert
    .map((t) => ({
      id: t.id,
      beginn: new Date(t.beginn),
      ende: new Date(t.ende),
      titel: t.leistung_name,
      unter: [t.fahrzeug?.kennzeichen, t.kunde?.name].filter(Boolean).join(" · "),
      person: t.mitarbeiter?.name ?? (aktiv ? "ohne Mitarbeiter" : ""),
      art: t.status as Art,
      profil: t.zugewiesen_an,
      href: termin(t.id),
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


  return (
    <>
      {merken}
      <Kopf titel="Kalender" unter={`Woche ab ${datumKurzText(montag)}`}>{ansichtLinks}</Kopf>
      {hinweisOhne}
      {filterLeiste}
      <div className="-mx-4 quer-scrollen bg-weiss md:mx-0">
        <div className="grid min-w-[880px] grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
          <div />
          {proTag.map((t) => (
            <div key={t.datum} className={`group flex items-center justify-between border-b-2 px-2 py-2 text-sm font-semibold ${t.datum === heute ? "border-rot" : "border-tinte"}`}>
              <Link href={kalenderHref({ art: "tag", datum: t.datum })} title="Tag mit Spalte je Mitarbeiter öffnen" className="hover:underline">
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
