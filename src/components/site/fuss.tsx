import Link from "next/link";
import { Logo } from "@/components/logo";
import type { Einstellungen } from "@/lib/einstellungen";
import { WOCHENTAGE } from "@/lib/einstellungen";
import { telHref } from "@/lib/format";

function zeitenZusammenfassen(o: Einstellungen["oeffnungszeiten"]): [string, string][] {
  const zeilen: [string, string][] = [];
  const tage = (["1", "2", "3", "4", "5", "6", "7"] as const).map((t) => ({
    tag: WOCHENTAGE[Number(t) - 1].slice(0, 2),
    text: o[t].length ? o[t].map(([a, b]) => `${a}–${b}`).join(", ") : "geschlossen",
  }));
  for (let i = 0; i < tage.length; ) {
    let j = i;
    while (j + 1 < tage.length && tage[j + 1].text === tage[i].text) j++;
    zeilen.push([i === j ? tage[i].tag : `${tage[i].tag}–${tage[j].tag}`, tage[i].text]);
    i = j + 1;
  }
  return zeilen;
}

export function Fuss({ e }: { e: Einstellungen }) {
  const f = e.firma;
  return (
    <footer className="bg-graphit pb-28 pt-14 text-tinte md:pb-14">
      <div className="rand grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Logo className="h-14 w-auto text-tinte md:h-20" />
        </div>
        <div className="text-sm leading-relaxed">
          <p className="mb-2 font-semibold text-hell">Werkstatt</p>
          <p>
            {f.strasse}
            <br />
            {f.plz} {f.ort}
          </p>
          <p className="mt-2 text-grau-hell">{f.hinweisAnfahrt}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-hell">Öffnungszeiten</p>
          <table className="zahlen text-[13px]">
            <tbody>
              {zeitenZusammenfassen(e.oeffnungszeiten).map(([tag, zeit]) => (
                <tr key={tag}>
                  <td className="pr-4 align-top font-sans">{tag}</td>
                  <td>{zeit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-hell">Kontakt</p>
          {/* Je Zeile ein eigenes Ziel mit Höhe für den Daumen, nicht nur so hoch wie die Schrift */}
          <p className="flex flex-col items-start">
            <a href={telHref(f.telefon)} className="py-1.5 hover:text-hell">
              {f.telefon}
            </a>
            <a href={`mailto:${f.email}`} className="py-1.5 hover:text-hell">
              {f.email}
            </a>
            {f.instagram ? (
              <a href={`https://www.instagram.com/${f.instagram}/`} className="py-1.5 hover:text-hell" rel="noopener noreferrer">
                Instagram @{f.instagram}
              </a>
            ) : null}
          </p>
        </div>
      </div>
      {/* Die Links waren nur so hoch wie die kleine Schrift (18 px) und am Telefon schwer zu treffen: py-3 */}
      <div className="rand mt-12 flex flex-wrap items-center gap-x-6 border-t border-white/10 pt-3 text-xs text-grau-hell">
        <span className="py-3">© {new Date().getFullYear()} {f.name}</span>
        <Link href="/impressum" className="py-3 hover:text-hell">Impressum</Link>
        <Link href="/datenschutz" className="py-3 hover:text-hell">Datenschutz</Link>
        <Link href="/agb" className="py-3 hover:text-hell">AGB</Link>
        <Link href="/widerruf" className="py-3 hover:text-hell">Widerruf</Link>
        <Link href="/login" className="py-3 hover:text-hell">Mitarbeiter-Login</Link>
      </div>
    </footer>
  );
}
