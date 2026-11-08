import Link from "next/link";
import { Logo } from "@/components/logo";
import { Menue, Telefon } from "@/components/icons";
import type { Einstellungen } from "@/lib/einstellungen";
import { telHref } from "@/lib/format";
import { berlinDatum, wochentag } from "@/lib/zeit";

const NAV = [
  { href: "/#preise", label: "Preise" },
  { href: "/leistungen", label: "Leistungen" },
  { href: "/galerie", label: "Galerie" },
  { href: "/karriere", label: "Karriere" },
  { href: "/#anfahrt", label: "Anfahrt" },
];

/** Kopfzeile. Auf dem Telefon nur Logo, „Termin“ und ein Menü ohne JavaScript (details/summary). */
/** „Heute 08:30–13:00, 14:00–18:00“ bzw. „Heute geschlossen“. */
function heuteText(o: Einstellungen["oeffnungszeiten"]): string {
  const f = o[String(wochentag(berlinDatum())) as keyof typeof o];
  return f.length ? `Heute ${f.map(([a, b]) => `${a}–${b}`).join(", ")}` : "Heute geschlossen";
}

export function Kopf({ module, telefon, oeffnungszeiten }: { module: { galerie: boolean; karriere: boolean }; telefon: string; oeffnungszeiten: Einstellungen["oeffnungszeiten"] }) {
  const nav = NAV.filter((n) => (n.href !== "/galerie" || module.galerie) && (n.href !== "/karriere" || module.karriere));
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="rand flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 text-tinte" aria-label="FLC Automotive, zur Startseite">
          <Logo className="h-9 w-auto md:h-10" />
        </Link>
        <nav aria-label="Hauptnavigation" className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-tinte/70 transition-colors hover:text-tinte">
              {n.label}
            </Link>
          ))}
          <a href={telHref(telefon)} className="hidden items-center gap-2 border-l border-linie pl-7 text-sm lg:flex">
            <Telefon className="size-4" />
            <span>
              <span className="zahlen block font-semibold">{telefon}</span>
              <span className="block text-xs text-grau">{heuteText(oeffnungszeiten)}</span>
            </span>
          </a>
          <Link href="/termin" className="knopf knopf-rot knopf-klein">
            Termin anfragen
          </Link>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/termin" className="knopf knopf-rot knopf-klein">
            Termin
          </Link>
          <details className="group relative">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-sm [&::-webkit-details-marker]:hidden" aria-label="Menü">
              <Menue className="size-6" />
            </summary>
            <nav aria-label="Menü" className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl bg-flaeche py-2 shadow-[0_20px_50px_rgb(0_0_0/0.5)] ring-1 ring-linie">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="block px-4 py-3 font-medium">
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
