import type { Termin } from "./termine";

export const TERMIN_TON: Record<Termin["status"], "warnung" | "dunkel" | "hell" | "ok" | "neutral"> = {
  angefragt: "warnung",
  bestaetigt: "dunkel",
  abgelehnt: "hell",
  storniert: "hell",
  erledigt: "ok",
  nicht_erschienen: "hell",
};
