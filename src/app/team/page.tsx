import Link from "next/link";
import { Marke } from "@/components/admin/ui";
import { AuftragKnoepfe } from "@/components/mobil/auftrag";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { Stempeln } from "@/components/mobil/stempeln";
import { grenzeText } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datumLangText, zeit } from "@/lib/format";
import { planPersonen } from "@/lib/mitarbeiter";
import { faelligeAnzahl } from "@/lib/notizen";
import { abwesenheitAm, abwesenheitText, arbeitsfenster } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, plusTage } from "@/lib/zeit";
import { monatszeiten, stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Heute" };

const AUFTRAG: Record<string, [string, "hell" | "warnung" | "ok"]> = { offen: ["offen", "hell"], in_arbeit: ["in Arbeit", "warnung"], fertig: ["fertig", "ok"] };

export default async function TeamHeute() {
  const b = await benutzerMitRecht("werkstatt");
  const { module, standort } = await einstellungen();
  const heute = berlinDatum();
  const [{ data: auftraege }, plan, { data: offen }, erinnerungen] = await Promise.all([
    db().from("termine").select(TERMIN_FELDER).eq("zugewiesen_an", b.id).in("status", ["bestaetigt", "erledigt"]).gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(plusTage(heute, 1)).toISOString()).order("beginn"),
    planPersonen(heute, heute, false).then((alle) => alle.find((p) => p.id === b.id) ?? null),
    db().from("zeiteintraege").select("beginn").eq("profil_id", b.id).is("ende", null).maybeSingle(),
    faelligeAnzahl(b),
  ]);
  // Wochenplan, Ausnahme für heute und Abwesenheit (auch halbe Tage) wie in der Planung
  const abw = plan ? abwesenheitAm(plan, heute) : null;
  const fenster = plan ? arbeitsfenster(plan, heute) : [];
  const zeiterfassung = module.zeiterfassung && b.zeiterfassung;
  const monat = zeiterfassung ? await monatszeiten(b.id, heute.slice(0, 7)) : null;

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
        <Karte>
          <p className="text-sm text-grau">Deine Zeit heute</p>
          <p className="zahlen text-2xl">
            {abw && !abw.von_zeit ? (abw.art === "krank" ? "krank gemeldet" : "frei") : fenster.length ? fenster.map(([a, z]) => `${a}–${z}`).join(", ") : "frei"}
          </p>
          {abw?.von_zeit ? <p className="text-sm text-grau">{abwesenheitText(abw)} {abw.von_zeit.slice(0, 5)}–{abw.bis_zeit?.slice(0, 5)} Uhr</p> : null}
        </Karte>
        {zeiterfassung ? (
          <Karte>
            <Stempeln
              eingestempelt={Boolean(offen)}
              nurVorOrt={standort.nurVorOrt && standort.lat !== null && standort.lng !== null}
              text={`${offen ? `Eingestempelt seit ${zeit(offen.beginn)} Uhr` : "Nicht eingestempelt"} · Monat: ${stunden(monat!.minuten)}`}
            />
          </Karte>
        ) : null}
        <h2 className="px-2 pt-4 font-semibold">Deine Aufträge heute</h2>
        {((auftraege ?? []) as Termin[]).map((t) => (
          <Karte key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="zahlen text-sm text-grau">{zeit(t.beginn)}–{zeit(t.ende)} Uhr</p>
                <p className="text-lg font-semibold">{t.leistung_name}</p>
                <p>{[t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
                {t.auftrag_beschreibung || t.notiz_kunde ? <p className="mt-1 text-sm text-grau">Kunde: „{t.auftrag_beschreibung || t.notiz_kunde}“</p> : null}
                {t.notiz_intern ? <p className="mt-1 text-sm">Hinweis: {t.notiz_intern}</p> : null}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Marke ton={AUFTRAG[t.auftrag_status][1]}>{AUFTRAG[t.auftrag_status][0]}</Marke>
                {/* Arbeiten geht auch so, aber jeder sieht, dass der Kunde noch nicht zugestimmt hat. */}
                {!t.auftrag_erteilt_am && t.auftrag_status !== "fertig" ? <Marke ton="warnung">nicht erteilt</Marke> : null}
              </span>
            </div>
            {grenzeText(t) ? <p className="mt-2 text-sm font-semibold text-rot">{grenzeText(t)}</p> : null}
            <AuftragKnoepfe id={t.id} status={t.auftrag_status} />
          </Karte>
        ))}
        {!auftraege?.length ? <p className="px-2 py-6 text-center text-grau">Heute ist dir kein Auftrag zugewiesen.</p> : null}
      </div>
    </>
  );
}
