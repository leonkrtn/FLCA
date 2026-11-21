import { after } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { abmelden } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { AdminNav, type NavEintrag } from "@/components/admin/nav";
import { benutzerMitRecht } from "@/lib/auth";
import { erinnerungenNachholen } from "@/lib/automatik";
import { einstellungen } from "@/lib/einstellungen";
import { ohneMitarbeiterAnzahl } from "@/lib/mitarbeiter";
import { faelligeAnzahl } from "@/lib/notizen";
import { darf, rollenName } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: { default: "Verwaltung", template: "%s | Verwaltung FLC" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const b = await benutzerMitRecht();
  if (b.rolle === "mitarbeiter") redirect("/team");
  // Fällige Erinnerungen nachholen, falls die Zeitsteuerung nicht anruft (nach der Antwort, bremst nichts)
  after(() => erinnerungenNachholen().catch((e) => console.error("Erinnerungen nachholen fehlgeschlagen", e)));
  const e = await einstellungen();
  const zaehlen = (tabelle: string, spalte: string, wert: string) =>
    db().from(tabelle).select("id", { count: "exact", head: true }).eq(spalte, wert).then((r) => r.count ?? 0);
  const [anfragen, abwesenheiten, bewerbungen, erinnerungen, ohnePerson] = await Promise.all([
    zaehlen("termine", "status", "angefragt"),
    darf(b.rolle, "team") ? zaehlen("abwesenheiten", "status", "beantragt") : 0,
    darf(b.rolle, "karriere") ? zaehlen("bewerbungen", "status", "neu") : 0,
    darf(b.rolle, "notizen") ? faelligeAnzahl(b) : 0,
    ohneMitarbeiterAnzahl(),
  ]);

  const alle: (NavEintrag & { recht: Parameters<typeof darf>[1]; modul?: keyof typeof e.module })[] = [
    { href: "/admin", text: "Übersicht", recht: "termine" },
    { href: "/admin/kalender", text: "Kalender", recht: "termine", gruppe: "Werkstatt", anzahl: ohnePerson },
    { href: "/admin/termine", text: "Termine", recht: "termine", anzahl: anfragen },
    { href: "/admin/notizen", text: "Notizen", recht: "notizen", anzahl: erinnerungen },
    { href: "/admin/kunden", text: "Kunden", recht: "kunden" },
    { href: "/admin/einlagerung", text: "Einlagerung", recht: "einlagerung", modul: "einlagerung" },
    { href: "/admin/rechnungen", text: "Rechnungen", recht: "rechnungen", gruppe: "Geld" },
    { href: "/admin/kostenvoranschlaege", text: "Kostenvoranschläge", recht: "rechnungen" },
    { href: "/admin/preisliste", text: "Preisliste", recht: "rechnungen" },
    { href: "/admin/gemerkte-preise", text: "Gemerkte Preise", recht: "rechnungen" },
    { href: "/admin/mitarbeiter", text: "Mitarbeiter", recht: "team", anzahl: abwesenheiten, gruppe: "Betrieb" },
    { href: "/admin/karriere", text: "Karriere", recht: "karriere", anzahl: bewerbungen, modul: "karriere" },
    { href: "/admin/website", text: "Website", recht: "website" },
    { href: "/admin/einstellungen", text: "Einstellungen", recht: "einstellungen" },
  ];
  const eintraege = alle.filter((n) => darf(b.rolle, n.recht) && (!n.modul || e.module[n.modul]));

  return (
    <div className="min-h-dvh bg-boden lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Reicht die Seite einmal unter die Statusleiste (Web-App mit viewport-fit=cover), hält der Kopf so viel
          Abstand, wie die Statusleiste hoch ist; im Browser bleibt es beim normalen Abstand. */}
      <aside className="sticky top-0 z-30 flex flex-col gap-3 bg-graphit pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-boden lg:h-dvh lg:pb-5 lg:pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-6">
          <Link href="/admin" aria-label="Übersicht">
            <Logo className="h-10 w-auto lg:h-16" />
          </Link>
          <Link href="/app" className="text-xs text-grau-hell underline lg:hidden">
            Handy-Ansicht
          </Link>
        </div>
        <AdminNav eintraege={eintraege} />
        <div className="mx-3 mt-auto hidden border-t border-white/10 px-3 pt-4 text-sm lg:block">
          <p className="font-semibold text-weiss">{b.name || b.email}</p>
          <p className="text-grau-hell">{rollenName(b.rolle)}</p>
          <div className="mt-3 flex flex-col gap-1.5 text-boden/80">
            <Link href="/team" className="hover:text-weiss">Team-Ansicht</Link>
            <Link href="/" target="_blank" className="hover:text-weiss">Website ansehen</Link>
            <form action={abmelden}>
              <button type="submit" className="hover:text-weiss">Abmelden</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
