/**
 * Was im Postfach gerade zu sehen ist, steht in der Adresse (Zurück-Knopf, Lesezeichen, Push-Links):
 * `p` Postfach (firma/ich), `o` Ordner oder Filter, `k` Kategorie, `q` Suche, `e=1` einzelne Mails statt
 * Unterhaltungen, `g` die geöffnete Unterhaltung bzw. Mail. Ohne Abhängigkeiten (Server und Browser).
 */

export type AnsichtName = "eingang" | "sonstige" | "ausgang" | "gesendet" | "entwuerfe" | "archiv" | "papierkorb" | "gekennzeichnet" | "zugewiesen" | "spaeter";

export type MailAnsicht = { p: "firma" | "ich"; o: AnsichtName; k: string; q: string; e: boolean; g: string };

const ANSICHTEN: AnsichtName[] = ["eingang", "sonstige", "ausgang", "gesendet", "entwuerfe", "archiv", "papierkorb", "gekennzeichnet", "zugewiesen", "spaeter"];

export const ORDNER_TEXT: Record<AnsichtName, string> = {
  eingang: "Posteingang",
  sonstige: "Sonstige",
  ausgang: "Postausgang",
  gesendet: "Gesendet",
  entwuerfe: "Entwürfe",
  archiv: "Archiv",
  papierkorb: "Papierkorb",
  gekennzeichnet: "Gekennzeichnet",
  zugewiesen: "Mir zugewiesen",
  spaeter: "Zurückgestellt",
};

const uuid = (x: unknown) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : "");

/** Adresse lesen. Ohne Zugriff aufs Firmenpostfach gilt immer das eigene. */
export function ansichtLesen(sp: Record<string, string | string[] | undefined>, firma: boolean): MailAnsicht {
  const o = ANSICHTEN.includes(sp.o as AnsichtName) ? (sp.o as AnsichtName) : "eingang";
  const p = firma && sp.p !== "ich" ? "firma" : "ich";
  return {
    p: o === "zugewiesen" ? "ich" : p,
    // „Sonstige“ gibt es nur im Firmenpostfach
    o: o === "sonstige" && p !== "firma" ? "eingang" : o,
    k: uuid(sp.k),
    q: typeof sp.q === "string" ? sp.q.slice(0, 100) : "",
    e: sp.e === "1",
    g: uuid(sp.g),
  };
}

/** Adresse bauen; `aenderung` überschreibt einzelne Teile. Wechsel von Postfach oder Ordner schließt die geöffnete Mail. */
export function ansichtHref(basis: string, a: MailAnsicht, aenderung: Partial<MailAnsicht> = {}): string {
  const n = { ...a, ...aenderung };
  if (("p" in aenderung && aenderung.p !== a.p) || ("o" in aenderung && aenderung.o !== a.o) || ("k" in aenderung && aenderung.k !== a.k)) n.g = aenderung.g ?? "";
  const q = new URLSearchParams();
  if (n.p !== "firma") q.set("p", n.p);
  if (n.o !== "eingang") q.set("o", n.o);
  if (n.k) q.set("k", n.k);
  if (n.q) q.set("q", n.q);
  if (n.e) q.set("e", "1");
  if (n.g) q.set("g", n.g);
  const s = q.toString();
  return s ? `${basis}?${s}` : basis;
}
