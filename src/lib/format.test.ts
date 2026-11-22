import { describe, expect, it } from "vitest";
import { telHref, whatsappHref } from "./format";

describe("Telefon- und WhatsApp-Links", () => {
  // So tragen Kunden ihre Nummer bei der Terminanfrage ein; alle meinen dieselbe Nummer.
  const formen = ["0171 1234567", "(0171) 123 45 67", "0049 171 1234567", "+49 171 1234567"];

  it.each(formen)("tel: %s", (n) => expect(telHref(n)).toBe("tel:+491711234567"));
  it.each(formen)("WhatsApp: %s", (n) => expect(whatsappHref(n)).toBe("https://wa.me/491711234567"));

  it("hängt den Text an", () => {
    expect(whatsappHref("4961069999", "Hallo du")).toBe("https://wa.me/4961069999?text=Hallo%20du");
  });
});
