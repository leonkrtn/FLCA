import { after } from "next/server";
import type { Metadata, Viewport } from "next";
import { Kalender, Liste, Mehr, Uhr, Person } from "@/components/icons";
import { TabLeiste } from "@/components/mobil/leiste";
import { PushAbgleich } from "@/components/mobil/push-abgleich";
import { benutzerMitRecht } from "@/lib/auth";
import { erinnerungenNachholen } from "@/lib/automatik";
import { einstellungen } from "@/lib/einstellungen";
import { weich } from "@/lib/fehler";

export const metadata: Metadata = {
  title: { default: "Team", template: "%s · FLC Team" },
  manifest: "/team/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FLC Team", statusBarStyle: "default" },
  icons: { apple: "/icons/team-apple.png" },
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#ecebe7", viewportFit: "cover" };

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const b = await benutzerMitRecht("werkstatt");
  // Fällige Erinnerungen nachholen, falls die Zeitsteuerung nicht anruft (nach der Antwort, bremst nichts)
  after(() => weich(erinnerungenNachholen(), undefined, "Erinnerungen nachholen"));
  const { module } = await einstellungen();
  const zeiten = module.zeiterfassung && b.zeiterfassung;
  return (
    <div className="handy-app min-h-dvh bg-boden pb-[calc(4.5rem+env(safe-area-inset-bottom))]" data-leiste="hell">
      <div className="mx-auto max-w-xl">{children}</div>
      <PushAbgleich />
      <TabLeiste
        tabs={[
          { href: "/team", text: "Heute", icon: <Liste /> },
          { href: "/team/woche", text: "Woche", icon: <Kalender /> },
          { href: "/team/abwesenheit", text: "Urlaub", icon: <Person /> },
          ...(zeiten ? [{ href: "/team/zeiten", text: "Zeiten", icon: <Uhr /> }] : []),
          { href: "/team/mehr", text: "Mehr", icon: <Mehr /> },
        ]}
      />
    </div>
  );
}
