import Link from "next/link";

/**
 * Kopf der Handy-Apps. Titel immer einzeilig, Unterzeile immer reserviert: Beim Wechsel zwischen den
 * Tabs bleibt der Inhalt darunter an derselben Stelle stehen.
 *
 * Voll deckend und mit dem Abstand für die Statusleiste im Kopf selbst (nicht in der Hülle darum): So
 * reicht er bis an den oberen Rand, iOS 26 erkennt ihn als Leiste und führt seine Farbe unter der Uhr
 * weiter, statt Titel und Knöpfe weichzuzeichnen. Beim Scrollen läuft nichts zwischen Uhr und Kopf durch.
 */
export function MobilKopf({ titel, unter, zurueck, aktion }: { titel: string; unter?: React.ReactNode; zurueck?: string; aktion?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-linie bg-grund px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      {zurueck ? (
        <Link href={zurueck} className="mb-1 inline-block text-sm text-grau">
          ← zurück
        </Link>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="schmal flex h-8 items-center">
            <span className="truncate text-2xl leading-none">{titel}</span>
          </h1>
          <div className="h-5 truncate text-sm leading-5 text-grau">{unter}</div>
        </div>
        {aktion ? <div className="shrink-0">{aktion}</div> : null}
      </div>
    </header>
  );
}

export function Karte({ children, href, className = "" }: { children: React.ReactNode; href?: string; className?: string }) {
  const k = `karte block bg-weiss px-4 py-3 ${className}`;
  return href ? (
    <Link href={href} className={`${k} active:bg-papier`}>
      {children}
    </Link>
  ) : (
    <div className={k}>{children}</div>
  );
}

/** Umschalter zwischen verwandten Listen (Rechnungen und Kostenvoranschläge) unter dem Kopf. */
export function MobilReiter({ eintraege, aktiv }: { eintraege: { href: string; text: string; anzahl?: number }[]; aktiv: string }) {
  return (
    <nav aria-label="Ansicht" className="grid gap-1 bg-boden px-4 py-2" style={{ gridTemplateColumns: `repeat(${eintraege.length}, minmax(0, 1fr))` }}>
      {eintraege.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          aria-current={e.href === aktiv ? "page" : undefined}
          className={`flex min-h-9 items-center justify-center gap-1.5 truncate rounded-sm px-2 text-sm font-semibold ${e.href === aktiv ? "bg-weiss text-tinte shadow-sm" : "text-grau"}`}
        >
          {e.text}
          {e.anzahl ? <span className="zahlen rounded-full bg-tinte px-1.5 text-xs leading-5 text-weiss">{e.anzahl}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
