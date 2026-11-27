import Image from "next/image";
import Link from "next/link";
import amgBuehne from "@/assets/amg-buehne.jpg";
import amgMotor from "@/assets/amg-motor.jpg";
import m3Heck from "@/assets/bmw-m3-heck.jpg";
import m4Buehne from "@/assets/bmw-m4-buehne.jpg";
import halle from "@/assets/halle-lancia.jpg";
import handschuhe from "@/assets/handschuhe.jpg";
import jaguar from "@/assets/jaguar-motor.jpg";
import lanciaHeck from "@/assets/lancia-heck.jpg";
import panamera from "@/assets/panamera-reifen.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import { Nachricht, Pfeil, Route, Telefon } from "@/components/icons";
import { Sterne } from "@/components/icons-stern";
import { AngebotsHinweise } from "@/components/site/angebot";
import { Fragen } from "@/components/site/fragen";
import { Leistungsbereiche } from "@/components/site/leistungsbereiche";
import { jetztStatus, Oeffnungszeiten } from "@/components/site/oeffnungszeiten";
import { laufendeAngebote } from "@/lib/angebote/daten";
import { einstellungen } from "@/lib/einstellungen";
import { absaetze, mapsHref, telHref, whatsappHref } from "@/lib/format";
import { bewertungen, oeffentlicheLeistungen, stellen } from "@/lib/inhalte";
import { websiteDatei } from "@/lib/supabase/admin";
import { berlinDatum, wochentag } from "@/lib/zeit";

export const revalidate = 300;

export default async function Startseite() {
  const [e, leistungen, stimmen, offeneStellen, angebote] = await Promise.all([einstellungen(), oeffentlicheLeistungen(), bewertungen(), stellen(), laufendeAngebote()]);
  const f = e.firma;
  // Eigenes Video aus der Verwaltung hat Vorrang, sonst das mitgelieferte.
  const eigenesVideo = websiteDatei(e.medien.heroVideo);
  const eigenesBild = websiteDatei(e.medien.heroBild);
  const heute = e.oeffnungszeiten[String(wochentag(berlinDatum())) as keyof typeof e.oeffnungszeiten];
  const status = jetztStatus(e.oeffnungszeiten);

  return (
    <>
      {/*
        Start wie ein Ladenschild: echtes Foto aus der Halle, wer und wo, darunter eine Leiste mit dem, was man
        für den Besuch braucht. Bewusst ohne Werbe-Unterzeile und Sterne: konkrete Angaben wirken echt, Floskeln nicht.
        Auf dem Telefon um die feste Leiste unten kürzer, sonst verschwindet die Leiste mit der Adresse dahinter.
      */}
      <section className="relative isolate -mt-16 flex min-h-[calc(100svh-4.75rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-graphit text-hell md:min-h-[100svh]">
        <Image src={eigenesBild ?? halle} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[center_62%]" />
        {eigenesVideo ? (
          <video
            className="absolute inset-0 -z-10 size-full object-cover motion-reduce:hidden"
            poster={eigenesBild ?? halle.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          >
            <source src={eigenesVideo} />
          </video>
        ) : null}
        {/* Gleichmäßig abgedunkelt statt Verlauf, damit das Foto als Foto stehen bleibt */}
        <div className="absolute inset-0 -z-10 bg-black/55" />

        <div className="rand einblenden flex w-full flex-1 flex-col justify-center pb-12 pt-28 md:pb-16">
          <p className="text-lg font-medium text-hell/80">
            {f.inhaber}, {f.titel}
          </p>
          <h1 className="schmal mt-4 max-w-3xl text-[3.4rem] leading-[0.92] sm:text-7xl md:text-8xl">Kfz-Werkstatt in {f.ort}</h1>
        </div>

        {/*
          Schmale Leiste im Stil der Kopfzeile, das Foto scheint durch. Nur Adresse und ob gerade offen ist: Telefon,
          heutige Zeiten und „Termin anfragen“ stehen schon im Kopf bzw. auf dem Telefon in der festen Leiste unten.
        */}
        <div className="border-t border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="rand flex min-h-14 flex-wrap items-center gap-x-8 gap-y-1 py-3 text-sm text-hell/85 md:text-base">
            <a href={mapsHref(f.strasse, f.plz, f.ort)} rel="noopener noreferrer" className="hover:text-hell">
              {/* Auf dem Telefon nur die Straße, damit alles in eine Zeile passt; der Ort steht groß darüber */}
              {f.strasse}
              <span className="hidden sm:inline">
                , {f.plz} {f.ort}
              </span>
            </a>
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${status.offen ? "bg-hell" : "bg-hell/40"}`} aria-hidden />
              {heute.length ? status.text : "Heute geschlossen"}
            </span>
          </div>
        </div>
      </section>

      {/* Laufende Angebote direkt unter dem Start, damit sie niemand übersieht */}
      <AngebotsHinweise angebote={angebote} leistungen={leistungen} heute={berlinDatum()} />

      {/* Leistungen als Bildkacheln */}
      <section id="preise" className="rand scroll-mt-20 pb-16 pt-16 md:pb-20 md:pt-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="schmal text-3xl sm:text-4xl md:text-7xl">Leistungen</h2>
          <p className="max-w-sm text-grau">Endpreise inklusive 19 % Mehrwertsteuer. Bezahlen bar oder per Überweisung.</p>
        </div>
        <Leistungsbereiche leistungen={leistungen} />
      </section>

      {/* Ablauf mit großen Schrittnummern */}
      <section className="rand pb-20 md:pb-28">
        <h2 className="schmal mb-8 text-3xl sm:text-4xl md:text-7xl">So läuft&apos;s</h2>
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
            <h2 className="schmal mb-5 text-3xl sm:text-4xl md:text-6xl">{e.texte.ueberTitel}</h2>
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
        <div className="rand mb-8">
          <h2 id="halle-titel" className="schmal text-3xl sm:text-4xl md:text-7xl">Aus der Halle</h2>
        </div>
        {/*
          Jedes Foto nur einmal auf der Website: das Hallenfoto vom Start und die Bilder der Leistungskacheln stehen hier
          nicht noch einmal. Bis zum Desktop seitlich wischbar, bei acht Bildern wäre ein Zweierraster sehr lang.
        */}
        <div className="rand flex snap-x snap-mandatory gap-4 quer-scrollen pb-2 [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible">
          {[
            { src: porsche, alt: "Porsche 911 mit schwarzen Felgen und gelben Bremssätteln in der Halle" },
            { src: m4Buehne, alt: "BMW M4 von hinten auf der Hebebühne, Blick auf Auspuffanlage und Unterboden" },
            { src: panamera, alt: "Weißer Porsche Panamera auf der Hebebühne, davor ein Stapel Reifen und die Reifenmontiermaschine" },
            { src: amgBuehne, alt: "Mercedes-AMG GLC auf der Hebebühne, davor ein Opel mit offener Motorhaube" },
            { src: lanciaHeck, alt: "Roter Lancia Delta von hinten, daneben ein schwarzer BMW" },
            { src: jaguar, alt: "Jaguar XF mit offener Motorhaube und Arbeitslampe" },
            { src: m3Heck, alt: "Schwarzes BMW M3 Cabrio von hinten in der Halle" },
            { src: amgMotor, alt: "V8-Motor eines Mercedes-AMG unter der geöffneten Motorhaube" },
          ].map((b, i) => (
            // Jedes zweite Bild versetzt, damit die Reihen nicht wie ein Raster wirken (nur im Viererraster, beim Wischen nicht)
            <div key={b.alt} className={`group relative aspect-[3/4] w-[78vw] shrink-0 snap-start overflow-hidden rounded-lg sm:w-[45vw] lg:w-auto ${i % 2 === 1 ? "lg:mt-12" : ""}`}>
              <Image src={b.src} alt={b.alt} fill sizes="(min-width: 1024px) 23vw, (min-width: 768px) 45vw, 78vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            </div>
          ))}
        </div>
      </section>

      {/* Bewertungen als Karten, auf dem Telefon seitlich wischbar */}
      {e.module.bewertungen && stimmen.length ? (
        <section className="pb-20 md:pb-28">
          <div className="rand mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="schmal text-6xl leading-none md:text-9xl">{f.googleNote}</p>
              <div className="mt-3 flex items-center gap-3 text-grau">
                <Sterne className="size-5" /> {f.googleAnzahl} Google-Bewertungen
              </div>
            </div>
            <a href={f.googleBewertungLink} className="inline-flex items-center gap-2 rounded-md px-5 py-3 font-semibold ring-1 ring-linie hover:bg-flaeche" rel="noopener noreferrer">
              Alle bei Google lesen <Pfeil className="size-4" />
            </a>
          </div>
          <ul className="rand flex snap-x snap-mandatory gap-4 quer-scrollen pb-2 [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible">
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
        <h2 className="schmal text-3xl sm:text-4xl md:col-span-4 md:text-6xl">Fragen</h2>
        <div className="md:col-span-8">
          <Fragen e={e} />
        </div>
      </section>

      {/* Anfahrt */}
      <section id="anfahrt" className="rand scroll-mt-20 pb-20 md:pb-28">
        <div className="grid gap-10 rounded-lg bg-papier p-6 ring-1 ring-linie md:grid-cols-12 md:p-12">
          <div className="md:col-span-5">
            <h2 className="schmal mb-5 text-3xl sm:text-4xl md:text-6xl">So finden Sie uns</h2>
            <address className="text-base not-italic md:text-xl">
              {f.strasse}
              <br />
              {f.plz} {f.ort}
            </address>
            <p className="mt-5 rounded-md bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-linie">{f.hinweisAnfahrt}</p>
            <div className="mt-8 grid gap-2 lg:grid-cols-3">
              <a href={mapsHref(f.strasse, f.plz, f.ort)} className="w-full min-h-11 px-3 text-[15px] md:min-h-12 md:text-base knopf knopf-dunkel" rel="noopener noreferrer">
                <Route /> Route planen
              </a>
              <a href={telHref(f.telefon)} className="w-full min-h-11 px-3 text-[15px] md:min-h-12 md:text-base knopf knopf-rahmen">
                <Telefon /> Anrufen
              </a>
              <a href={whatsappHref(f.whatsapp)} className="w-full min-h-11 px-3 text-[15px] md:min-h-12 md:text-base knopf knopf-rahmen" rel="noopener noreferrer">
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
              <span className="schmal mt-1 block text-2xl md:text-5xl">{offeneStellen.map((s) => s.titel).join(" · ")}</span>
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
