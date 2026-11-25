import { Laedt, S } from "@/components/skelett";

/** Leistungen: Überschrift, je Bereich ein Bildbanner und die Karten darunter, in den Maßen der Seite. */
export default function Laden() {
  return (
    <Laedt className="rand pb-24 pt-10 md:pt-16">
      <S className="mb-14 h-16 w-80 max-w-full md:h-24 md:w-[32rem]" />
      <S className="mb-4 h-56 rounded-lg md:aspect-[21/6] md:h-auto" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <S key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </Laedt>
  );
}
