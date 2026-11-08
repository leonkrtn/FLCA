/** Kalenderdatei (RFC 5545) für die Terminbestätigung. */
export function ics({
  uid,
  beginn,
  ende,
  titel,
  ort,
  beschreibung,
  storniert = false,
}: {
  uid: string;
  beginn: Date;
  ende: Date;
  titel: string;
  ort: string;
  beschreibung: string;
  storniert?: boolean;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  // Zeilen über 75 Oktetts müssen gefaltet werden
  const falten = (zeile: string) => zeile.match(/.{1,73}/g)!.join("\r\n ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FLC Automotive//Termine//DE",
    `METHOD:${storniert ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${uid}@flc-automotive.de`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(beginn)}`,
    `DTEND:${fmt(ende)}`,
    `SUMMARY:${esc(titel)}`,
    `LOCATION:${esc(ort)}`,
    `DESCRIPTION:${esc(beschreibung)}`,
    `STATUS:${storniert ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(titel)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(falten)
    .join("\r\n");
}
