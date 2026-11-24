import { after } from "next/server";
import { Auffrischen } from "@/components/auffrischen";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { abmelden } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { AdminNav, EinstellungenSymbol, KontoMenue, type NavEintrag } from "@/components/admin/nav";
import { benutzerMitRecht } from "@/lib/auth";
import { erinnerungenNachholen } from "@/lib/automatik";
import { einstellungen } from "@/lib/einstellungen";
import { ohneMitarbeiterAnzahl } from "@/lib/mitarbeiter";
import { faelligeAnzahl } from "@/lib/notizen";
import { darf, rollenName } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { weich } from "@/lib/fehler";
import { offeneFehlerAnzahl } from "@/lib/fehlerprotokoll";

export const metadata: Metadata = { title: { default: "Verwaltung", template: "%s | Verwaltung FLC" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const b = await benutzerMitRecht();
  if (b.rolle === "mitarbeiter") redirect("/team");
  // Fällige Erinnerungen nachholen, falls die Zeitsteuerung nicht anruft (nach der Antwort, bremst nichts)
  after(() => weich(erinnerungenNachholen(), undefined, "Erinnerungen nachholen"));
  const e = await einstellungen();
  // Ein kaputter Zähler darf nicht jede Seite der Verwaltung umwerfen: dann 0, aber im Fehlerprotokoll.
  const zaehlen = (tabelle: string, spalte: string, wert: string) =>
    weich(db().from(tabelle).select("id", { count: "exact", head: true }).eq(spalte, wert).then((r) => r.count ?? 0), 0, `Menü-Zähler ${tabelle}`);
  const [anfragen, abwesenheiten, bewerbungen, erinnerungen, ohnePerson, fehler, meldungen] = await Promise.all([
    zaehlen("termine", "status", "angefragt"),
    darf(b.rolle, "team") ? zaehlen("abwesenheiten", "status", "beantragt") : 0,
    darf(b.rolle, "karriere") ? zaehlen("bewerbungen", "status", "neu") : 0,
    darf(b.rolle, "notizen") ? weich(faelligeAnzahl(b), 0, "Menü-Zähler Erinnerungen") : 0,
    ohneMitarbeiterAnzahl(),
    darf(b.rolle, "einstellungen") ? offeneFehlerAnzahl() : 0,
    // Befunde und angeforderte Teile aus der Team-App
    darf(b.rolle, "termine") ? zaehlen("auftrag_meldungen", "status", "offen") : 0,
  ]);

  const alle: (NavEintrag & { recht: Parameters<typeof darf>[1]; modul?: keyof typeof e.module })[] = [
    { href: "/admin", text: "Übersicht", recht: "termine" },
    { href: "/admin/kalender", text: "Kalender", recht: "termine", gruppe: "Werkstatt", anzahl: ohnePerson },
    { href: "/admin/termine", text: "Termine", recht: "termine", anzahl: anfragen },
    { href: "/admin/auftraege", text: "Werkstattaufträge", recht: "termine", anzahl: meldungen },
    { href: "/admin/notizen", text: "Notizen", recht: "notizen", anzahl: erinnerungen },
    { href: "/admin/kunden", text: "Kunden", recht: "kunden" },
    { href: "/admin/einlagerung", text: "Einlagerung", recht: "einlagerung", modul: "einlagerung" },
    { href: "/admin/rechnungen", text: "Rechnungen", recht: "rechnungen", gruppe: "Geld" },
    { href: "/admin/kostenvoranschlaege", text: "Kostenvoranschläge", recht: "rechnungen" },
    { href: "/admin/preisliste", text: "Preisliste", recht: "rechnungen" },
    { href: "/admin/angebote", text: "Angebote", recht: "angebote" },
    { href: "/admin/mitarbeiter", text: "Mitarbeiter", recht: "team", anzahl: abwesenheiten, gruppe: "Betrieb" },
    { href: "/admin/schulung", text: "Schulung", recht: "schulung" },
    { href: "/admin/karriere", text: "Karriere", recht: "karriere", anzahl: bewerbungen, modul: "karriere" },
    { href: "/admin/website", text: "Website", recht: "website" },
    // Das Büro sieht dort nur den Reiter „Gemerkte Preise“ (Recht „rechnungen“). Am großen Bildschirm steht
    // Einstellungen als Zahnrad im Benutzerblock unten, in der waagerechten Leiste am Handy weiter als Text.
    { href: "/admin/einstellungen", text: "Einstellungen", recht: darf(b.rolle, "einstellungen") ? "einstellungen" : "rechnungen", anzahl: fehler, nurMobil: true },
  ];
  const eintraege = alle.filter((n) => darf(b.rolle, n.recht) && (!n.modul || e.module[n.modul]));
  const einstellungenEintrag = eintraege.find((n) => n.href === "/admin/einstellungen");

  return (
    <div className="min-h-dvh bg-boden lg:pl-60">
      {/* Reicht die Seite einmal unter die Statusleiste (Web-App mit viewport-fit=cover), hält der Kopf so viel
          Abstand, wie die Statusleiste hoch ist; im Browser bleibt es beim normalen Abstand.
          Am großen Bildschirm ist die Leiste fest (fixed, oben bis unten) statt sticky mit h-dvh: Sticky federte beim
          Überscrollen mit und änderte mit der ein- und ausfahrenden Adressleiste (dvh) seine Höhe, dann stand der
          dunkle Balken versetzt. Passt das Menü nicht in die Höhe, scrollt es in sich. */}
      <aside className="sticky top-0 z-30 flex flex-col gap-3 bg-graphit pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-boden lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:overflow-y-auto lg:overscroll-contain lg:pb-5 lg:pt-[max(1.25rem,env(safe-area-inset-top))]">
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
          <div className="flex items-start justify-between gap-2">
            <KontoMenue name={b.name || b.email} rolle={rollenName(b.rolle)} abmelden={abmelden} />
            {einstellungenEintrag ? <EinstellungenSymbol href={einstellungenEintrag.href} anzahl={einstellungenEintrag.anzahl} /> : null}
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
        <Auffrischen />
      </main>
    </div>
  );
}
