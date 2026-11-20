import { BelegStart } from "@/components/admin/beleg-start";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";

export const metadata = { title: "Neue Rechnung" };

export default async function NeueRechnung() {
  await benutzerMitRecht("rechnungen");
  const zuletzt = await kundenSuchen("", 8);
  return (
    <>
      <Kopf titel="Neue Rechnung" unter="Kunden wählen, Empfänger und Fahrzeug werden übernommen." zurueck={{ href: "/admin/rechnungen", text: "Rechnungen" }} />
      <Abschnitt className="max-w-2xl">
        <BelegStart art="rechnung" ort="admin" zuletzt={zuletzt} />
      </Abschnitt>
    </>
  );
}
