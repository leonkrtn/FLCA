import { BelegStart } from "@/components/admin/beleg-start";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";

export const metadata = { title: "Neue Rechnung" };

export default async function AppNeueRechnung() {
  await benutzerMitRecht("rechnungen");
  const zuletzt = await kundenSuchen("", 8);
  return (
    <>
      <MobilKopf titel="Neue Rechnung" unter="Kunde wählen, der Rest ist ausgefüllt" zurueck="/app/rechnungen" />
      <div className="bg-weiss p-4">
        <BelegStart art="rechnung" ort="app" zuletzt={zuletzt} />
      </div>
    </>
  );
}
