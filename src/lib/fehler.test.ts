import { describe, expect, it, vi } from "vitest";
import { istSystemfehler, schluessel, weich } from "./fehler";
import { DbFehler } from "./supabase/admin";

describe("Fehlerprotokoll", () => {
  it("fasst gleiche Fehler mit anderen IDs und Nummern zusammen", () => {
    const a = schluessel("Seite /admin/termine/[id] (GET /admin/termine/3f2a9c1e-1111-2222-3333-444455556666)", "Termin 4711 nicht gefunden");
    const b = schluessel("Seite /admin/termine/[id] (GET /admin/termine/9b8a7c6d-aaaa-bbbb-cccc-ddddeeeeffff)", "Termin 4712 nicht gefunden");
    expect(a).toBe(b);
    expect(schluessel("Takt: datev", "x")).not.toBe(schluessel("Takt: saison", "x"));
  });

  it("trennt Systemfehler von Meldungen an den Benutzer", () => {
    expect(istSystemfehler(new DbFehler({ message: "kaputt", code: "42703" }))).toBe(true);
    expect(istSystemfehler(new TypeError("Cannot read properties of null (reading 'id')"))).toBe(true);
    expect(istSystemfehler({ message: "PostgREST-Objekt" })).toBe(true);
    expect(istSystemfehler(new Error("Bitte Name angeben."))).toBe(false);
  });

  it("weich() liefert den Ersatz und meldet den Fehler", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(weich(Promise.reject(new TypeError("kaputt")), 0, "Zähler")).resolves.toBe(0);
    await expect(weich(() => Promise.resolve(3), 0, "Zähler")).resolves.toBe(3);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Zähler"), expect.any(TypeError));
    log.mockRestore();
  });
});
