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
export const Brief = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="m3.5 6 8.5 7 8.5-7" />
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
export const Zahnrad = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
);

// Mail: Leiste über einer geöffneten Mail. Fahne und Nadel sind gefüllt, wenn sie gesetzt sind.
export const Antworten = (p: Props) => (
  <Icon {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);
export const Weiterleiten = (p: Props) => (
  <Icon {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);
export const Archiv = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />
  </Icon>
);
export const Posteingang = (p: Props) => (
  <Icon {...p}>
    <path d="M4 13 6.5 5h11l2.5 8v6H4Z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </Icon>
);
export const Papierkorb = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
  </Icon>
);
export const Wiederherstellen = (p: Props) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);
export const Fahne = ({ an, ...p }: Props & { an?: boolean }) => (
  <Icon {...p}>
    <path d="M5 21V4h11l-2 4 2 4H5" fill={an ? "currentColor" : "none"} />
  </Icon>
);
export const Nadel = ({ an, ...p }: Props & { an?: boolean }) => (
  <Icon {...p}>
    <path d="M9 3h6l-1 6 3 3H7l3-3-1-6Z" fill={an ? "currentColor" : "none"} />
    <path d="M12 12v9" />
  </Icon>
);
export const Etikett = (p: Props) => (
  <Icon {...p}>
    <path d="M3.5 3.5H11l9.5 9.5-7.5 7.5-9.5-9.5Z" />
    <circle cx="8" cy="8" r="1.25" />
  </Icon>
);
export const Glocke = (p: Props) => (
  <Icon {...p}>
    <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);
export const Ungelesen = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="6" width="15" height="13" rx="1.5" />
    <path d="m3.5 7 7 5.5 7-5.5" />
    <circle cx="19.5" cy="5.5" r="2.5" fill="currentColor" stroke="none" />
  </Icon>
);
export const Drucker = (p: Props) => (
  <Icon {...p}>
    <path d="M7 9V3h10v6" />
    <path d="M6 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
    <path d="M7 14h10v7H7Z" />
  </Icon>
);
