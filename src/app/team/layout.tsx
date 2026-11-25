import { NachTastatur } from "@/components/nach-tastatur";
import { after } from "next/server";
import { Auffrischen } from "@/components/auffrischen";
import type { Metadata, Viewport } from "next";
import { Brief, Kalender, Liste, Mehr, Uhr, Person } from "@/components/icons";
import { TabLeiste } from "@/components/mobil/leiste";
import { PushAbgleich } from "@/components/mobil/push-abgleich";
import { benutzerMitRecht } from "@/lib/auth";
import { erinnerungenNachholen } from "@/lib/automatik";
import { einstellungen } from "@/lib/einstellungen";
import { weich } from "@/lib/fehler";
import { ungelesen, zugang } from "@/lib/mail/postfach";

export const metadata: Metadata = {
  title: { default: "Team", template: "%s · FLC Team" },
  manifest: "/team/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FLC Team", statusBarStyle: "default" },
  icons: { apple: "/icons/team-apple.png" },
  robots: { index: false },
};

// Weiß wie Grund und Kopf der Team-App, damit die Statusleiste nahtlos anschließt
export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" };

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const b = await benutzerMitRecht("werkstatt");
  // Fällige Erinnerungen nachholen, falls die Zeitsteuerung nicht anruft (nach der Antwort, bremst nichts)
  after(() => weich(erinnerungenNachholen(), undefined, "Erinnerungen nachholen"));
  const { module } = await einstellungen();
  const zeiten = module.zeiterfassung && b.zeiterfassung;
  // Eigenes Postfach, mir Zugewiesenes und (wenn in den Einstellungen freigegeben) das Firmenpostfach
  const post = await weich(zugang(b).then(ungelesen), { eigene: 0, firma: 0, zugewiesen: 0, gesamt: 0 }, "Zähler Mail (Team)");
  return (
    <div className="handy-app grund-weiss min-h-dvh bg-grund pb-[calc(4.5rem+env(safe-area-inset-bottom))]" data-leiste="hell">
      <div className="mx-auto max-w-xl">{children}</div>
      <Auffrischen />
      <NachTastatur />
      <PushAbgleich />
      <TabLeiste
        tabs={[
          { href: "/team", text: "Heute", icon: <Liste /> },
          { href: "/team/woche", text: "Woche", icon: <Kalender /> },
          { href: "/team/abwesenheit", text: "Urlaub", icon: <Person /> },
          ...(zeiten ? [{ href: "/team/zeiten", text: "Zeiten", icon: <Uhr /> }] : []),
          { href: "/team/mail", text: "Mail", icon: <Brief />, anzahl: post.gesamt },
          // Schulung und Erinnerungen öffnet man aus „Mehr“, dort bleibt der Tab markiert
          { href: "/team/mehr", text: "Mehr", icon: <Mehr />, auch: ["/team/schulung", "/team/notizen"] },
        ]}
      />
    </div>
  );
}
