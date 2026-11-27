import { Laedt, S } from "@/components/skelett";

/** Leistungen: Kopfzeile, Überschrift, Angebot, Reiter und die Zeilen des ersten Bereichs, in den Maßen der Seite. */
export default function Laden() {
  return (
    <Laedt className="rand pb-24 pt-10 md:pt-16">
      <S className="h-3 w-40" />
      <S className="mt-4 h-14 w-72 max-w-full md:h-20 md:w-[30rem]" />
      <S className="mt-8 h-44 rounded-lg lg:w-1/2" />
      <S className="mt-10 h-[3.25rem] rounded-lg md:w-96" />
      <S className="mt-8 h-3 w-24" />
      <S className="mt-3 h-10 w-48 md:h-12" />
      <div className="mt-6 grid gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <S key={i} className="h-36 rounded-lg md:h-[4.5rem]" />
        ))}
      </div>
    </Laedt>
  );
}
