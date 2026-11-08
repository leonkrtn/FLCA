/**
 * Eine Icon-Familie: 24er Raster, 1,75 px Strich, runde Enden. Icons stehen nur dort, wo sie eine Handlung
 * oder Bedeutung tragen (Anrufen, Nachricht, Route), nicht als Dekoration neben Überschriften.
 */
type Props = { className?: string; titel?: string };

function Icon({ className = "size-5", titel, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={titel ? undefined : true}
      role={titel ? "img" : undefined}
      aria-label={titel}
    >
      {children}
    </svg>
  );
}

export const Telefon = (p: Props) => (
  <Icon {...p}>
    <path d="M5 3h3.5l1.5 4.5-2 1.5a11 11 0 0 0 7 7l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />
  </Icon>
);
export const Nachricht = (p: Props) => (
  <Icon {...p}>
    <path d="M4 19.5 5.2 16A8 8 0 1 1 8 18.8Z" />
  </Icon>
);
export const Route = (p: Props) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.25" />
  </Icon>
);
export const Pfeil = (p: Props) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const Zurueck = (p: Props) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const Haken = (p: Props) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);
export const Kreuz = (p: Props) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const Menue = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const Plus = (p: Props) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const Kalender = (p: Props) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="1.5" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icon>
);
export const Liste = (p: Props) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Icon>
);
export const Dokument = (p: Props) => (
  <Icon {...p}>
    <path d="M7 3h7l4 4v14H7Z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </Icon>
);
export const Uhr = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const Person = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Icon>
);
export const Kamera = (p: Props) => (
  <Icon {...p}>
    <path d="M4 8h3l2-2.5h6L17 8h3v11H4Z" />
    <circle cx="12" cy="13" r="3.25" />
  </Icon>
);
export const Mehr = (p: Props) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="18" cy="12" r="1" />
  </Icon>
);
export const Download = (p: Props) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);
export const Glocke = (p: Props) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);
