import { Formular, Senden } from "@/components/admin/formular";
import { Auswahl, Feld } from "@/components/admin/ui";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { abwesenheitMelden } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Urlaub" };

export default async function Abwesenheit() {
  const b = await benutzerMitRecht("werkstatt");
  const jahr = berlinDatum().slice(0, 4);
  const [{ data }, { data: profil }] = await Promise.all([
    db().from("abwesenheiten").select("*").eq("profil_id", b.id).order("von", { ascending: false }).limit(30),
    db().from("profile").select("urlaubstage").eq("id", b.id).single(),
  ]);
  const genommen = (data ?? [])
    .filter((a) => a.art === "urlaub" && a.status === "genehmigt" && a.von.startsWith(jahr))
    .reduce((s, a) => s + Math.round((new Date(a.bis).getTime() - new Date(a.von).getTime()) / 86400000) + 1, 0);
  return (
    <>
      <MobilKopf titel="Urlaub und krank" unter={profil?.urlaubstage ? `${genommen} von ${profil.urlaubstage} Urlaubstagen ${jahr} verplant (Kalendertage)` : undefined} />
      <div className="grid gap-2 p-2">
        <Karte>
          <Formular aktion={abwesenheitMelden.bind(null, null)} zuruecksetzen className="grid gap-3">
            <Auswahl label="Was?" name="art" optionen={[["urlaub", "Urlaub beantragen"], ["krank", "Krank melden"], ["sonstiges", "Sonstiges (frei)"]]} />
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Von" name="von" typ="date" wert={berlinDatum()} required />
              <Feld label="Bis" name="bis" typ="date" />
            </div>
            <Feld label="Notiz (optional)" name="notiz" />
            <Senden className="w-full">Senden</Senden>
          </Formular>
        </Karte>
        {(data ?? []).map((a) => (
          <Karte key={a.id}>
            <div className="flex justify-between gap-3">
              <span>{a.art === "krank" ? "Krank" : a.art === "urlaub" ? "Urlaub" : "Frei"} · {datum(a.von)} bis {datum(a.bis)}</span>
              <span className={a.status === "genehmigt" ? "text-ok" : a.status === "abgelehnt" ? "text-rot" : "text-grau"}>{a.status}</span>
            </div>
          </Karte>
        ))}
      </div>
    </>
  );
}
