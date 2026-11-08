import Link from "next/link";
import { EinlagerungFelder } from "@/components/admin/einlagerung-felder";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Leer, Reiter, Tabelle } from "@/components/admin/ui";
import { einlagern } from "@/lib/aktionen/einlagerung";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Einlagerung" };

const min = (...w: (number | null)[]) => {
  const z = w.filter((x): x is number => x !== null).map(Number);
  return z.length ? Math.min(...z) : null;
};

export default async function Einlagerung({ searchParams }: { searchParams: Promise<{ q?: string; ansicht?: string; neu?: string }> }) {
  await benutzerMitRecht("einlagerung");
  const { q = "", ansicht = "aktiv", neu } = await searchParams;
  let abfrage = db()
    .from("einlagerungen")
    .select("*, kunde:kunden(id, name, telefon), fahrzeug:fahrzeuge(kennzeichen, marke_modell)")
    .order("lagerplatz")
    .limit(500);
  abfrage = ansicht === "aktiv" ? abfrage.is("ausgelagert_am", null) : abfrage.not("ausgelagert_am", "is", null);
  const { data } = await abfrage;
  type Z = Record<string, string | number | null> & { kunde: { name: string } | null; fahrzeug: { kennzeichen: string } | null };
  let liste = (data ?? []) as Z[];
  if (q) {
    const s = q.toLowerCase();
    liste = liste.filter((e) => [e.kunde?.name, e.fahrzeug?.kennzeichen, e.lagerplatz as string].some((x) => x?.toLowerCase().includes(s)));
  }
  return (
    <>
      <Kopf titel="Rädereinlagerung" unter={`${ansicht === "aktiv" ? liste.length : ""}${ansicht === "aktiv" ? " Sätze im Lager" : ""}`}>
        <Link href="/admin/einlagerung?neu=1" className="knopf knopf-dunkel">Räder einlagern</Link>
      </Kopf>
      {neu ? (
        <Abschnitt titel="Räder einlagern">
          <Formular aktion={einlagern} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feld label="Kennzeichen" name="kennzeichen" required />
            <Feld label="Kunde (nur bei neuem Kennzeichen)" name="name" />
            <Feld label="Telefon" name="telefon" typ="tel" />
            <Feld label="E-Mail" name="email" typ="email" />
            <EinlagerungFelder />
            <div className="sm:col-span-2 lg:col-span-4"><Senden>Einlagern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}
      <Reiter aktiv={`/admin/einlagerung?ansicht=${ansicht}`} eintraege={[{ href: "/admin/einlagerung?ansicht=aktiv", text: "Im Lager" }, { href: "/admin/einlagerung?ansicht=ausgelagert", text: "Ausgelagert" }]} />
      <form className="mb-4 max-w-sm">
        <input type="hidden" name="ansicht" value={ansicht} />
        <input name="q" defaultValue={q} placeholder="Kennzeichen, Name oder Lagerplatz" className="feld" aria-label="Suche" />
      </form>
      {liste.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Platz", "Kennzeichen", "Kunde", "Räder", "Größe", { text: "min. Profil", zahl: true }, "Seit"]}>
            {liste.map((e) => {
              const p = min(e.profil_vl as number, e.profil_vr as number, e.profil_hl as number, e.profil_hr as number);
              return (
                <tr key={e.id as string} className="hover:bg-papier">
                  <td className="zahlen font-semibold"><Link href={`/admin/einlagerung/${e.id}`} className="hover:underline">{e.lagerplatz || "–"}</Link></td>
                  <td className="zahlen">{e.fahrzeug?.kennzeichen}</td>
                  <td>{e.kunde?.name}</td>
                  <td>{e.saison === "winter" ? "Winter" : e.saison === "sommer" ? "Sommer" : "Ganzjahr"}{e.mit_felgen ? " mit Felgen" : ""}</td>
                  <td>{e.reifengroesse}</td>
                  <td className={`zahl ${p !== null && p < 4 ? "font-semibold text-rot" : ""}`}>{p === null ? "–" : `${p.toFixed(1).replace(".", ",")} mm`}</td>
                  <td className="zahlen whitespace-nowrap">{datum(e.eingelagert_am as string)}</td>
                </tr>
              );
            })}
          </Tabelle>
          <p className="mt-3 text-sm text-grau">Rot: unter 4 mm Profil, bei Winterreifen ein Grund für einen Hinweis an den Kunden.</p>
        </div>
      ) : (
        <Leer>Keine Einträge.</Leer>
      )}
    </>
  );
}
