import type { Metadata, Viewport } from "next";
import { Kalender, Liste, Mehr, Plus, Dokument } from "@/components/icons";
import { TabLeiste } from "@/components/mobil/leiste";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { default: "Werkstatt", template: "%s · Werkstatt" },
  manifest: "/app/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Werkstatt", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/app-apple.png" },
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#1f1e1c", viewportFit: "cover" };

/**
 * Handy-App für Inhaber und Büro: nur das, was unterwegs zählt (heute, Anfragen, Termin eintragen,
 * Rechnung aus Termin). Alles andere steht im großen Admin am Rechner.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await benutzerMitRecht("termine");
  const { count } = await db().from("termine").select("id", { count: "exact", head: true }).eq("status", "angefragt");
  return (
    <div className="min-h-dvh bg-boden pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-xl">{children}</div>
      <TabLeiste
        dunkel
        tabs={[
          { href: "/app", text: "Heute", icon: <Kalender /> },
          { href: "/app/anfragen", text: "Anfragen", icon: <Liste />, anzahl: count ?? 0 },
          { href: "/app/neu", text: "Neu", icon: <Plus className="size-5" />, hervorgehoben: true },
          { href: "/app/rechnungen", text: "Rechnungen", icon: <Dokument /> },
          { href: "/app/mehr", text: "Mehr", icon: <Mehr /> },
        ]}
      />
    </div>
  );
}
