import { describe, expect, it } from "vitest";
import { hatText, htmlBereinigen, oeffnungszeitenKurz, signaturHtml, verlaufAbschneiden } from "./inhalt";

describe("htmlBereinigen", () => {
  it("Skripte und Ereignisse fallen weg", () => {
    expect(htmlBereinigen('<p onclick="x()">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)>')).toBe("<p>Hi</p>");
  });
  it("Formatierung bleibt", () => {
    expect(htmlBereinigen('<b>fett</b> <i>kursiv</i> <u>u</u><ul><li>a</li></ul>')).toBe("<b>fett</b> <i>kursiv</i> <u>u</u><ul><li>a</li></ul>");
  });
  it("Links nur http, mailto, tel", () => {
    expect(htmlBereinigen('<a href="javascript:alert(1)">x</a><a href="https://a.de" target="_blank">y</a>')).toBe('<a>x</a><a href="https://a.de">y</a>');
  });
  it("nur erlaubte Stile", () => {
    expect(htmlBereinigen('<span style="font-size:18px;background:url(x);position:fixed">G</span>')).toBe('<span style="font-size:18px">G</span>');
  });
  it("Bilder nur über https", () => {
    expect(htmlBereinigen('<img src="data:image/png;base64,AA"><img src="https://x.de/l.png" width="120" alt="Logo">')).toBe('<img src="https://x.de/l.png" alt="Logo" width="120">');
  });
  it("unbekannte Tags verschwinden, Text bleibt", () => expect(htmlBereinigen("<form><input>Text</form>")).toBe("Text"));
  it("leer erkennen", () => {
    expect(hatText("<p><br></p><div>&nbsp;</div>")).toBe(false);
    expect(hatText("<p>Hallo</p>")).toBe(true);
  });
});

describe("verlaufAbschneiden", () => {
  it("Gmail", () => {
    const r = verlaufAbschneiden('<div>Danke!</div><div class="gmail_quote">Am Mo schrieb X:<blockquote>alt</blockquote></div>', true);
    expect(r.neu).toBe("<div>Danke!</div>");
    expect(r.verlauf).toContain("gmail_quote");
  });
  it("Outlook mit Kopfblock", () => {
    const r = verlaufAbschneiden('<p>Passt so.</p><div id="appendonsend"></div><hr><b>Von:</b> FLC <service@x.de><br><b>Gesendet:</b> Montag', true);
    expect(r.neu).toBe("<p>Passt so.</p>");
  });
  it("Apple Mail: Am … schrieb", () => {
    const r = verlaufAbschneiden("<div>Ok</div><div><br><blockquote type=\"cite\"><div>Am 01.12.2026 um 09:30 schrieb Max:</div>alt</blockquote></div>", true);
    expect(r.neu).toBe("<div>Ok</div>");
  });
  it("nur Zitat: nichts abschneiden", () => {
    const html = '<blockquote type="cite">alt</blockquote>';
    expect(verlaufAbschneiden(html, true)).toEqual({ neu: html, verlauf: "" });
  });
  it("Text: Am … schrieb", () => {
    const r = verlaufAbschneiden("Danke, bis Montag.\n\nAm 01.12.2026 um 09:30 schrieb FLC Automotive <service@x.de>:\n> Ihr Termin", false);
    expect(r.neu).toBe("Danke, bis Montag.");
  });
  it("Text: Outlook-Kopf", () => {
    const r = verlaufAbschneiden("Geht klar\n\nVon: FLC <service@x.de>\nGesendet: Montag, 1. Dezember\nAn: Max", false);
    expect(r.neu).toBe("Geht klar");
  });
  it("Text ohne Verlauf", () => expect(verlaufAbschneiden("Hallo", false)).toEqual({ neu: "Hallo", verlauf: "" }));
});

describe("Signatur", () => {
  const firma = { name: "FLC Automotive", strasse: "Siemensstraße 15", plz: "63128", ort: "Dietzenbach", inhaber: "Flavio Ciurli", titel: "Kfz-Meister", rechtsform: "Einzelunternehmen", steuernummer: "028", ustId: "" };
  it("enthält Name, Job, Firma, Pflichtangaben", () => {
    const html = signaturHtml({ gruss: "Mit freundlichen Grüßen", name: "Max <Muster>", job: "Kfz-Mechatroniker", telefon: "0176 1", email: "max@x.de", firma, website: "https://x.de", oeffnungszeiten: "Mo–Fr 8–18", logoUrl: "https://x.de/mail/logo.png", pflichtangaben: true });
    expect(html).toContain("Max &lt;Muster&gt;");
    expect(html).toContain("Kfz-Mechatroniker");
    expect(html).toContain("Inhaber: Flavio Ciurli (Kfz-Meister)");
    expect(html).toContain('src="https://x.de/mail/logo.png"');
    // übersteht das Bereinigen beim Senden
    expect(htmlBereinigen(html)).toContain('src="https://x.de/mail/logo.png"');
  });
  it("Öffnungszeiten zusammengefasst", () => {
    const f: [string, string][] = [["08:30", "13:00"], ["14:00", "18:00"]];
    expect(oeffnungszeitenKurz({ "1": f, "2": f, "3": f, "4": f, "5": f, "6": [["09:00", "13:00"]], "7": [] })).toBe("Mo–Fr 08:30–13:00, 14:00–18:00 · Sa 09:00–13:00");
  });
});
