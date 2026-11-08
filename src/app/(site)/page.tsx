import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import halle from "@/assets/halle-lancia.jpg";
import lanciaHeck from "@/assets/lancia-heck.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import reifenmaschine from "@/assets/reifenmaschine.jpg";
import { Nachricht, Pfeil, Route, Telefon } from "@/components/icons";
import { NaechsterTermin } from "@/components/site/naechster-termin";
import { Oeffnungszeiten } from "@/components/site/oeffnungszeiten";
import { Preisliste } from "@/components/site/preisliste";
import { einstellungen } from "@/lib/einstellungen";
import { absaetze, mapsHref, preis, telHref, whatsappHref } from "@/lib/format";
import { bewertungen, oeffentlicheLeistungen, stellen } from "@/lib/inhalte";
import { websiteDatei } from "@/lib/supabase/admin";

export const revalidate = 300;

export default async function Startseite() {
  const [e, leistungen, stimmen, offeneStellen] = await Promise.all([einstellungen(), oeffentlicheLeistungen(), bewertungen(), stellen()]);
  const f = e.firma;
  const schnellwahl = leistungen.filter((l) => l.online_anfragbar && l.preis_cent !== null).slice(0, 5);
  const heroVideo = websiteDatei(e.medien.heroVideo);
  const heroBild = websiteDatei(e.medien.heroBild);

  return (
    <>
      {/* Start: Foto aus der eigenen Halle, darunter direkt die Leistungsauswahl */}
      <section className="lg:rand lg:grid lg:grid-cols-12 lg:gap-12 lg:pb-16 lg:pt-10">
        <div className="relative aspect-[4/5] max-h-[72svh] w-full overflow-hidden bg-graphit sm:aspect-[16/10] lg:order-2 lg:col-span-7 lg:aspect-auto lg:max-h-none lg:min-h-[640px]">
          {heroVideo ? (
            <video
              className="absolute inset-0 size-full object-cover"
              src={heroVideo}
              poster={heroBild ?? halle.src}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          ) : (
            <Image
              src={heroBild ?? halle}
              alt="Die Halle von FLC Automotive mit einem roten Lancia Delta auf dem Arbeitsplatz"
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent lg:hidden" />
          <div className="rand absolute inset-x-0 bottom-0 pb-10 text-weiss lg:hidden">
            <h1 className="schmal text-5xl sm:text-6xl">
              Starker Grip.
              <br />
              Starker Service.
            </h1>
          </div>
        </div>

        <div className="rand -mt-4 lg:order-1 lg:col-span-5 lg:mt-0 lg:flex lg:flex-col lg:justify-between lg:px-0">
          <div className="relative hidden lg:block">
            <p className="mb-6 text-sm font-medium uppercase tracking-[0.14em] text-grau">
              Kfz-Meisterbetrieb in {f.ort}
            </p>
            <h1 className="schmal text-6xl xl:text-[5.5rem] xl:leading-[0.9]">
              Starker Grip.
              <br />
              Starker Service.
            </h1>
          </div>
          <div className="relative bg-papier p-4 shadow-[0_1px_0_var(--color-linie)] sm:p-6 lg:mt-12 lg:bg-transparent lg:p-0 lg:shadow-none">
            <p className="mb-4 max-w-md text-lg lg:mb-8">{e.texte.heroUnterzeile}</p>
            <p className="label mb-2">Wofür brauchen Sie einen Termin?</p>
            <ul className="border-t border-tinte">
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
              <li>
                <Link href="/termin" className="flex min-h-14 items-center justify-between py-2 text-grau hover:text-tinte">
                  <span>Andere Leistung oder Reparatur</span>
                  <Pfeil className="size-5" />
                </Link>
              </li>
            </ul>
            <div className="mt-4 min-h-5">
              <Suspense fallback={null}>
                <NaechsterTermin leistung={leistungen.find((l) => l.slug === "radwechsel") ?? schnellwahl[0]} />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <div className="profil opacity-90" aria-hidden />

      {/* Preise */}
      <section id="preise" className="rand scroll-mt-20 bg-papier py-16 md:py-24">
        <div className="mb-10 grid gap-4 md:grid-cols-12">
          <h2 className="schmal text-4xl md:col-span-5 md:text-5xl">Festpreise. Vorher klar.</h2>
          <p className="max-w-xl text-grau md:col-span-6 md:col-start-7 md:self-end">
            Was hier steht, zahlen Sie. Bei Reparaturen und Inspektionen nennen wir Ihnen den Preis, bevor wir anfangen.
          </p>
        </div>
        <Preisliste leistungen={leistungen} />
      </section>

      {/* Werkstatt und Meister */}
      <section className="rand grid gap-10 py-16 md:grid-cols-12 md:py-24">
        <div className="relative aspect-[3/4] overflow-hidden md:col-span-5">
          <Image
            src={websiteDatei(e.medien.ueberBild) ?? reifenmaschine}
            alt="Reifenmontiermaschine und Auswuchtmaschine in der Werkstatt"
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="md:col-span-6 md:col-start-7 md:self-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-grau">
            {f.inhaber}, {f.titel}
          </p>
          <h2 className="schmal mb-6 text-4xl md:text-5xl">{e.texte.ueberTitel}</h2>
          <div className="fliesstext max-w-prose">
            {absaetze(e.texte.ueberText).map((a) => (
              <p key={a.slice(0, 30)}>{a}</p>
            ))}
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-tinte pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-grau">Radwechsel</dt>
              <dd className="zahlen text-2xl">~30 min</dd>
            </div>
            <div>
              <dt className="text-sm text-grau">Google</dt>
              <dd className="zahlen text-2xl">
                {f.googleNote} <span className="font-sans text-sm text-grau">/ {f.googleAnzahl} Bew.</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-grau">Bezahlen</dt>
              <dd className="text-lg font-semibold">bar oder Überweisung</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Aus der Halle: Bildstreifen, auf dem Telefon seitlich wischbar */}
      <section aria-label="Bilder aus der Werkstatt" className="pb-16 md:pb-24">
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
        {e.module.galerie ? (
          <div className="rand mt-6">
            <Link href="/galerie" className="inline-flex items-center gap-2 font-semibold hover:underline">
              Vorher und nachher: Aufbereitungen ansehen <Pfeil className="size-4" />
            </Link>
          </div>
        ) : null}
      </section>

      {/* Bewertungen: echte Zitate, kein Karussell */}
      {e.module.bewertungen && stimmen.length ? (
        <section className="rand bg-graphit py-16 text-boden md:py-24">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="schmal text-6xl text-weiss md:text-[7rem] md:leading-none">{f.googleNote}</p>
              <p className="mt-2 text-grau-hell">
                aus {f.googleAnzahl} Google-Bewertungen
              </p>
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

      {/* Anfahrt */}
      <section id="anfahrt" className="rand grid scroll-mt-20 gap-12 py-16 md:grid-cols-12 md:py-24">
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
