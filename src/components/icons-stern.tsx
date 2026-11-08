/** Bewertungssterne als Vektor (keine Emoji, keine Schriftzeichen). */
export function Sterne({ anzahl = 5, className = "size-4" }: { anzahl?: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5 text-tinte/60" role="img" aria-label={`${anzahl} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={`${className} ${i < anzahl ? "" : "opacity-25"}`} fill="currentColor" aria-hidden>
          <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
        </svg>
      ))}
    </span>
  );
}
