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
    <footer className="bg-graphit pb-28 pt-14 text-boden md:pb-14">
      <div className="rand grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Logo className="h-14 w-auto text-boden" />
        </div>
        <div className="text-sm leading-relaxed">
          <p className="mb-2 font-semibold text-weiss">Werkstatt</p>
          <p>
            {f.strasse}
            <br />
            {f.plz} {f.ort}
          </p>
          <p className="mt-2 text-grau-hell">{f.hinweisAnfahrt}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-weiss">Öffnungszeiten</p>
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
          <p className="mb-2 font-semibold text-weiss">Kontakt</p>
          <p>
            <a href={telHref(f.telefon)} className="hover:text-weiss">
              {f.telefon}
            </a>
            <br />
            <a href={`mailto:${f.email}`} className="hover:text-weiss">
              {f.email}
            </a>
            {f.instagram ? (
              <>
                <br />
                <a href={`https://www.instagram.com/${f.instagram}/`} className="hover:text-weiss" rel="noopener noreferrer">
                  Instagram @{f.instagram}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="rand mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs text-grau-hell">
        <span>© {new Date().getFullYear()} {f.name}</span>
        <Link href="/impressum" className="hover:text-weiss">Impressum</Link>
        <Link href="/datenschutz" className="hover:text-weiss">Datenschutz</Link>
        <Link href="/agb" className="hover:text-weiss">AGB</Link>
        <Link href="/login" className="hover:text-weiss">Mitarbeiter-Login</Link>
      </div>
    </footer>
  );
}
