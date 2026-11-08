/**
 * Platzhalter, solange eine Seite lädt. Sie stehen dort, wo später der Inhalt steht, in derselben Größe,
 * damit beim Einblenden nichts springt. Die Farbe kommt aus „linie“ und passt damit hell wie dunkel.
 */
export function S({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={`skelett ${className}`} style={style} />;
}

/** Hülle für eine ladende Seite: Screenreader hören „Wird geladen“ statt einer Reihe leerer Kästen. */
export function Laedt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Wird geladen</span>
      {children}
    </div>
  );
}

/** Seitenkopf im Admin (Titel, Unterzeile, Knopf rechts) in den Maßen von <Kopf>. */
export function KopfSkelett({ knopf = true }: { knopf?: boolean }) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex h-12 items-center justify-between gap-4">
        <S className="h-8 w-56 md:h-9" />
        {knopf ? <S className="h-12 w-40" /> : null}
      </div>
      <S className="mt-1 h-5 w-72 max-w-full" />
    </div>
  );
}

/** Tabelle im Admin, im weißen Kasten wie auf den Listenseiten, mit gleich hohen Zeilen wie <Tabelle>. */
export function TabelleSkelett({ zeilen = 8, spalten = 5 }: { zeilen?: number; spalten?: number }) {
  const breiten = ["w-24", "w-40", "w-32", "w-20", "w-16", "w-24", "w-12"];
  const reihe = (hoehe: string) =>
    Array.from({ length: spalten }, (_, i) => <S key={i} className={`${hoehe} ${breiten[i % breiten.length]} ${i === spalten - 1 ? "ml-auto" : ""}`} />);
  return (
    <div className="bg-weiss p-4 md:p-6">
      <div className="flex items-center gap-6 border-b-2 border-tinte py-2.5">{reihe("h-4")}</div>
      {Array.from({ length: zeilen }, (_, z) => (
        <div key={z} className="flex items-center gap-6 border-b border-linie py-3.5">
          {reihe("h-4")}
        </div>
      ))}
    </div>
  );
}

/** Kasten wie <Abschnitt> mit Überschrift und Zeilen darin. */
export function AbschnittSkelett({ zeilen = 3 }: { zeilen?: number }) {
  return (
    <div className="mb-8 bg-weiss p-4 md:p-6">
      <div className="mb-4 flex h-9 items-center">
        <S className="h-5 w-48" />
      </div>
      <div className="divide-y divide-linie">
        {Array.from({ length: zeilen }, (_, i) => (
          <div key={i} className="flex items-center gap-4 py-3.5">
            <S className="h-5 w-14" />
            <div className="flex-1">
              <S className="h-4 w-1/2" />
              <S className="mt-2 h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Handy-Apps: Kopfzeile wie <MobilKopf>, darunter Karten wie <Karte> mit Uhrzeit, Titel, Zeile. */
export function MobilSkelett({ karten = 5 }: { karten?: number }) {
  return (
    <Laedt>
      <div className="border-b border-linie px-4 pb-3 pt-3">
        <div className="flex h-8 items-center">
          <S className="h-6 w-40" />
        </div>
        <div className="flex h-5 items-center">
          <S className="h-3.5 w-32" />
        </div>
      </div>
      <div className="grid gap-px bg-linie">
        {Array.from({ length: karten }, (_, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 bg-weiss px-4 py-3">
            <S className="h-5 w-11" />
            <div>
              <S className="h-4 w-3/4" />
              <S className="mt-1.5 h-3.5 w-1/2" />
            </div>
            <S className="h-5 w-16" />
          </div>
        ))}
      </div>
    </Laedt>
  );
}

/** Listenseite im Admin: Kopf, Reiter, Suchfeld, Tabelle. */
export function ListeSkelett({ reiter = true, spalten = 6 }: { reiter?: boolean; spalten?: number }) {
  return (
    <Laedt>
      <KopfSkelett />
      {reiter ? (
        <div className="mb-6 flex gap-6 border-b border-linie pb-3">
          {[20, 24, 20, 16].map((b, i) => (
            <S key={i} className="h-4" style={{ width: `${b * 4}px` }} />
          ))}
        </div>
      ) : null}
      <S className="mb-4 h-11 w-full max-w-sm" />
      <TabelleSkelett spalten={spalten} />
    </Laedt>
  );
}

/** Detailseite im Admin: Zurück-Link, Kopf, links breite Kästen, rechts schmale. */
export function DetailSkelett() {
  return (
    <Laedt>
      <S className="mb-3 h-4 w-28" />
      <KopfSkelett />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <AbschnittSkelett zeilen={4} />
          <AbschnittSkelett zeilen={2} />
        </div>
        <AbschnittSkelett zeilen={3} />
      </div>
    </Laedt>
  );
}
