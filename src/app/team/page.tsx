import { Formular, Senden } from "@/components/admin/formular";
import { Marke } from "@/components/admin/ui";
import { AuftragKnoepfe } from "@/components/mobil/auftrag";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { stempeln } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { datumLangText, zeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, plusTage, wochentag } from "@/lib/zeit";
import { monatszeiten, stunden } from "@/lib/zeiterfassung";

export const metadata = { title: "Heute" };

const AUFTRAG: Record<string, [string, "hell" | "warnung" | "ok"]> = { offen: ["offen", "hell"], in_arbeit: ["in Arbeit", "warnung"], fertig: ["fertig", "ok"] };

export default async function TeamHeute() {
  const b = await benutzerMitRecht("werkstatt");
  const { module } = await einstellungen();
  const heute = berlinDatum();
  const [{ data: auftraege }, { data: zeiten }, { data: offen }, { data: abw }] = await Promise.all([
    db().from("termine").select(TERMIN_FELDER).eq("zugewiesen_an", b.id).in("status", ["bestaetigt", "erledigt"]).gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(plusTage(heute, 1)).toISOString()).order("beginn"),
    db().from("arbeitszeiten").select("beginn, ende").eq("profil_id", b.id).eq("wochentag", wochentag(heute)).order("beginn"),
    db().from("zeiteintraege").select("beginn").eq("profil_id", b.id).is("ende", null).maybeSingle(),
    db().from("abwesenheiten").select("art").eq("profil_id", b.id).lte("von", heute).gte("bis", heute).eq("status", "genehmigt").maybeSingle(),
  ]);
  const zeiterfassung = module.zeiterfassung && b.zeiterfassung;
  const monat = zeiterfassung ? await monatszeiten(b.id, heute.slice(0, 7)) : null;

  return (
    <>
      <MobilKopf titel={`Hallo${b.name ? ` ${b.name.split(" ")[0]}` : ""}`} unter={datumLangText(heute)} />
      <div className="grid gap-2 p-2">
        <Karte>
          <p className="text-sm text-grau">Deine Zeit heute</p>
          <p className="zahlen text-2xl">
            {abw ? (abw.art === "krank" ? "krank gemeldet" : "frei") : zeiten?.length ? zeiten.map((z) => `${z.beginn.slice(0, 5)}–${z.ende.slice(0, 5)}`).join(", ") : "frei"}
          </p>
        </Karte>
        {zeiterfassung ? (
          <Karte>
            <Formular aktion={stempeln} className="grid gap-2">
              <p className="text-sm text-grau">
                {offen ? `Eingestempelt seit ${zeit(offen.beginn)} Uhr` : "Nicht eingestempelt"} · Monat: {stunden(monat!.minuten)}
              </p>
              <Senden art={offen ? "rahmen" : "rot"} className="min-h-14 w-full text-lg" vorab={offen ? "Ausgestempelt" : "Eingestempelt"}>
                {offen ? "Ausstempeln" : "Einstempeln"}
              </Senden>
            </Formular>
          </Karte>
        ) : null}
        <h2 className="px-2 pt-4 font-semibold">Deine Aufträge heute</h2>
        {((auftraege ?? []) as Termin[]).map((t) => (
          <Karte key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="zahlen text-sm text-grau">{zeit(t.beginn)}–{zeit(t.ende)} Uhr</p>
                <p className="text-lg font-semibold">{t.leistung_name}</p>
                <p>{[t.fahrzeug?.kennzeichen, t.fahrzeug?.marke_modell].filter(Boolean).join(" · ")}</p>
                {t.notiz_kunde ? <p className="mt-1 text-sm text-grau">Kunde: „{t.notiz_kunde}“</p> : null}
                {t.notiz_intern ? <p className="mt-1 text-sm">Hinweis: {t.notiz_intern}</p> : null}
              </div>
              <Marke ton={AUFTRAG[t.auftrag_status][1]}>{AUFTRAG[t.auftrag_status][0]}</Marke>
            </div>
            <AuftragKnoepfe id={t.id} status={t.auftrag_status} />
          </Karte>
        ))}
        {!auftraege?.length ? <p className="px-2 py-6 text-center text-grau">Heute ist dir kein Auftrag zugewiesen.</p> : null}
      </div>
    </>
  );
}
