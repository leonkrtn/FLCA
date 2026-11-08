import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { ENV } from "./env";
import { db } from "./supabase/admin";

const STUNDE = 60 * 60;
const VIERTELSTUNDE = 15 * 60;

/**
 * Höchstzahl pro Zeitfenster (Sekunden). Gezählt wird pro Anschluss (IP-Adresse bzw. IPv6-Netz),
 * bei den Arten „…Konto“ pro E-Mail-Adresse.
 */
const limits = {
  termin: { maximal: 6, fenster: STUNDE },
  storno: { maximal: 10, fenster: STUNDE },
  bewerbung: { maximal: 5, fenster: STUNDE },
  upload: { maximal: 10, fenster: STUNDE },
  anmeldung: { maximal: 30, fenster: VIERTELSTUNDE },
  anmeldungKonto: { maximal: 10, fenster: VIERTELSTUNDE },
  passwortLink: { maximal: 10, fenster: STUNDE },
  passwortLinkKonto: { maximal: 3, fenster: STUNDE },
} as const;

/**
 * Anschlüsse mit IPv6 bekommen meist ein ganzes /64-Netz mit unzähligen Adressen.
 * Gezählt wird deshalb pro Netz, sonst ließe sich das Limit mit jeder neuen Adresse umgehen.
 */
function anschluss(ip: string): string {
  const adresse = ip.split("%")[0].toLowerCase();
  if (!adresse.includes(":")) return adresse;
  const ipv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(adresse);
  if (ipv4) return ipv4[1];

  const [vorne, hinten] = adresse.split("::");
  const a = vorne ? vorne.split(":") : [];
  const b = hinten ? hinten.split(":") : [];
  const gruppen = hinten === undefined ? a : [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return `${gruppen
    .slice(0, 4)
    .map((gruppe) => gruppe.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * Zählt einen Versuch des aufrufenden Anschlusses (oder, mit `kennung`, z. B. einer E-Mail-Adresse).
 * Gespeichert wird nur ein Hash. Ist die Prüfung gestört, meldet sie „fehler“; die Formulare weisen dann
 * ab, damit ein Ausfall das Limit nicht aushebelt.
 */
export async function imLimit(art: keyof typeof limits, kennung?: string): Promise<"ok" | "limit" | "fehler"> {
  try {
    let wert = kennung?.trim().toLowerCase();
    if (!wert) {
      const kopfzeilen = await headers();
      // Vercel setzt x-forwarded-for selbst, Angaben des Browsers werden überschrieben.
      const ip = kopfzeilen.get("x-forwarded-for")?.split(",")[0]?.trim() || kopfzeilen.get("x-real-ip") || "unbekannt";
      wert = anschluss(ip);
    }
    const hash = createHmac("sha256", ENV.supabaseSecretKey).update(wert).digest("hex");

    const { maximal, fenster } = limits[art];
    const { data, error } = await db().rpc("versuch_zaehlen", {
      schluessel: `${art}:${hash}`,
      maximal,
      fenster_sekunden: fenster,
    });
    if (error) throw error;
    return data ? "ok" : "limit";
  } catch (error) {
    console.error("Formular-Limit konnte nicht geprüft werden", error);
    return "fehler";
  }
}
