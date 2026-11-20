import { BelegStart } from "@/components/admin/beleg-start";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";

export const metadata = { title: "Neuer Kostenvoranschlag" };

export default async function NeuerKostenvoranschlag() {
  await benutzerMitRecht("rechnungen");
  const zuletzt = await kundenSuchen("", 8);
  return (
    <>
      <Kopf titel="Neuer Kostenvoranschlag" unter="Kunden wählen, Empfänger und Fahrzeug werden übernommen." zurueck={{ href: "/admin/kostenvoranschlaege", text: "Kostenvoranschläge" }} />
      <Abschnitt className="max-w-2xl">
        <BelegStart art="kostenvoranschlag" ort="admin" zuletzt={zuletzt} />
      </Abschnitt>
    </>
  );
}
