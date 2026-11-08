import Link from "next/link";
import { Logo } from "@/components/logo";
import { Menue } from "@/components/icons";

const NAV = [
  { href: "/#preise", label: "Preise" },
  { href: "/leistungen", label: "Leistungen" },
  { href: "/galerie", label: "Galerie" },
  { href: "/karriere", label: "Karriere" },
  { href: "/#anfahrt", label: "Anfahrt" },
];

/** Kopfzeile. Auf dem Telefon nur Logo, „Termin“ und ein Menü ohne JavaScript (details/summary). */
export function Kopf({ module }: { module: { galerie: boolean; karriere: boolean } }) {
  const nav = NAV.filter((n) => (n.href !== "/galerie" || module.galerie) && (n.href !== "/karriere" || module.karriere));
  return (
    <header className="sticky top-0 z-40 border-b border-linie bg-boden/95 backdrop-blur-sm">
      <div className="rand flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 text-tinte" aria-label="FLC Automotive, zur Startseite">
          <Logo className="h-9 w-auto md:h-10" />
        </Link>
        <nav aria-label="Hauptnavigation" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-grau transition-colors hover:text-tinte">
              {n.label}
            </Link>
          ))}
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
            <nav aria-label="Menü" className="absolute right-0 top-12 w-56 border border-linie bg-papier py-2 shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
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
