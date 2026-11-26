import { describe, expect, it } from "vitest";
import { emailVerdecken, nameVerdecken, stammVerdecken, stammZusammenfuehren, telefonVerdecken } from "./verdecken";

const max = { name: "Max Mustermann", firma: "Muster GmbH", ust_id: "DE123456789", telefon: "0170 1234567", email: "max.muster@gmail.com", strasse: "Hauptstr. 5", plz: "63128", ort: "Dietzenbach" };

describe("verdecken", () => {
  it("zeigt vom Namen nur Vorname und Anfangsbuchstaben", () => {
    expect(nameVerdecken("Max Mustermann")).toBe("Max M.");
    expect(nameVerdecken("Anna Maria Schmidt")).toBe("Anna M. S.");
    expect(nameVerdecken("Müller")).toBe("M•••••");
    expect(nameVerdecken("  ")).toBe("");
  });

  it("zeigt von der Telefonnummer nur die letzten drei Ziffern", () => {
    expect(telefonVerdecken("0170 1234567")).toBe("•••• 567");
    expect(telefonVerdecken("+49 6074 12")).toBe("•••• 412");
    expect(telefonVerdecken("123")).toBe("••••");
    expect(telefonVerdecken("")).toBe("");
  });

  it("verdeckt die E-Mail bis auf Anfang und Endung", () => {
    expect(emailVerdecken("max.muster@gmail.com")).toBe("m•••@g•••.com");
    expect(emailVerdecken("kaputt")).toBe("••••");
  });

  it("lässt nichts Lesbares von Straße, Telefon und E-Mail übrig", () => {
    const v = stammVerdecken(max);
    expect(JSON.stringify(v)).not.toMatch(/Mustermann|Hauptstr|1234567|max\.muster|123456789|63128/);
    expect(v.ort).toBe("Dietzenbach");
  });

  it("behält beim Speichern, was leer gelassen wurde, und übernimmt Eingetipptes", () => {
    const neu = { ...Object.fromEntries(Object.keys(max).map((k) => [k, ""])), telefon: "0151 999999" } as typeof max;
    expect(stammZusammenfuehren(max, neu)).toEqual({ ...max, telefon: "0151 999999" });
  });
});
