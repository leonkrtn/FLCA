import { Laedt, S } from "@/components/skelett";

/** Terminseite: Überschrift und die drei Schritte stehen sofort da, die Leistungen folgen. */
export default function Laden() {
  return (
    <Laedt className="rand pb-24 pt-8 md:pt-14">
      <div className="mb-8 max-w-2xl md:mb-12">
        <S className="h-10 w-72 md:h-12" />
        <S className="mt-4 h-5 w-full" />
        <S className="mt-2 h-5 w-3/4" />
      </div>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          {[6, 0, 0].map((karten, i) => (
            <div key={i} className="border-t-2 border-linie pt-5">
              <S className="mb-5 h-7 w-48" />
              {karten ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {Array.from({ length: karten }, (_, k) => (
                    <S key={k} className="h-[4.5rem] rounded-md" />
                  ))}
                </div>
              ) : (
                <S className="h-5 w-80 max-w-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </Laedt>
  );
}
