import { ZONE } from "./zeit";

/** Cent als Euro-Betrag, z. B. 4000 → „40,00 €“. */
export function euro(cent: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
}

/** Cent als Preisangabe der Website: „40 €“, „ab 95 €“, „Preis auf Anfrage“. */
export function preis(cent: number | null, ab = false): string {
  if (cent === null) return "auf Anfrage";
  const betrag = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cent % 100 === 0 ? 0 : 2,
  }).format(cent / 100);
  return ab ? `ab ${betrag}` : betrag;
}

/** Telefonnummer als tel:-Link im internationalen Format. */
export function telHref(telefon: string): string {
  const ziffern = telefon.replace(/[^\d+]/g, "");
  if (ziffern.startsWith("+")) return `tel:${ziffern}`;
  if (ziffern.startsWith("00")) return `tel:+${ziffern.slice(2)}`;
  if (ziffern.startsWith("0")) return `tel:+49${ziffern.slice(1)}`;
  return `tel:${ziffern}`;
}

export function whatsappHref(nummer: string, text?: string): string {
  return `https://wa.me/${nummer.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mapsHref(strasse: string, plz: string, ort: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${strasse}, ${plz} ${ort}`)}`;
}

const datumFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: ZONE });
const datumLang = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE });
const datumKurz = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: ZONE });
const zeitFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });

const alsDatum = (wert: string | Date) =>
  wert instanceof Date ? wert : /^\d{4}-\d{2}-\d{2}$/.test(wert) ? new Date(`${wert}T12:00:00Z`) : new Date(wert);

/** 01.12.2026 */
export function datum(wert: string | Date | null | undefined): string {
  return wert ? datumFormat.format(alsDatum(wert)) : "";
}
/** Dienstag, 1. Dezember */
export function datumLangText(wert: string | Date): string {
  return datumLang.format(alsDatum(wert));
}
/** Di., 01.12. */
export function datumKurzText(wert: string | Date): string {
  return datumKurz.format(alsDatum(wert));
}
/** 09:30 */
export function zeit(wert: string | Date): string {
  return zeitFormat.format(alsDatum(wert));
}
/** 01.12.2026, 09:30 */
export function datumZeit(wert: string | Date | null | undefined): string {
  return wert ? `${datum(wert)}, ${zeit(wert)}` : "";
}

/** Kennzeichen einheitlich groß, mit einfachen Leerzeichen. */
export function kennzeichen(wert: string): string {
  return wert.toUpperCase().replace(/\s+/g, " ").trim();
}

/** Text mit Leerzeilen in Absätze teilen. */
export function absaetze(text: string): string[] {
  return text.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
}

/** Zeilen eines Textfelds als Liste. */
export function zeilen(text: string): string[] {
  return text.split("\n").map((z) => z.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}
