import { describe, expect, it } from "vitest";
import { mailPruefen, pruefen, pushText, Warnung, webhookPruefen, zaehlen } from "./regeln";

const HTML = '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body>Hallo</body></html>';
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n");

describe("Systemcheck: Einzelprüfung", () => {
  it("Rückgabe ist Grün, Warnung Gelb, jeder andere Fehler Rot mit Ursache", async () => {
    const gruen = await pruefen("Lesen", "Kunden", async () => "3 Einträge");
    expect(gruen).toMatchObject({ stand: "ok", text: "3 Einträge" });

    const gelb = await pruefen("Dienste", "Push", async () => {
      throw new Warnung("nicht eingerichtet");
    });
    expect(gelb).toMatchObject({ stand: "warnung", text: "nicht eingerichtet" });
    expect(gelb.ursache).toBeUndefined();

    const fehler = Object.assign(new Error("Spalte fehlt"), { code: "42703" });
    const rot = await pruefen("Lesen", "Termine", async () => {
      throw fehler;
    });
    expect(rot).toMatchObject({ stand: "fehler", text: "Spalte fehlt" });
    expect(rot.ursache).toBe(fehler);
  });

  it("bricht eine hängende Prüfung nach der Grenze ab", async () => {
    const p = await pruefen("Dienste", "Resend", () => new Promise(() => {}), 20);
    expect(p.stand).toBe("fehler");
    expect(p.text).toContain("Keine Antwort");
  });

  it("zählt und fasst Rotes für den Push zusammen", () => {
    const liste = [
      { gruppe: "Lesen", name: "A", stand: "fehler" as const },
      { gruppe: "Lesen", name: "B", stand: "warnung" as const },
      { gruppe: "Speicher", name: "C", stand: "ok" as const },
      ...["D", "E", "F", "G", "H"].map((n) => ({ gruppe: "Schreiben", name: n, stand: "fehler" as const })),
    ];
    expect(zaehlen(liste)).toEqual({ rot: 6, gelb: 1, gruen: 1 });
    expect(pushText(liste)).toBe("Lesen: A, Schreiben: D, Schreiben: E, Schreiben: F und 2 weitere");
  });
});

describe("Systemcheck: Mail im Testmodus", () => {
  const gut = { an: "kunde@beispiel.de", von: '"FLC" <info@flc.de>', betreff: "Ihre Rechnung", html: HTML, text: "Hallo" };

  it("lässt eine vollständige Mail mit PDF durch", () => {
    expect(mailPruefen({ ...gut, anhaenge: [{ dateiname: "RE-1.pdf", inhalt: PDF, typ: "application/pdf" }] })).toEqual([]);
  });

  it("findet Empfänger, Betreff, Inhalt und Anhänge, die nicht stimmen", () => {
    const fehler = mailPruefen({
      an: ["kunde@beispiel", ""],
      von: "",
      betreff: " ",
      html: "<p>ohne Kopf</p>",
      text: "",
      anhaenge: [
        { dateiname: "RE-1.pdf", inhalt: Buffer.from("kaputt"), typ: "application/pdf" },
        { dateiname: "leer.txt", inhalt: Buffer.alloc(0) },
      ],
    });
    expect(fehler).toEqual([
      "Ungültige Adresse: kunde@beispiel",
      "Ungültiger Absender: (leer)",
      "Betreff fehlt.",
      "Textfassung fehlt.",
      "HTML ohne Viewport (nicht über mail() gebaut).",
      "Anhang RE-1.pdf ist kein gültiges PDF.",
      "Anhang leer.txt ist leer.",
    ]);
    expect(mailPruefen({ ...gut, an: [] })).toEqual(["Kein Empfänger."]);
  });

  it("lehnt Mails über 40 MB ab", () => {
    const gross = Buffer.alloc(41 * 1024 * 1024, 1);
    expect(mailPruefen({ ...gut, anhaenge: [{ dateiname: "gross.zip", inhalt: gross }] })[0]).toContain("zu groß");
  });
});

describe("Systemcheck: Webhook-Adressen", () => {
  it("nimmt nur öffentliche https-Adressen", () => {
    expect(webhookPruefen("https://hook.example.com/flc")).toEqual([]);
    expect(webhookPruefen("http://hook.example.com")).toEqual(["Nur https ist erlaubt: http://hook.example.com"]);
    expect(webhookPruefen("https://localhost:5678/x")[0]).toContain("Interne Adresse");
    expect(webhookPruefen("kein link")[0]).toContain("Keine gültige Adresse");
  });
});
