import { KundeNeuFormular } from "@/components/mobil/kunde-neu";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { fahrzeugTypen } from "@/lib/kunden";

export const metadata = { title: "Neuer Kunde" };

export default async function AppNeuerKunde() {
  await benutzerMitRecht("kunden");
  const typen = await fahrzeugTypen();
  return (
    <>
      <MobilKopf titel="Neuer Kunde" unter="Mit erstem Fahrzeug" zurueck="/app" />
      <div className="bg-weiss p-4">
        <KundeNeuFormular typen={typen} />
      </div>
    </>
  );
}
