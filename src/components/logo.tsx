import pfade from "@/assets/logo-pfade.json";

/**
 * Logo als Vektor, nachgezeichnet nach dem bisherigen Logo. Die Schrift ist in Pfade umgewandelt, das Logo
 * sieht also überall gleich aus. Farbe = currentColor; `aussparung` ist die Farbe der Schrift im Balken
 * (gleich dem Hintergrund, auf dem das Logo steht).
 */
export function Logo({ className, aussparung = "var(--color-boden)", mitClaim = true, titel = "FLC Automotive" }: { className?: string; aussparung?: string; mitClaim?: boolean; titel?: string }) {
  return (
    <svg viewBox={mitClaim ? "0 0 420 280" : "0 0 420 236"} className={className} role="img" aria-label={titel} style={{ ["--logo-aussparung" as string]: aussparung }}>
      <path d={pfade.huelle} fill="none" stroke="currentColor" strokeWidth={7} strokeLinejoin="round" />
      <path d={pfade.fenster} fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" />
      <path d={pfade.balken} fill="currentColor" />
      <path d={pfade.t1} fill="currentColor" />
      <path d={pfade.t2} fill="var(--logo-aussparung)" />
      {mitClaim ? <path d={pfade.t3} fill="currentColor" /> : null}
    </svg>
  );
}
