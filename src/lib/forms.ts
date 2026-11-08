import { unstable_rethrow } from "next/navigation";

/** Ergebnis einer Server Action für Formulare mit useActionState. */
export type Ergebnis = {
  status: "leer" | "ok" | "fehler";
  meldung?: string;
  fehler?: Record<string, string>;
  /** Eingaben, damit das Formular nach einem Fehler nichts verliert */
  werte?: Record<string, string>;
  /** Wechselt bei jedem Absenden, damit Formulare neu aufbauen können */
  versuch?: number;
  daten?: Record<string, unknown>;
};

export const LEER: Ergebnis = { status: "leer" };

export function text(formData: FormData, name: string, max = 500): string {
  const wert = formData.get(name);
  if (typeof wert !== "string") return "";
  return wert.replace(/\r\n?/g, "\n").replace(/[^\P{C}\n\t]/gu, "").trim().slice(0, max);
}

export function zahl(formData: FormData, name: string): number | null {
  const wert = text(formData, name, 40).replace(/\./g, "").replace(",", ".");
  if (!wert) return null;
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}

/** „40,00“ oder „40“ → 4000 Cent; leer → null. */
export function centAus(formData: FormData, name: string): number | null {
  const n = zahl(formData, name);
  return n === null ? null : Math.round(n * 100);
}

export function ja(formData: FormData, name: string): boolean {
  const wert = formData.get(name);
  return wert === "on" || wert === "true" || wert === "1";
}

export function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert);
}

export function istTelefon(wert: string): boolean {
  return /^[0-9 +()/.-]{6,}$/.test(wert) && (wert.match(/\d/g)?.length ?? 0) >= 5;
}

/** Werte eines Formulars zurückgeben (für die Fehleranzeige). */
export function werteAus(formData: FormData): Record<string, string> {
  const werte: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) werte[k] = v;
  return werte;
}

/**
 * Führt eine Server Action aus und wandelt Ausnahmen in eine Meldung um, damit das Formular stehen bleibt
 * und die Eingaben behält, statt einer Fehlerseite zu weichen.
 */
export async function sicher(formData: FormData | null, aktion: () => Promise<Ergebnis>): Promise<Ergebnis> {
  try {
    return await aktion();
  } catch (error) {
    // redirect() und notFound() werfen absichtlich; die müssen durch.
    unstable_rethrow(error);
    console.error(error);
    return {
      status: "fehler",
      meldung: error instanceof Error ? error.message : "Das hat nicht geklappt. Bitte noch einmal versuchen.",
      werte: formData ? werteAus(formData) : undefined,
      versuch: Date.now(),
    };
  }
}

/** Unsichtbares Feld gegen Spam (Name bewusst nichtssagend, damit Passwort-Manager es nicht füllen). */
export const FALLE = "feld_x7";

export function istSpam(formData: FormData): boolean {
  const sekunden = Number(formData.get("t"));
  return Boolean(formData.get(FALLE)) || (Number.isFinite(sekunden) && sekunden > 0 && sekunden < 2);
}
