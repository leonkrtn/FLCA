import Link from "next/link";

/**
 * Kopf der Handy-Apps. Titel immer einzeilig, Unterzeile immer reserviert: Beim Wechsel zwischen den
 * Tabs bleibt der Inhalt darunter an derselben Stelle stehen.
 */
export function MobilKopf({ titel, unter, zurueck, aktion }: { titel: string; unter?: React.ReactNode; zurueck?: string; aktion?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-linie bg-boden/95 px-4 pb-3 pt-3 backdrop-blur-sm">
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
  const k = `block bg-weiss px-4 py-3 ${className}`;
  return href ? (
    <Link href={href} className={`${k} active:bg-papier`}>
      {children}
    </Link>
  ) : (
    <div className={k}>{children}</div>
  );
}
