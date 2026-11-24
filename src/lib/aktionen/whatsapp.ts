"use server";

import { benutzerMitRecht } from "../auth";
import { verlauf } from "../ereignisse";
import { weich } from "../fehler";
import { WHATSAPP_VORLAGEN, type WhatsappVorlage } from "../whatsapp";

const BEREICH = { termin: "termine", kostenvoranschlag: "rechnungen", rechnung: "rechnungen" } as const;

/**
 * Hält im Verlauf fest, dass jemand die WhatsApp-Nachricht geöffnet hat. Ob sie wirklich rausging, weiß die
 * Website nicht. Läuft beim Tipp nebenher; schlägt es fehl, öffnet WhatsApp trotzdem, der Fehler steht im
 * Protokoll.
 */
export async function whatsappVermerken(art: keyof typeof BEREICH, id: string, vorlage: WhatsappVorlage): Promise<void> {
  if (!(art in BEREICH)) return;
  const b = await benutzerMitRecht(BEREICH[art]);
  const titel = WHATSAPP_VORLAGEN.find((v) => v.schluessel === vorlage)?.titel;
  if (!titel) return;
  await weich(() => verlauf(art, id, `WhatsApp geöffnet: ${titel}`, b.id), undefined, "WhatsApp im Verlauf vermerken");
}
