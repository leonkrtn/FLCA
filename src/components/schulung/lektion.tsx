import { type Block, dauerText, type Inline, inhaltLesen, videoErkennen } from "@/lib/schulung/inhalt";

/**
 * Eine Lektion, wie das Team sie sieht. Dieselbe Darstellung in der Team-App und in der Vorschau neben dem
 * Editor der Verwaltung, deshalb ohne Datenbank und ohne Hooks: Bilder kommen als fertige Adressen herein.
 */
export type LektionAnzeige = {
  titel: string;
  kurz: string;
  inhalt: string;
  video_url: string | null;
  dauer_min: number | null;
  werkzeug: string;
  sicherheit: string;
  schlagwoerter: string[];
};

export function LektionInhalt({ l, bilder, ohneTitel = false }: { l: LektionAnzeige; bilder: Record<string, string>; ohneTitel?: boolean }) {
  const video = videoErkennen(l.video_url);
  const dauer = dauerText(l.dauer_min);
  return (
    <article className="grid gap-4">
      {!ohneTitel ? <h1 className="schmal text-2xl leading-tight">{l.titel || "Ohne Titel"}</h1> : null}
      {dauer ? <p className="zahlen -mb-2 text-sm text-grau">{dauer}</p> : null}
      {l.kurz ? <p className="text-grau">{l.kurz}</p> : null}
      {video ? <VideoRahmen einbettung={video.einbettung} titel={l.titel} /> : null}
      {l.sicherheit ? (
        <div role="note" className="border-l-4 border-rot bg-weiss px-4 py-3">
          <p className="text-sm font-semibold text-rot">Sicherheit</p>
          <Zeilen text={l.sicherheit} />
        </div>
      ) : null}
      {l.werkzeug ? (
        <div className="rounded-lg border border-linie px-4 py-3">
          <p className="text-sm font-semibold">Werkzeug und Material</p>
          <Zeilen text={l.werkzeug} />
        </div>
      ) : null}
      <div className="grid gap-3">
        {inhaltLesen(l.inhalt).map((b, i) => (
          <BlockAnzeige key={i} b={b} bilder={bilder} />
        ))}
      </div>
    </article>
  );
}

/** 16:9, Breite der Spalte. Ohne Cookies vor dem Abspielen (youtube-nocookie, Vimeo mit dnt). */
export function VideoRahmen({ einbettung, titel }: { einbettung: string; titel: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-tinte">
      <iframe
        src={einbettung}
        title={titel || "Video"}
        className="size-full"
        loading="lazy"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/** Freitext (Werkzeug, Sicherheit): eine Zeile je Zeile, „- “ am Anfang wird zum Punkt. */
function Zeilen({ text }: { text: string }) {
  const zeilen = text.split("\n").map((z) => z.trim()).filter(Boolean);
  const punkte = zeilen.every((z) => /^[-*•]\s/.test(z));
  if (punkte && zeilen.length > 1)
    return (
      <ul className="mt-1 list-disc pl-5">
        {zeilen.map((z, i) => (
          <li key={i}>{z.replace(/^[-*•]\s+/, "")}</li>
        ))}
      </ul>
    );
  return (
    <p className="mt-1">
      {zeilen.map((z, i) => (
        <span key={i}>
          {i ? <br /> : null}
          {z}
        </span>
      ))}
    </p>
  );
}

function InlineAnzeige({ teile }: { teile: Inline[] }) {
  return (
    <>
      {teile.map((t, i) =>
        t.art === "fett" ? (
          <strong key={i} className="font-semibold">
            {t.text}
          </strong>
        ) : t.art === "link" ? (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {t.text}
          </a>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </>
  );
}

function BlockAnzeige({ b, bilder }: { b: Block; bilder: Record<string, string> }) {
  switch (b.art) {
    case "h2":
      return (
        <h2 className="mt-3 text-lg font-semibold">
          <InlineAnzeige teile={b.inhalt} />
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-1 font-semibold">
          <InlineAnzeige teile={b.inhalt} />
        </h3>
      );
    case "absatz":
      return (
        <p>
          {b.zeilen.map((z, i) => (
            <span key={i}>
              {i ? <br /> : null}
              <InlineAnzeige teile={z} />
            </span>
          ))}
        </p>
      );
    case "liste":
      // Arbeitsschritte als nummerierte Kreise, damit man beim Arbeiten mit einem Blick sieht, wo man ist
      return b.geordnet ? (
        <ol className="grid gap-3">
          {b.punkte.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="zahlen grid size-7 shrink-0 place-items-center rounded-full bg-tinte text-sm font-semibold text-weiss">{b.start + i}</span>
              <span className="min-w-0 pt-0.5">
                <InlineAnzeige teile={p} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {b.punkte.map((p, i) => (
            <li key={i}>
              <InlineAnzeige teile={p} />
            </li>
          ))}
        </ul>
      );
    case "bild": {
      const src = bilder[b.pfad];
      return (
        <figure>
          {src ? (
            // Signierte Adresse aus dem privaten Speicher; ohne Next-Bildoptimierung (siehe next.config)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={b.text} className="w-full rounded-lg bg-papier" loading="lazy" />
          ) : (
            <div className="grid aspect-video place-items-center rounded-lg bg-papier text-sm text-grau">Bild nicht gefunden</div>
          )}
          {b.text ? <figcaption className="mt-1 text-sm text-grau">{b.text}</figcaption> : null}
        </figure>
      );
    }
  }
}
