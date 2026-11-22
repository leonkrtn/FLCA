export type Rolle = "inhaber" | "buero" | "mitarbeiter";

/** Bereiche des Systems. Die Rolle entscheidet, wer was darf. */
export type Bereich =
  | "termine"
  | "notizen"
  | "kunden"
  | "rechnungen"
  | "einlagerung"
  | "team"
  | "personal"
  | "karriere"
  | "website"
  | "angebote"
  | "einstellungen"
  | "benutzer"
  | "werkstatt";

export const ROLLEN: { wert: Rolle; name: string; beschreibung: string }[] = [
  { wert: "inhaber", name: "Inhaber", beschreibung: "Alles, inklusive Einstellungen, Benutzer und Rechnungsnummern" },
  { wert: "buero", name: "Büro", beschreibung: "Termine, Notizen, Kunden, Rechnungen, Angebote, Einlagerung, Bewerbungen, Mitarbeiterplanung" },
  { wert: "mitarbeiter", name: "Mitarbeiter", beschreibung: "Eigene Arbeitszeiten, Aufträge, Urlaub und Zeiterfassung" },
];

const RECHTE: Record<Bereich, Rolle[]> = {
  termine: ["inhaber", "buero"],
  // Notizen anlegen und bearbeiten; Mitarbeiter sehen nur Erinnerungen, die ihnen zugewiesen sind (Team-App)
  notizen: ["inhaber", "buero"],
  kunden: ["inhaber", "buero"],
  rechnungen: ["inhaber", "buero"],
  einlagerung: ["inhaber", "buero"],
  // Mitarbeiterplanung: Wochenplan, Fähigkeiten, Urlaub. Das Büro plant mit.
  team: ["inhaber", "buero"],
  // Personalsachen: Rolle, Konto, Urlaubsanspruch, Zeiterfassung an/aus und Korrekturen
  personal: ["inhaber"],
  karriere: ["inhaber", "buero"],
  website: ["inhaber"],
  // Angebote wirken auf Website und Belege zugleich; eigenes Recht, damit es getrennt vergeben werden kann
  angebote: ["inhaber", "buero"],
  einstellungen: ["inhaber"],
  benutzer: ["inhaber"],
  // Team-App: alle mit Konto
  werkstatt: ["inhaber", "buero", "mitarbeiter"],
};

export function darf(rolle: Rolle | null | undefined, bereich: Bereich): boolean {
  return Boolean(rolle && RECHTE[bereich].includes(rolle));
}

export function rollenName(rolle: Rolle | null | undefined): string {
  return ROLLEN.find((r) => r.wert === rolle)?.name ?? "Nicht freigeschaltet";
}

/** Startseite nach dem Login je Rolle. */
export function startseite(rolle: Rolle | null | undefined): string {
  return rolle === "mitarbeiter" ? "/team" : "/admin";
}
