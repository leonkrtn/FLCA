import { Laedt, S } from "@/components/skelett";

/** Drei Spalten wie das Postfach: Ordner, Liste, Lesebereich. */
export default function Laden() {
  return (
    <Laedt className="vollbreite -mx-4 -my-6 grid md:-mx-8 lg:-mx-10 lg:-my-10 lg:h-dvh lg:grid-cols-[13.5rem_minmax(19rem,24rem)_minmax(0,1fr)]">
      <div className="hidden border-r border-linie bg-boden p-4 lg:block">
        <S className="h-11 w-full" />
        {Array.from({ length: 8 }, (_, i) => <S key={i} className="mt-3 h-4 w-3/4" />)}
      </div>
      <div className="border-r border-linie bg-weiss p-3">
        <S className="h-7 w-40" />
        <S className="mt-3 h-9 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="mt-4">
            <S className="h-4 w-1/2" />
            <S className="mt-1.5 h-4 w-5/6" />
            <S className="mt-1.5 h-3.5 w-2/3" />
          </div>
        ))}
      </div>
      <div className="hidden bg-papier lg:block" />
    </Laedt>
  );
}
