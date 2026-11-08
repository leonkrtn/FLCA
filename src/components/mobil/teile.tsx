import Link from "next/link";

export function MobilKopf({ titel, unter, zurueck, aktion }: { titel: string; unter?: React.ReactNode; zurueck?: string; aktion?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-linie bg-boden/95 px-4 pb-3 pt-3 backdrop-blur-sm">
      {zurueck ? (
        <Link href={zurueck} className="mb-1 inline-block text-sm text-grau">
          ← zurück
        </Link>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="schmal text-2xl">{titel}</h1>
          {unter ? <div className="text-sm text-grau">{unter}</div> : null}
        </div>
        {aktion}
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
