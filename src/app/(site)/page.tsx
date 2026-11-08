import Image from "next/image";
import Link from "next/link";
import halle from "@/assets/halle-lancia.jpg";
import handschuhe from "@/assets/handschuhe.jpg";
import lanciaHeck from "@/assets/lancia-heck.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import standbild from "@/assets/start-standbild.jpg";
import { Nachricht, Pfeil, Route, Telefon } from "@/components/icons";
import { Sterne } from "@/components/icons-stern";
import { Fragen } from "@/components/site/fragen";
import { Leistungsbereiche } from "@/components/site/leistungsbereiche";
import { Oeffnungszeiten } from "@/components/site/oeffnungszeiten";
import { einstellungen } from "@/lib/einstellungen";
import { absaetze, mapsHref, preis, telHref, whatsappHref } from "@/lib/format";
import { bewertungen, oeffentlicheLeistungen, stellen } from "@/lib/inhalte";
import { websiteDatei } from "@/lib/supabase/admin";

export const revalidate = 300;

export default async function Startseite() {
  const [e, leistungen, stimmen, offeneStellen] = await Promise.all([einstellungen(), oeffentlicheLeistungen(), bewertungen(), stellen()]);
  const f = e.firma;
  // Eigenes Video aus der Verwaltung hat Vorrang, sonst das mitgelieferte.
  const eigenesVideo = websiteDatei(e.medien.heroVideo);
  const eigenesBild = websiteDatei(e.medien.heroBild);

  return (
    <>
      {/* Start: Video in voller Höhe, darauf, was der Betrieb macht und wie man einen Termin bekommt */}
      <section className="relative isolate -mt-16 flex min-h-[100svh] items-end overflow-hidden bg-black text-hell">
        {/* Standbild immer darunter: Es steht da, bis das Video läuft, und bleibt bei „Bewegung reduzieren“ allein stehen. */}
        <Image src={eigenesBild ?? standbild} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[65%_50%] md:object-center" />
        {eigenesVideo || !eigenesBild ? (
          <video
            className="absolute inset-0 -z-10 size-full object-cover object-[65%_50%] motion-reduce:hidden md:object-center"
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/30 md:bg-gradient-to-r md:from-black/85 md:via-black/30 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-boden to-transparent" />

        <div className="rand w-full pb-14 pt-32 md:pb-24">
          <h1 className="schmal max-w-4xl text-[3.4rem] leading-[0.9] sm:text-7xl md:text-8xl">
            Reifen, Service
            <br />
            und Aufbereitung
          </h1>
          <p className="mt-6 max-w-xl text-lg text-hell/80">{e.texte.heroUnterzeile}</p>
          {/* Auf dem Telefon übernimmt die feste Leiste unten Termin und Anruf. */}
          <div className="mt-9 hidden flex-wrap items-center gap-3 md:flex">
            <Link href="/termin" className="knopf knopf-rot min-h-14 px-8 text-lg ">
              Termin anfragen
            </Link>
            <a href={telHref(f.telefon)} className="knopf min-h-14 bg-white/10 px-7 text-hell ring-1 ring-white/20 backdrop-blur-md hover:bg-white/20">
              <Telefon /> {f.telefon}
            </a>
          </div>
          <a href={f.googleBewertungLink} rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-3 text-sm text-hell/80 hover:text-hell">
            <Sterne />
            <span>
              <span className="zahlen font-semibold text-hell">{f.googleNote}</span> bei {f.googleAnzahl} Google-Bewertungen
            </span>
          </a>
        </div>
      </section>

      {/* Leistungen als Bildkacheln */}
      <section id="preise" className="rand scroll-mt-20 pb-16 pt-16 md:pb-20 md:pt-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="schmal text-5xl md:text-7xl">Leistungen</h2>
          <p className="max-w-sm text-grau">Endpreise inklusive 19 % Mehrwertsteuer. Bezahlen bar oder per Überweisung.</p>
        </div>
        <Leistungsbereiche leistungen={leistungen} />
      </section>

      {/* Ablauf mit großen Schrittnummern */}
      <section className="rand pb-20 md:pb-28">
        <h2 className="schmal mb-8 text-5xl md:text-7xl">So läuft&apos;s</h2>
        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          {[
            ["Termin wählen", "Online sehen Sie nur Zeiten, die wirklich frei sind. Lieber telefonisch? Auch gut."],
            ["Bestätigung bekommen", `Per E-Mail, meist am selben Tag. Bis dahin halten wir den Termin ${e.buchung.haltenStd} Stunden für Sie fest.`],
            ["Auto bringen", `${f.hinweisAnfahrt} Bezahlt wird nach der Arbeit.`],
          ].map(([titel, text], i) => (
            <li key={titel} className="relative">
              <span className="schmal block text-[5rem] leading-none text-transparent [-webkit-text-stroke:1.5px_var(--color-grau-hell)] md:text-[6.5rem]" aria-hidden>
                0{i + 1}
              </span>
              <h3 className="mb-2 mt-2 text-xl font-semibold">{titel}</h3>
              <p className="max-w-sm text-grau">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Inhaber: Bild mit Text darüber */}
      <section className="rand pb-20 md:pb-28">
        <div className="relative isolate overflow-hidden rounded-lg">
          <div className="relative aspect-[4/5] md:aspect-[21/9]">
            <Image src={websiteDatei(e.medien.ueberBild) ?? handschuhe} alt="Arbeitshandschuhe und Schraubendreher auf dem Motor eines Autos" fill sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/50 to-transparent md:bg-gradient-to-r md:from-black/90 md:via-black/60 md:to-transparent" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-end p-6 text-hell md:w-1/2 md:justify-center md:p-14">
            <p className="mb-3 text-sm uppercase tracking-[0.16em] text-hell/60">
              {f.inhaber}, {f.titel}
            </p>
            <h2 className="schmal mb-5 text-4xl md:text-6xl">{e.texte.ueberTitel}</h2>
            <div className="fliesstext max-w-prose text-hell/80">
              {absaetze(e.texte.ueberText).map((a) => (
                <p key={a.slice(0, 30)}>{a}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Echte Fotos aus der Halle */}
      <section aria-labelledby="halle-titel" className="pb-20 md:pb-28">
        <div className="rand mb-8 flex items-end justify-between gap-4">
          <h2 id="halle-titel" className="schmal text-4xl sm:text-5xl md:text-7xl">Aus der Halle</h2>
          {e.module.galerie ? (
            <Link href="/galerie" className="inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-linie hover:bg-flaeche">
              Vorher / nachher <Pfeil className="size-4" />
            </Link>
          ) : null}
        </div>
        <div className="rand flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
          {[
            { src: porsche, alt: "Porsche 911 mit schwarzen Felgen und gelben Bremssätteln in der Halle" },
            { src: lanciaHeck, alt: "Roter Lancia Delta von hinten, daneben ein schwarzer BMW" },
            { src: halle, alt: "Werkstatthalle mit geöffneter Motorhaube" },
          ].map((b, i) => (
            <div key={b.alt} className={`group relative aspect-[3/4] w-[78vw] shrink-0 snap-start overflow-hidden rounded-lg sm:w-[45vw] md:w-auto ${i === 1 ? "md:mt-12" : ""}`}>
              <Image src={b.src} alt={b.alt} fill sizes="(min-width: 768px) 30vw, 78vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Bewertungen als Karten, auf dem Telefon seitlich wischbar */}
      {e.module.bewertungen && stimmen.length ? (
        <section className="pb-20 md:pb-28">
          <div className="rand mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="schmal text-7xl leading-none md:text-9xl">{f.googleNote}</p>
              <div className="mt-3 flex items-center gap-3 text-grau">
                <Sterne className="size-5" /> {f.googleAnzahl} Google-Bewertungen
              </div>
            </div>
            <a href={f.googleBewertungLink} className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-semibold ring-1 ring-linie hover:bg-flaeche" rel="noopener noreferrer">
              Alle bei Google lesen <Pfeil className="size-4" />
            </a>
          </div>
          <ul className="rand flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
            {stimmen.slice(0, 3).map((b) => (
              <li key={b.id} className="flex w-[82vw] shrink-0 snap-start flex-col justify-between rounded-lg bg-flaeche p-7 ring-1 ring-linie sm:w-[60vw] md:w-auto">
                <div>
                  <Sterne anzahl={b.sterne} />
                  <blockquote className="mt-5 text-lg leading-relaxed">„{b.text}“</blockquote>
                </div>
                <p className="mt-6 flex items-center gap-3 text-sm text-grau">
                  <span className="flex size-9 items-center justify-center rounded-full bg-white/10 font-semibold text-tinte">{b.name.slice(0, 1)}</span>
                  {b.name} · {b.quelle}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Fragen */}
      <section className="rand grid gap-10 pb-20 md:grid-cols-12 md:pb-28">
        <h2 className="schmal text-5xl md:col-span-4 md:text-6xl">Fragen</h2>
        <div className="md:col-span-8">
          <Fragen e={e} />
        </div>
      </section>

      {/* Anfahrt */}
      <section id="anfahrt" className="rand scroll-mt-20 pb-20 md:pb-28">
        <div className="grid gap-10 rounded-lg bg-papier p-6 ring-1 ring-linie md:grid-cols-12 md:p-12">
          <div className="md:col-span-5">
            <h2 className="schmal mb-6 text-5xl md:text-6xl">So finden Sie uns</h2>
            <address className="text-xl not-italic">
              {f.strasse}
              <br />
              {f.plz} {f.ort}
            </address>
            <p className="mt-5 rounded-md bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-linie">{f.hinweisAnfahrt}</p>
            <div className="mt-8 grid gap-2 lg:grid-cols-3">
              <a href={mapsHref(f.strasse, f.plz, f.ort)} className="w-full px-3 knopf knopf-dunkel" rel="noopener noreferrer">
                <Route /> Route planen
              </a>
              <a href={telHref(f.telefon)} className="w-full px-3 knopf knopf-rahmen">
                <Telefon /> Anrufen
              </a>
              <a href={whatsappHref(f.whatsapp)} className="w-full px-3 knopf knopf-rahmen" rel="noopener noreferrer">
                <Nachricht /> WhatsApp
              </a>
            </div>
          </div>
          <div className="md:col-span-7">
            <Oeffnungszeiten zeiten={e.oeffnungszeiten} />
          </div>
        </div>
      </section>

      {e.module.karriere && offeneStellen.length ? (
        <section className="rand pb-20">
          <Link href="/karriere" className="group flex flex-wrap items-center justify-between gap-6 rounded-lg bg-flaeche px-6 py-8 ring-1 ring-linie md:px-12 md:py-10">
            <span>
              <span className="block text-sm uppercase tracking-[0.16em] text-grau">Wir stellen ein</span>
              <span className="schmal mt-1 block text-3xl md:text-5xl">{offeneStellen.map((s) => s.titel).join(" · ")}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-6 py-3 font-semibold text-tinte ring-1 ring-white/15 transition-transform group-hover:translate-x-1">
              Bewerben <Pfeil className="size-4" />
            </span>
          </Link>
        </section>
      ) : null}
    </>
  );
}
