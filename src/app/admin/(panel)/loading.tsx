import { AbschnittSkelett, KopfSkelett, Laedt } from "@/components/skelett";

/**
 * Übersicht der Verwaltung. Die Seitenleiste bleibt stehen, rechts erscheinen sofort die Kästen in ihrer
 * späteren Anordnung. Listen- und Detailseiten haben eigene Platzhalter in ihren Ordnern.
 */
export default function Laden() {
  return (
    <Laedt>
      <KopfSkelett knopf={false} />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <AbschnittSkelett zeilen={4} />
          <AbschnittSkelett zeilen={3} />
        </div>
        <div>
          <AbschnittSkelett zeilen={1} />
          <AbschnittSkelett zeilen={2} />
        </div>
      </div>
    </Laedt>
  );
}
