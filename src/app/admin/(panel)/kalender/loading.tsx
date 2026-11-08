import { KopfSkelett, Laedt, S } from "@/components/skelett";

/** Wochenkalender: Kopf und das Raster der sieben Tage stehen sofort, die Termine folgen. */
export default function Laden() {
  return (
    <Laedt>
      <KopfSkelett />
      <div className="grid grid-cols-7 gap-px bg-linie">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="min-h-[28rem] bg-weiss p-2">
            <S className="mb-4 h-4 w-12" />
            <S className="h-16 w-full" />
            {i % 2 ? <S className="mt-2 h-24 w-full" /> : null}
          </div>
        ))}
      </div>
    </Laedt>
  );
}
