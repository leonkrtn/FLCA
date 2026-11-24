import { describe, expect, it } from "vitest";
import { bilderIn, dauerText, inhaltLesen, inlineLesen, klartext, schlagwoerterLesen, suchen, umsetzen, videoErkennen } from "./inhalt";

describe("inhaltLesen", () => {
  it("liest Überschriften, Absätze, Listen und Bilder", () => {
    const b = inhaltLesen(
      [
        "## Vorbereitung",
        "Fahrzeug auf die Bühne.",
        "Zweite Zeile.",
        "",
        "1. Radmuttern lösen",
        "2. Anheben",
        "- Handschuhe",
        "![Drehmoment](bild:lektionen/abc.jpg)",
        "### Danach",
      ].join("\n"),
    );
    expect(b.map((x) => x.art)).toEqual(["h2", "absatz", "liste", "liste", "bild", "h3"]);
    expect(b[1]).toMatchObject({ zeilen: [[{ text: "Fahrzeug auf die Bühne." }], [{ text: "Zweite Zeile." }]] });
    expect(b[2]).toMatchObject({ geordnet: true, start: 1, punkte: [[{ text: "Radmuttern lösen" }], [{ text: "Anheben" }]] });
    expect(b[3]).toMatchObject({ geordnet: false });
    expect(b[4]).toEqual({ art: "bild", pfad: "lektionen/abc.jpg", text: "Drehmoment" });
  });

  it("nummerierte Liste kann bei einer anderen Zahl beginnen", () => {
    expect(inhaltLesen("4. Weiter")[0]).toMatchObject({ art: "liste", start: 4 });
  });

  it("eingerückte Zeile setzt den Listenpunkt fort", () => {
    const b = inhaltLesen("1. Rad abnehmen\n   und ablegen");
    expect(b).toHaveLength(1);
    expect(klartext("1. Rad abnehmen\n   und ablegen")).toBe("Rad abnehmen  und ablegen");
  });

  it("nimmt fremde Bildquellen nicht als Bild", () => {
    expect(inhaltLesen("![x](https://boese.example/a.jpg)")[0].art).toBe("absatz");
    expect(inhaltLesen("![x](bild:../../geheim.jpg)")[0].art).toBe("absatz");
  });

  it("findet alle Bilder einmal", () => {
    expect(bilderIn("![a](bild:x/1.jpg)\n\n![b](bild:x/1.jpg)\n![c](bild:x/2.png)")).toEqual(["x/1.jpg", "x/2.png"]);
  });
});

describe("inlineLesen", () => {
  it("fett und Links", () => {
    expect(inlineLesen("Mit **120 Nm** anziehen, siehe [Handbuch](https://example.com/a).")).toEqual([
      { art: "text", text: "Mit " },
      { art: "fett", text: "120 Nm" },
      { art: "text", text: " anziehen, siehe " },
      { art: "link", text: "Handbuch", href: "https://example.com/a" },
      { art: "text", text: "." },
    ]);
  });

  it("keine javascript-Links", () => {
    expect(inlineLesen("[x](javascript:alert(1))")).toEqual([{ art: "text", text: "[x](javascript:alert(1))" }]);
  });
});

describe("videoErkennen", () => {
  it("YouTube in allen üblichen Formen", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"]) {
      expect(videoErkennen(u)?.einbettung).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    }
  });

  it("YouTube mit Startzeit", () => {
    expect(videoErkennen("https://youtu.be/dQw4w9WgXcQ?t=1m30s")?.einbettung).toContain("start=90");
    expect(videoErkennen("https://youtu.be/dQw4w9WgXcQ?t=42")?.einbettung).toContain("start=42");
  });

  it("Vimeo, auch nicht gelistet mit Schlüssel", () => {
    expect(videoErkennen("https://vimeo.com/123456789")?.einbettung).toBe("https://player.vimeo.com/video/123456789?dnt=1&playsinline=1");
    expect(videoErkennen("https://vimeo.com/123456789/abc123def0")?.einbettung).toContain("h=abc123def0");
    expect(videoErkennen("https://player.vimeo.com/video/123456789?h=abc123def0")?.link).toBe("https://vimeo.com/123456789/abc123def0");
  });

  it("andere Adressen und Unsinn", () => {
    expect(videoErkennen("https://example.com/video.mp4")).toBeNull();
    expect(videoErkennen("youtube")).toBeNull();
    expect(videoErkennen("https://www.youtube.com/watch?v=kurz")).toBeNull();
    expect(videoErkennen("")).toBeNull();
  });
});

describe("suchen", () => {
  const l = (titel: string, mehr: Partial<{ kurz: string; inhalt: string; schlagwoerter: string[]; werkzeug: string }> = {}) => ({
    titel,
    kurz: "",
    inhalt: "",
    schlagwoerter: [],
    werkzeug: "",
    ...mehr,
  });
  const liste = [l("Stempeln in der App"), l("Ölwechsel", { werkzeug: "Ölfilterschlüssel" }), l("Bremsen prüfen", { inhalt: "Dabei auch die Reifen ansehen." }), l("Räder wechseln", { schlagwoerter: ["Reifen"] })];

  it("Titel und Schlagwörter vor Text", () => {
    expect(suchen(liste, "reifen").map((x) => x.titel)).toEqual(["Räder wechseln", "Bremsen prüfen"]);
  });

  it("ohne Umlaute und Groß/klein, alle Wörter müssen passen", () => {
    expect(suchen(liste, "OLWECHSEL").map((x) => x.titel)).toEqual(["Ölwechsel"]);
    expect(suchen(liste, "öl schlüssel").map((x) => x.titel)).toEqual(["Ölwechsel"]);
    expect(suchen(liste, "öl bremse")).toEqual([]);
  });

  it("leere Suche findet nichts", () => {
    expect(suchen(liste, "  ")).toEqual([]);
  });
});

describe("Hilfen", () => {
  it("Schlagwörter ohne doppelte", () => {
    expect(schlagwoerterLesen("Reifen, reifen; RDKS,, Felge ")).toEqual(["Reifen", "RDKS", "Felge"]);
  });

  it("umsetzen", () => {
    expect(umsetzen(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(umsetzen(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(umsetzen(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(umsetzen(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("Dauer", () => {
    expect(dauerText(3)).toBe("3 Min.");
    expect(dauerText(75)).toBe("1 Std. 15 Min.");
    expect(dauerText(null)).toBe("");
  });
});
