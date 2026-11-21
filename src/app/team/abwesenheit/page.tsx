import { Formular, Senden } from "@/components/admin/formular";
import { Auswahl, Feld } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { abwesenheitMelden } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { planPersonen } from "@/lib/mitarbeiter";
import { urlaubstage } from "@/lib/planung";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Urlaub" };

export default async function Abwesenheit() {
  const b = await benutzerMitRecht("werkstatt");
  const jahr = berlinDatum().slice(0, 4);
  const [{ data }, { data: profil }, plan] = await Promise.all([
    db().from("abwesenheiten").select("*").eq("profil_id", b.id).order("von", { ascending: false }).limit(30),
    db().from("profile").select("urlaubstage").eq("id", b.id).single(),
    planPersonen(`${jahr}-01-01`, `${jahr}-12-31`, false).then((alle) => alle.find((p) => p.id === b.id)),
  ]);
  // Gezählt werden Arbeitstage laut Wochenplan, ein halber Tag zählt 0,5 (wie in der Verwaltung)
  const genommen = (data ?? [])
    .filter((a) => a.art === "urlaub" && a.status === "genehmigt")
    .reduce((s, a) => s + urlaubstage(plan ?? { wochenplan: [], ausnahmen: {} }, a, jahr), 0);
  return (
    <>
      <MobilKopf titel="Urlaub und krank" unter={profil?.urlaubstage ? `${String(genommen).replace(".", ",")} von ${profil.urlaubstage} Urlaubstagen ${jahr} verplant` : undefined} />
      <div className="grid gap-2 p-2">
        <Karte>
          <Formular aktion={abwesenheitMelden.bind(null, null)} zuruecksetzen className="grid gap-3">
            <Auswahl label="Was?" name="art" optionen={[["urlaub", "Urlaub beantragen"], ["krank", "Krank melden"], ["sonstiges", "Sonstiges (frei)"]]} />
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Von" name="von" typ="date" wert={berlinDatum()} required />
              <Feld label="Bis" name="bis" typ="date" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Ab Uhrzeit (halber Tag)" name="von_zeit" typ="time" />
              <Feld label="Bis Uhrzeit" name="bis_zeit" typ="time" />
            </div>
            <Feld label="Notiz (optional)" name="notiz" />
            <Senden className="w-full" vorab="Gesendet">Senden</Senden>
          </Formular>
        </Karte>
        {(data ?? []).map((a) => (
          <Karte key={a.id}>
            <div className="flex justify-between gap-3">
              <span className="min-w-0">
                {a.art === "krank" ? "Krank" : a.art === "urlaub" ? "Urlaub" : "Frei"} · {datum(a.von)}
                {a.bis !== a.von ? ` bis ${datum(a.bis)}` : ""}
                {a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)} Uhr` : ""}
              </span>
              <span className={`shrink-0 ${a.status === "genehmigt" ? "text-ok" : a.status === "abgelehnt" ? "text-rot" : "text-grau"}`}>{a.status}</span>
            </div>
          </Karte>
        ))}
      </div>
    </>
  );
}
