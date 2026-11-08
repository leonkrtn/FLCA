import "server-only";
import QRCode from "qrcode";

/**
 * GiroCode (EPC069-12, Version 002): Die Banking-App liest Empfänger, IBAN, Betrag und Verwendungszweck
 * aus dem QR-Code. Ohne IBAN gibt es keinen Code.
 */
export async function girocode({ name, iban, bic, cent, zweck }: { name: string; iban: string; bic: string; cent: number; zweck: string }): Promise<string | null> {
  const ibanSauber = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(ibanSauber) || cent <= 0) return null;
  const nutzdaten = [
    "BCD",
    "002",
    "1",
    "SCT",
    bic.replace(/\s/g, "").toUpperCase(),
    name.slice(0, 70),
    ibanSauber,
    `EUR${(cent / 100).toFixed(2)}`,
    "",
    "",
    zweck.slice(0, 140),
  ].join("\n");
  return QRCode.toDataURL(nutzdaten, { errorCorrectionLevel: "M", margin: 0, width: 300 });
}
