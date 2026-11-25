import { Laedt, S } from "@/components/skelett";

/** Karriere: Foto-Kopf unter dem Seitenkopf, darunter Stellenkarten, in den Maßen der Seite. */
export default function Laden() {
  return (
    <Laedt>
      <S className="-mt-16 h-[26rem] rounded-none md:h-[34rem]" />
      <div className="rand pt-16 md:pt-24">
        <S className="h-9 w-56 md:h-14 md:w-80" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <S className="h-56 rounded-lg" />
          <S className="h-56 rounded-lg" />
        </div>
      </div>
    </Laedt>
  );
}
