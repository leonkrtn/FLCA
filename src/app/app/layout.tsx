import { after } from "next/server";
import type { Metadata, Viewport } from "next";
import { Kalender, Liste, Mehr, Plus, Dokument } from "@/components/icons";
import { TabLeiste } from "@/components/mobil/leiste";
import { PushAbgleich } from "@/components/mobil/push-abgleich";
import { benutzerMitRecht } from "@/lib/auth";
import { erinnerungenNachholen } from "@/lib/automatik";
import { db } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { default: "Werkstatt", template: "%s · Werkstatt" },
  manifest: "/app/manifest.webmanifest",
  // Statusleiste „default“ wie in der Team-App: Mit „black-translucent“ läuft die Seite unter die Uhr, iOS 26
  // legt dort eine Unschärfe über Titel und Knöpfe und meldet die Fensterhöhe um die Statusleiste zu klein,
  // sodass die Tab-Leiste unten abgeschnitten über einem hellen Streifen hing.
  appleWebApp: { capable: true, title: "Werkstatt", statusBarStyle: "default" },
  icons: { apple: "/icons/app-apple.png" },
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#ecebe7", viewportFit: "cover" };

/**
 * Handy-App für Inhaber und Büro: nur das, was unterwegs zählt (heute, Anfragen, über das „+“ Termin,
 * Kostenvoranschlag, Rechnung oder Kunde anlegen oder per Sprache Notiz, Termin, Rechnung oder Kostenvoranschlag). Alles andere steht im großen Admin am Rechner.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await benutzerMitRecht("termine");
  // Fällige Erinnerungen nachholen, falls die Zeitsteuerung nicht anruft (nach der Antwort, bremst nichts)
  after(() => erinnerungenNachholen().catch((e) => console.error("Erinnerungen nachholen fehlgeschlagen", e)));
  const { count } = await db().from("termine").select("id", { count: "exact", head: true }).eq("status", "angefragt");
  return (
    <div className="handy-app min-h-dvh bg-boden pb-[calc(4.5rem+env(safe-area-inset-bottom))]" data-leiste="dunkel">
      <div className="mx-auto max-w-xl">{children}</div>
      <PushAbgleich />
      <TabLeiste
        dunkel
        tabs={[
          { href: "/app", text: "Heute", icon: <Kalender /> },
          { href: "/app/anfragen", text: "Anfragen", icon: <Liste />, anzahl: count ?? 0 },
          {
            href: "/app/neu",
            text: "Neu",
            icon: <Plus className="size-5" />,
            hervorgehoben: true,
            menue: [
              { href: "/app/sprechen", text: "Sprechen" },
              { href: "/app/neu", text: "Termin" },
              { href: "/app/kostenvoranschlaege/neu", text: "Kostenvoranschlag" },
              { href: "/app/rechnungen/neu", text: "Rechnung" },
              { href: "/app/kunden/neu", text: "Kunde" },
              { href: "/app/notizen/neu", text: "Notiz" },
            ],
          },
          { href: "/app/rechnungen", text: "Rechnungen", icon: <Dokument />, auch: ["/app/kostenvoranschlaege"] },
          { href: "/app/mehr", text: "Mehr", icon: <Mehr /> },
        ]}
      />
    </div>
  );
}
