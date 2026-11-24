import { describe, expect, it } from "vitest";
import { kennzeichenNorm, telefonVergleich, telHref, whatsappHref } from "./format";

describe("Telefon- und WhatsApp-Links", () => {
  // So tragen Kunden ihre Nummer bei der Terminanfrage ein; alle meinen dieselbe Nummer.
  const formen = ["0171 1234567", "(0171) 123 45 67", "0049 171 1234567", "+49 171 1234567"];

  it.each(formen)("tel: %s", (n) => expect(telHref(n)).toBe("tel:+491711234567"));
  it.each(formen)("WhatsApp: %s", (n) => expect(whatsappHref(n)).toBe("https://wa.me/491711234567"));

  it("hängt den Text an", () => {
    expect(whatsappHref("4961069999", "Hallo du")).toBe("https://wa.me/4961069999?text=Hallo%20du");
  });
});

describe("Vergleichen am Kundenbildschirm", () => {
  it("Telefonnummern in jeder Schreibweise gleich", () => {
    const soll = "491711234567";
    for (const t of ["0171 1234567", "+49 171 1234567", "0049 (171) 123 45 67", "0171/123-45-67"]) expect(telefonVergleich(t)).toBe(soll);
  });
  it("Kennzeichen ohne Leerzeichen und Bindestrich", () => {
    expect(kennzeichenNorm("of-ab 123")).toBe("OFAB123");
    expect(kennzeichenNorm("OF AB 123E")).toBe("OFAB123E");
  });
});
