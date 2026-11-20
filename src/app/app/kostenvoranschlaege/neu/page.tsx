import { BelegStart } from "@/components/admin/beleg-start";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";

export const metadata = { title: "Neuer Kostenvoranschlag" };

export default async function AppNeuerKostenvoranschlag() {
  await benutzerMitRecht("rechnungen");
  const zuletzt = await kundenSuchen("", 8);
  return (
    <>
      <MobilKopf titel="Kostenvoranschlag" unter="Kunde wählen, der Rest ist ausgefüllt" zurueck="/app/kostenvoranschlaege" />
      <div className="bg-weiss p-4">
        <BelegStart art="kostenvoranschlag" ort="app" zuletzt={zuletzt} />
      </div>
    </>
  );
}
