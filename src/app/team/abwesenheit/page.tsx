import { Formular, Senden } from "@/components/admin/formular";
import { Auswahl, Feld } from "@/components/admin/ui";
import { AntragZeitraum } from "@/components/mobil/antrag-hinweis";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { abwesenheitMelden, abwesenheitZurueckziehen } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { urlaubKonten } from "@/lib/mitarbeiter";
import { db } from "@/lib/supabase/admin";
import { berlin, berlinDatum, plusTage } from "@/lib/zeit";

export const metadata = { title: "Urlaub" };

const tage = (n: number) => `${String(n).replace(".", ",")} ${n === 1 ? "Tag" : "Tage"}`;

/**
 * Urlaub beantragen, krank melden, Anträge zurückziehen. Oben das Urlaubskonto; beim Wählen des Zeitraums
 * zeigt die Seite, welche eigenen Aufträge betroffen sind und wer aus dem Team dann schon fehlt.
 */
export default async function Abwesenheit() {
  const b = await benutzerMitRecht("werkstatt");
  const heute = berlinDatum();
  const jahr = heute.slice(0, 4);
  const bis = plusTage(heute, 180);
  const [{ data }, konten, { data: termine }, { data: fehlen }] = await Promise.all([
    db().from("abwesenheiten").select("*").eq("profil_id", b.id).order("von", { ascending: false }).limit(30),
    urlaubKonten(jahr, [b.id]),
    db().from("termine").select("beginn, leistung_name").eq("zugewiesen_an", b.id).in("status", ["angefragt", "bestaetigt"]).gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(bis).toISOString()).order("beginn"),
    db().from("abwesenheiten").select("von, bis, status, profil:profile!abwesenheiten_profil_id_fkey(name)").neq("profil_id", b.id).neq("status", "abgelehnt").gte("bis", heute).lte("von", bis),
  ]);
  const konto = konten.get(b.id);
  return (
    <>
      <MobilKopf titel="Urlaub und krank" unter={konto?.anspruch ? `${tage(konto.rest)} Resturlaub ${jahr}` : undefined} />
      <div className="grid gap-2 p-2">
        {konto?.anspruch ? (
          <Karte>
            <div className="zahlen grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["Anspruch", konto.anspruch],
                  ["Genehmigt", konto.genehmigt],
                  ["Beantragt", konto.beantragt],
                  ["Rest", konto.rest],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <p className={`text-xl ${k === "Rest" ? "font-semibold" : ""} ${k === "Rest" && v < 0 ? "text-rot" : ""}`}>{String(v).replace(".", ",")}</p>
                  <p className="font-sans text-xs text-grau">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-grau">Gezählt werden deine Arbeitstage laut Wochenplan, ein halber Tag zählt 0,5.</p>
          </Karte>
        ) : null}
        <Karte>
          <Formular aktion={abwesenheitMelden.bind(null, null)} zuruecksetzen className="grid gap-3">
            <Auswahl label="Was?" name="art" optionen={[["urlaub", "Urlaub beantragen"], ["krank", "Krank melden"], ["sonstiges", "Sonstiges (frei)"]]} />
            <AntragZeitraum
              vorgabe={heute}
              rest={konto?.anspruch ? konto.rest : null}
              auftraege={(termine ?? []).map((t) => ({ tag: berlinDatum(new Date(t.beginn)), text: t.leistung_name }))}
              kollegen={((fehlen ?? []) as unknown as { von: string; bis: string; status: string; profil: { name: string } | null }[]).map((a) => ({ name: a.profil?.name || "jemand", von: a.von, bis: a.bis, beantragt: a.status === "beantragt" }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Ab Uhrzeit (halber Tag)" name="von_zeit" typ="time" />
              <Feld label="Bis Uhrzeit" name="bis_zeit" typ="time" />
            </div>
            <Feld label="Notiz (optional)" name="notiz" />
            <p className="text-xs text-grau">Krank gilt sofort; deine Aufträge gehen dann an Kollegen, die frei sind.</p>
            <Senden className="w-full" vorab="Gesendet">Senden</Senden>
          </Formular>
        </Karte>
        {(data ?? []).map((a) => (
          <Karte key={a.id}>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                {a.art === "krank" ? "Krank" : a.art === "urlaub" ? "Urlaub" : "Frei"} · {datum(a.von)}
                {a.bis !== a.von ? ` bis ${datum(a.bis)}` : ""}
                {a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)} Uhr` : ""}
              </span>
              <span className={`shrink-0 ${a.status === "genehmigt" ? "text-ok" : a.status === "abgelehnt" ? "text-rot" : "text-grau"}`}>{a.status}</span>
            </div>
            {a.status === "beantragt" ? (
              <Formular aktion={abwesenheitZurueckziehen.bind(null, a.id)} bestaetigen="Antrag zurückziehen?" className="mt-2">
                <Senden art="rahmen" klein vorab="Zurückgezogen">Zurückziehen</Senden>
              </Formular>
            ) : null}
          </Karte>
        ))}
      </div>
    </>
  );
}
