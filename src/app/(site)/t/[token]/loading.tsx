import { Laedt, S } from "@/components/skelett";

/** Kundenlink zum Termin: dieselbe Spalte wie die fertige Seite. */
export default function Laden() {
  return (
    <Laedt className="rand max-w-3xl pb-24 pt-8 md:pt-14">
      <S className="mb-3 h-4 w-32" />
      <S className="mb-3 h-10 w-80 max-w-full md:h-12" />
      <S className="mb-8 h-6 w-full max-w-lg" />
      <div className="grid gap-y-4 border-t border-grau-hell pt-5 sm:grid-cols-[10rem_1fr]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="contents">
            <S className="h-5 w-20" />
            <S className="h-5 w-64 max-w-full" />
          </div>
        ))}
      </div>
    </Laedt>
  );
}
