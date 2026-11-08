import { Laedt, S } from "@/components/skelett";

/** Unterseiten der Website: Kopf und Fuß bleiben stehen, nur der Inhalt wartet, in seinen Maßen. */
export default function Laden() {
  return (
    <Laedt className="rand pb-24 pt-8 md:pt-14">
      <S className="h-11 w-72 max-w-full md:h-14 md:w-96" />
      <S className="mt-4 h-5 w-full max-w-xl" />
      <S className="mt-2 h-5 w-2/3 max-w-md" />
      <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <S key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    </Laedt>
  );
}
