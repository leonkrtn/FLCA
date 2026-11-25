import Link from "next/link";
import { Ausblenden } from "@/components/admin/formular";
import { Marke } from "@/components/admin/ui";
import { AuftragKnoepfe, Uebernehmen } from "@/components/mobil/auftrag";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { Stempeln } from "@/components/mobil/stempeln";
import { Tagesverlauf } from "@/components/mobil/tagesverlauf";
import { arbeitsMinuten, grenzeText } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { weich } from "@/lib/fehler";
import { datumKurzText, datumLangText, zeit } from "@/lib/format";
import { planPersonen } from "@/lib/mitarbeiter";
import { faelligeAnzahl } from "@/lib/notizen";
import { abwesenheitAm, abwesenheitText, arbeitsfenster } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { type GeplanterTermin, TERMIN_FELDER } from "@/lib/termine";
import { auftragZeiten, freieAuftraege } from "@/lib/werkstatt";
import { berlin, berlinDatum, plusTage } from "@/lib/zeit";
import { monatszeiten, stunden, type Zeiteintrag } from "@/lib/zeiterfassung";

export const metadata = { title: "Heute" };

const AUFTRAG: Record<string, [string, "hell" | "warnung" | "ok"]> = { offen: ["offen", "hell"], in_arbeit: ["in Arbeit", "warnung"], fertig: ["fertig", "ok"] };

/**
 * Startseite der Team-App: oben der nächste Auftrag groß mit Uhr, darunter der eigene Tag als Zeitleiste, die
 * übrigen Aufträge und freie Aufträge, die man selbst übernehmen darf.
 */
export default async function TeamHeute() {
  const b = await benutzerMitRecht("werkstatt");
  const { module, standort } = await einstellungen();
  const heute = berlinDatum();
  const [{ data: auftraege }, plan, { data: offen }, erinnerungen] = await Promise.all([
    db().from("termine").select(TERMIN_FELDER).eq("zugewiesen_an", b.id).in("status", ["bestaetigt", "erledigt"]).gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(plusTage(heute, 1)).toISOString()).order("beginn"),
    planPersonen(heute, heute, false, [b.id]).then((alle) => alle[0] ?? null),
    db().from("zeiteintraege").select("*").eq("profil_id", b.id).is("ende", null).maybeSingle(),
    faelligeAnzahl(b),
  ]);
  // Nach Zeitraum gefragt: Jeder Treffer hat eine Zeit.
  const liste = (auftraege ?? []) as GeplanterTermin[];
  const [zeiten, frei] = await Promise.all([
    weich(auftragZeiten(liste.map((t) => t.id)), [], "Auftragszeiten in der Team-App"),
    weich(freieAuftraege(b.id), [], "Freie Aufträge in der Team-App"),
  ]);
  // Wochenplan, Ausnahme für heute und Abwesenheit (auch halbe Tage) wie in der Planung
  const abw = plan ? abwesenheitAm(plan, heute) : null;
  const fenster = plan ? arbeitsfenster(plan, heute) : [];
  const zeiterfassung = module.zeiterfassung && b.zeiterfassung;
  const monat = zeiterfassung ? await monatszeiten(b.id, heute.slice(0, 7)) : null;
  const eintrag = offen as Zeiteintrag | null;

  const zeitVon = (id: string) => {
    const z = zeiten.filter((x) => x.termin_id === id && x.profil_id === b.id);
    const laufend = z.find((x) => !x.ende);
    return { seit: laufend?.beginn ?? null, bisher: arbeitsMinuten(z.filter((x) => x.ende)) };
  };
  // Der nächste Auftrag: der laufende, sonst der erste nicht fertige
  const laufendId = zeiten.find((x) => !x.ende && x.profil_id === b.id)?.termin_id;
  const naechster = liste.find((t) => t.id === laufendId) ?? liste.find((t) => t.auftrag_status !== "fertig" && t.status === "bestaetigt") ?? null;
  const uebrige = liste.filter((t) => t.id !== naechster?.id);

  return (
    <>
      <MobilKopf titel={`Hallo${b.name ? ` ${b.name.split(" ")[0]}` : ""}`} unter={datumLangText(heute)} />
      <div className="grid gap-2 p-2">
        {erinnerungen ? (
          <Link href="/team/notizen" className="flex items-center justify-between gap-3 bg-kreide px-4 py-3 font-semibold text-tinte">
            {erinnerungen === 1 ? "1 Erinnerung fällig" : `${erinnerungen} Erinnerungen fällig`}
            <span aria-hidden>→</span>
          </Link>
        ) : null}

        {naechster ? <NaechsterAuftrag t={naechster} {...zeitVon(naechster.id)} /> : null}

        <Karte>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-grau">Deine Zeit heute</p>
            <p className="zahlen text-lg">
              {abw && !abw.von_zeit ? (abw.art === "krank" ? "krank gemeldet" : abwesenheitText(abw)) : fenster.length ? fenster.map(([a, z]) => `${a}–${z}`).join(", ") : "frei"}
            </p>
          </div>
          {abw?.von_zeit ? <p className="text-sm text-grau">{abwesenheitText(abw)} {abw.von_zeit.slice(0, 5)}–{abw.bis_zeit?.slice(0, 5)} Uhr</p> : null}
          {zeiterfassung ? (
            <div className="mt-3">
              <Stempeln
                seit={eintrag?.beginn ?? null}
                pauseSeit={eintrag?.pause_seit ?? null}
                nurVorOrt={standort.nurVorOrt && standort.lat !== null && standort.lng !== null}
                monat={stunden(monat!.minuten)}
              />
            </div>
          ) : null}
        </Karte>

        {fenster.length || liste.length ? (
          <>
            <h2 className="px-2 pt-4 font-semibold">Dein Tag</h2>
            <Tagesverlauf
              fenster={fenster}
              auftraege={liste.map((t) => ({ id: t.id, beginn: t.beginn, ende: t.ende, titel: t.leistung_name, unter: [t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ") }))}
            />
          </>
        ) : null}

        {uebrige.length ? <h2 className="px-2 pt-4 font-semibold">{naechster ? "Weitere Aufträge heute" : "Deine Aufträge heute"}</h2> : null}
        {uebrige.map((t) => (
          <AuftragKarte key={t.id} t={t} {...zeitVon(t.id)} />
        ))}
        {!liste.length ? <p className="px-2 py-6 text-center text-grau">Heute ist dir kein Auftrag zugewiesen.</p> : null}

        {frei.length ? (
          <>
            <h2 className="px-2 pt-4 font-semibold">Freie Aufträge</h2>
            <p className="px-2 text-sm text-grau">Noch niemandem zugeteilt, du darfst sie machen und hast Zeit dafür.</p>
            {/* Übernehmen blendet die Karte sofort aus; der Auftrag erscheint oben, sobald der Server antwortet. */}
            {frei.map((t) => (
              <Ausblenden key={t.id}>
                <Karte>
                  <p className="zahlen text-sm text-grau">
                    {berlinDatum(new Date(t.beginn)) === heute ? "heute" : datumKurzText(t.beginn)}, {zeit(t.beginn)}–{zeit(t.ende)} Uhr
                  </p>
                  <p className="font-semibold">{t.leistung_name}</p>
                  <p className="text-sm">{[t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
                  <Uebernehmen id={t.id} />
                </Karte>
              </Ausblenden>
            ))}
          </>
        ) : null}
      </div>
    </>
  );
}

function Kopfzeile({ t }: { t: GeplanterTermin }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Link href={`/team/auftrag/${t.id}`} className="min-w-0">
        <p className="zahlen text-sm text-grau">{zeit(t.beginn)}–{zeit(t.ende)} Uhr</p>
        <p className="text-lg font-semibold">{t.leistung_name}</p>
        <p>{[t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
      </Link>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Marke ton={AUFTRAG[t.auftrag_status][1]}>{AUFTRAG[t.auftrag_status][0]}</Marke>
        {/* Arbeiten geht auch so, aber jeder sieht, dass der Kunde noch nicht zugestimmt hat. */}
        {!t.auftrag_erteilt_am && t.auftrag_status !== "fertig" ? <Marke ton="warnung">nicht erteilt</Marke> : null}
      </span>
    </div>
  );
}

function NaechsterAuftrag({ t, seit, bisher }: { t: GeplanterTermin; seit: string | null; bisher: number }) {
  return (
    <Karte className="border-l-4 border-tinte">
      <p className="text-sm font-semibold text-grau">{seit ? "Du arbeitest an" : "Als Nächstes"}</p>
      <Kopfzeile t={t} />
      {t.auftrag_beschreibung || t.notiz_kunde ? <p className="mt-2 text-sm text-grau">Kunde: „{t.auftrag_beschreibung || t.notiz_kunde}“</p> : null}
      {t.notiz_intern ? <p className="mt-1 text-sm">Hinweis: {t.notiz_intern}</p> : null}
      {grenzeText(t) ? <p className="mt-2 text-sm font-semibold text-rot">{grenzeText(t)}</p> : null}
      <AuftragKnoepfe id={t.id} status={t.auftrag_status} seit={seit} bisher={bisher} foto={false} />
      <Link href={`/team/auftrag/${t.id}`} className="knopf knopf-rahmen mt-2 w-full">Fahrzeug, Kunde, Befund, Teile</Link>
    </Karte>
  );
}

function AuftragKarte({ t, seit, bisher }: { t: GeplanterTermin; seit: string | null; bisher: number }) {
  return (
    <Karte>
      <Kopfzeile t={t} />
      {t.notiz_intern ? <p className="mt-1 text-sm">Hinweis: {t.notiz_intern}</p> : null}
      {grenzeText(t) ? <p className="mt-2 text-sm font-semibold text-rot">{grenzeText(t)}</p> : null}
      <AuftragKnoepfe id={t.id} status={t.auftrag_status} seit={seit} bisher={bisher} foto={false} />
    </Karte>
  );
}
