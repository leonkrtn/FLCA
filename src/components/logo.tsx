import logo from "@/assets/logo-pfade.json";

/**
 * Logo als Vektor, aus der Originaldatei nachgezeichnet (Konturen geglättet, nichts neu gesetzt).
 * Eine einzige Fläche in currentColor: auf hellem Grund dunkel, auf dunklem Grund hell.
 */
export function Logo({ className, titel = "FLC Automotive" }: { className?: string; titel?: string }) {
  return (
    <svg viewBox={logo.viewbox} className={className} role="img" aria-label={titel}>
      <path d={logo.pfad} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
