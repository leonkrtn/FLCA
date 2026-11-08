import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import halle from "@/assets/halle-lancia.jpg";
import handschuhe from "@/assets/handschuhe.jpg";
import lanciaHeck from "@/assets/lancia-heck.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import standbild from "@/assets/start-standbild.jpg";
import { Nachricht, Pfeil, Route, Telefon } from "@/components/icons";
import { Fragen } from "@/components/site/fragen";
import { Leistungsbereiche } from "@/components/site/leistungsbereiche";
import { NaechsterTermin } from "@/components/site/naechster-termin";
import { Oeffnungszeiten } from "@/components/site/oeffnungszeiten";
import { einstellungen } from "@/lib/einstellungen";
import { absaetze, mapsHref, preis, telHref, whatsappHref } from "@/lib/format";
import { bewertungen, oeffentlicheLeistungen, stellen } from "@/lib/inhalte";
import { websiteDatei } from "@/lib/supabase/admin";

export const revalidate = 300;

export default async function Startseite() {
  const [e, leistungen, stimmen, offeneStellen] = await Promise.all([einstellungen(), oeffentlicheLeistungen(), bewertungen(), stellen()]);
  const f = e.firma;
  const schnellwahl = leistungen.filter((l) => l.online_anfragbar && l.preis_cent !== null).slice(0, 5);
  // Eigenes Video aus der Verwaltung hat Vorrang, sonst das mitgelieferte.
  const eigenesVideo = websiteDatei(e.medien.heroVideo);
  const eigenesBild = websiteDatei(e.medien.heroBild);

  return (
    <>
      {/* Start: dunkles Video aus der Werkstatt, darauf, was der Betrieb macht und wie man einen Termin bekommt */}
      <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-[#0b0b0b] text-weiss md:min-h-[min(88vh,860px)]">
        {/* Standbild immer darunter: Es steht da, bis das Video läuft, und bleibt bei „Bewegung reduzieren“ allein stehen. */}
        <Image src={eigenesBild ?? standbild} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
        {eigenesVideo || !eigenesBild ? (
          <video
            className="absolute inset-0 -z-10 size-full object-cover motion-reduce:hidden"
            poster={eigenesBild ?? standbild.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          >
            {eigenesVideo ? <source src={eigenesVideo} /> : null}
            {!eigenesVideo ? <source src="/medien/start.webm" type="video/webm" /> : null}
            {!eigenesVideo ? <source src="/medien/start.mp4" type="video/mp4" /> : null}
          </video>
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-black/10 md:bg-gradient-to-r md:from-black/75 md:via-black/35 md:to-transparent" />

        <div className="rand w-full pb-10 pt-24 md:pb-20">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-white/70">
            Kfz-Meisterbetrieb · {f.ort}
          </p>
          <h1 className="schmal max-w-3xl text-5xl leading-[0.95] sm:text-6xl md:text-7xl">Reifen, Service und Aufbereitung</h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">{e.texte.heroUnterzeile}</p>
          {/* Auf dem Telefon übernimmt die feste Leiste unten Termin und Anruf. */}
          <div className="mt-8 hidden flex-wrap items-center gap-3 md:flex">
            <Link href="/termin" className="knopf knopf-rot">
              Termin anfragen
            </Link>
            <a href={telHref(f.telefon)} className="knopf knopf-rahmen border-white/50 hover:bg-white/10">
              <Telefon /> {f.telefon}
            </a>
          </div>
          <a href={f.googleBewertungLink} rel="noopener noreferrer" className="mt-6 inline-flex items-baseline gap-2 text-sm text-white/80 hover:text-weiss md:mt-8">
            <span className="zahlen text-lg font-semibold text-weiss">{f.googleNote}</span> von 5 bei {f.googleAnzahl} Google-Bewertungen
          </a>
        </div>
      </section>

      {/* Schnellwahl: die häufigsten Leistungen direkt in die Terminanfrage */}
      <section className="rand bg-papier py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-12 md:items-start">
          <div className="md:col-span-4">
            <h2 className="schmal text-2xl">Wofür brauchen Sie einen Termin?</h2>
            <div className="mt-2 min-h-5">
              <Suspense fallback={null}>
                <NaechsterTermin leistung={leistungen.find((l) => l.slug === "radwechsel") ?? schnellwahl[0]} />
              </Suspense>
            </div>
          </div>
          <ul className="border-t border-tinte md:col-span-8 md:grid md:grid-cols-2 md:gap-x-10">
            {schnellwahl.map((l) => (
              <li key={l.id} className="border-b border-linie">
                <Link href={`/termin?leistung=${l.slug}`} className="group flex min-h-14 items-center justify-between gap-4 py-2">
                  <span className="font-semibold">{l.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="zahlen">{preis(l.preis_cent, l.preis_ab)}</span>
                    <Pfeil className="size-5 text-grau transition-transform group-hover:translate-x-0.5 group-hover:text-tinte" />
                  </span>
                </Link>
              </li>
            ))}
            <li className="border-b border-linie">
              <Link href="/termin" className="flex min-h-14 items-center justify-between py-2 text-grau hover:text-tinte">
                <span>Andere Leistung oder Reparatur</span>
                <Pfeil className="size-5" />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Leistungen nach Bereich, mit Bild und Preisen */}
      <section id="preise" className="rand scroll-mt-20 py-16 md:py-24">
        <div className="mb-12 max-w-2xl">
          <h2 className="schmal text-4xl md:text-5xl">Leistungen und Preise</h2>
          <p className="mt-3 text-grau">Alle Preise sind Endpreise inklusive 19 % Mehrwertsteuer. Bezahlen können Sie bar oder per Überweisung.</p>
        </div>
        <Leistungsbereiche leistungen={leistungen} />
      </section>

      {/* Ablauf: drei Schritte, so wie es tatsächlich passiert */}
      <section className="rand border-y border-linie bg-papier py-14 md:py-20">
        <h2 className="schmal mb-10 text-3xl md:text-4xl">So läuft ein Termin ab</h2>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-12">
          {[
            ["Termin wählen", "Online sehen Sie nur Zeiten, die wirklich frei sind. Lieber telefonisch? Auch gut."],
            ["Bestätigung bekommen", `Wir bestätigen per E-Mail, meist am selben Tag. Bis dahin halten wir den Termin ${e.buchung.haltenStd} Stunden für Sie fest.`],
            ["Auto bringen", `${f.hinweisAnfahrt} Bezahlt wird nach der Arbeit, bar oder per Überweisung.`],
          ].map(([titel, text], i) => (
            <li key={titel} className="border-t-2 border-tinte pt-4">
              <p className="zahlen mb-2 text-sm text-grau">Schritt {i + 1}</p>
              <h3 className="mb-2 text-lg font-semibold">{titel}</h3>
              <p className="text-grau">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Inhaber und Werkstatt */}
      <section className="rand grid gap-10 py-16 md:grid-cols-12 md:py-24">
        <div className="relative aspect-[4/3] overflow-hidden bg-graphit md:col-span-6 md:aspect-auto md:min-h-[480px]">
          <Image
            src={websiteDatei(e.medien.ueberBild) ?? handschuhe}
            alt="Arbeitshandschuhe und Schraubendreher auf dem Motor eines Autos"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="md:col-span-5 md:col-start-8 md:self-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.14em] text-grau">
            {f.inhaber}, {f.titel}
          </p>
          <h2 className="schmal mb-6 text-4xl md:text-5xl">{e.texte.ueberTitel}</h2>
          <div className="fliesstext max-w-prose">
            {absaetze(e.texte.ueberText).map((a) => (
              <p key={a.slice(0, 30)}>{a}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Echte Fotos aus der Halle, auf dem Telefon seitlich wischbar */}
      <section aria-labelledby="halle-titel" className="pb-16 md:pb-24">
        <div className="rand mb-5 flex items-baseline justify-between gap-4">
          <h2 id="halle-titel" className="schmal text-2xl">Aus unserer Halle</h2>
          {e.module.galerie ? (
            <Link href="/galerie" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline">
              Vorher und nachher <Pfeil className="size-4" />
            </Link>
          ) : null}
        </div>
        <div className="rand flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
          {[
            { src: porsche, alt: "Porsche 911 mit schwarzen Felgen und gelben Bremssätteln in der Halle" },
            { src: lanciaHeck, alt: "Roter Lancia Delta von hinten, daneben ein schwarzer BMW" },
            { src: halle, alt: "Werkstatthalle mit geöffneter Motorhaube" },
          ].map((b) => (
            <div key={b.alt} className="relative aspect-[3/4] w-[78vw] shrink-0 snap-start overflow-hidden sm:w-[45vw] md:w-auto">
              <Image src={b.src} alt={b.alt} fill sizes="(min-width: 768px) 30vw, 78vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* Bewertungen: echte Zitate mit Namen, kein Karussell */}
      {e.module.bewertungen && stimmen.length ? (
        <section className="rand bg-graphit py-16 text-boden md:py-24">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="schmal text-6xl text-weiss md:text-[7rem] md:leading-none">{f.googleNote}</p>
              <p className="mt-2 text-grau-hell">von 5 bei {f.googleAnzahl} Google-Bewertungen</p>
              <a href={f.googleBewertungLink} className="mt-6 inline-flex items-center gap-2 font-semibold text-weiss hover:underline" rel="noopener noreferrer">
                Alle Bewertungen bei Google <Pfeil className="size-4" />
              </a>
            </div>
            <ul className="grid gap-10 md:col-span-8">
              {stimmen.slice(0, 3).map((b) => (
                <li key={b.id} className="border-l-2 border-white/20 pl-5">
                  <blockquote className="text-lg leading-relaxed text-weiss">„{b.text}“</blockquote>
                  <p className="mt-3 text-sm text-grau-hell">
                    {b.name}, {b.quelle}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Fragen */}
      <section className="rand grid gap-8 py-16 md:grid-cols-12 md:py-24">
        <h2 className="schmal text-3xl md:col-span-4 md:text-4xl">Häufige Fragen</h2>
        <div className="md:col-span-8">
          <Fragen e={e} />
        </div>
      </section>

      {/* Anfahrt */}
      <section id="anfahrt" className="rand grid scroll-mt-20 gap-12 border-t border-linie py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-5">
          <h2 className="schmal mb-6 text-4xl md:text-5xl">So finden Sie uns</h2>
          <address className="text-lg not-italic">
            {f.name}
            <br />
            {f.strasse}
            <br />
            {f.plz} {f.ort}
          </address>
          <p className="mt-4 border-l-2 border-kreide bg-papier px-4 py-3">{f.hinweisAnfahrt}</p>
          <div className="mt-8 flex flex-wrap gap-2">
            <a href={mapsHref(f.strasse, f.plz, f.ort)} className="knopf knopf-dunkel" rel="noopener noreferrer">
              <Route /> Route planen
            </a>
            <a href={telHref(f.telefon)} className="knopf knopf-rahmen">
              <Telefon /> Anrufen
            </a>
            <a href={whatsappHref(f.whatsapp)} className="knopf knopf-rahmen" rel="noopener noreferrer">
              <Nachricht /> WhatsApp
            </a>
          </div>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <h3 className="schmal mb-3 text-lg tracking-wide text-grau">Öffnungszeiten</h3>
          <Oeffnungszeiten zeiten={e.oeffnungszeiten} />
        </div>
      </section>

      {e.module.karriere && offeneStellen.length ? (
        <section className="rand border-t border-linie py-12">
          <Link href="/karriere" className="group grid gap-2 md:grid-cols-12 md:items-baseline">
            <span className="text-sm font-medium uppercase tracking-[0.14em] text-grau md:col-span-3">Wir stellen ein</span>
            <span className="schmal text-2xl group-hover:underline md:col-span-7 md:text-3xl">{offeneStellen.map((s) => s.titel).join(" · ")}</span>
            <span className="inline-flex items-center gap-2 font-semibold md:col-span-2 md:justify-self-end">
              Bewerben <Pfeil className="size-4" />
            </span>
          </Link>
        </section>
      ) : null}
    </>
  );
}
