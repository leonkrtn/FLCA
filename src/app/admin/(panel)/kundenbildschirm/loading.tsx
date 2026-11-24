import { AbschnittSkelett, KopfSkelett } from "@/components/skelett";

export default function Laden() {
  return (
    <>
      <KopfSkelett knopf={false} />
      <AbschnittSkelett zeilen={3} />
      <AbschnittSkelett zeilen={5} />
    </>
  );
}
