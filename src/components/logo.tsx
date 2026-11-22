import logo from "@/assets/logo-pfade.json";

/**
 * Logo als Vektor, aus der Originaldatei nachgezeichnet (Konturen geglättet, nichts neu gesetzt).
 * Eine einzige Fläche in currentColor: auf hellem Grund dunkel, auf dunklem Grund hell. Die Schrift im
 * Balken ist ausgespart, damit der Grund durchscheint. Beim Überfahren mit der Maus bleibt die Farbe.
 */
export function Logo({ className, titel = "FLC Automotive, Kfz-Service Ciurli" }: { className?: string; titel?: string }) {
  return (
    <svg viewBox={logo.viewbox} className={className} role="img" aria-label={titel}>
      <path d={logo.pfad} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
