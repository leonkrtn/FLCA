import { Ausblenden } from "@/components/admin/formular";
import { ErinnerungsMarke, NotizKnoepfe } from "@/components/admin/notizen";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { type Notiz, notizenLaden } from "@/lib/notizen";
import { jetztMs } from "@/lib/zeit";

export const metadata = { title: "Erinnerungen" };

/** Team-App: Erinnerungen, die an mich gehen. Anlegen geht in der Verwaltung und der Werkstatt-App. */
export default async function TeamNotizen() {
  const b = await benutzerMitRecht("werkstatt");
  const [offen, erledigt] = await Promise.all([
    notizenLaden(b, { nurMeine: true, ansicht: "offen", limit: 100 }),
    notizenLaden(b, { nurMeine: true, ansicht: "erledigt", limit: 10 }),
  ]);
  const jetzt = jetztMs();
  // Erledigt und wieder öffnen schieben die Karte in die andere Liste: Sie verschwindet beim Tippen sofort.
  const karte = (n: Notiz) => (
    <Ausblenden key={n.id}>
      <Karte>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{n.titel || "Notiz"}</p>
            {n.text ? <p className="whitespace-pre-line text-sm">{n.text}</p> : null}
            <p className="text-xs text-grau">{[n.autor?.name ? `von ${n.autor.name}` : null, n.kunde?.name, n.termin ? `Termin Nr. ${n.termin.nummer}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="shrink-0">
            <ErinnerungsMarke n={n} jetzt={jetzt} />
          </span>
        </div>
        <NotizKnoepfe n={n} gross ausblenden />
      </Karte>
    </Ausblenden>
  );
  return (
    <>
      <MobilKopf titel="Erinnerungen" unter={`${offen.length} offen`} zurueck="/team/mehr" />
      <div className="grid gap-2 p-2">
        {offen.map(karte)}
        {!offen.length ? <p className="px-2 py-6 text-center text-grau">Keine offenen Erinnerungen.</p> : null}
        {erledigt.length ? <h2 className="px-2 pt-4 font-semibold">Zuletzt erledigt</h2> : null}
        {erledigt.map(karte)}
      </div>
    </>
  );
}
