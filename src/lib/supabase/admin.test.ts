import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { DbFehler, mitFehlern } from "./admin";

/** Client mit nachgebautem PostgREST: antwortet immer mit `status` und `body`. */
function client(status: number, body: unknown) {
  const aufrufe: string[] = [];
  const fetch = async (url: RequestInfo | URL) => {
    aufrufe.push(String(url));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { c: mitFehlern(createClient("https://beispiel.supabase.co", "geheim", { global: { fetch }, auth: { persistSession: false } })), aufrufe };
}

describe("db() wirft bei Datenbankfehlern", () => {
  it("liefert Daten unverändert, wenn alles klappt", async () => {
    const { c } = client(200, [{ id: "1" }]);
    const { data, error } = await c.from("termine").select("id").eq("status", "angefragt").order("beginn");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "1" }]);
  });

  it("nennt Tabelle, Vorgang und Abhilfe bei mehrdeutiger Verknüpfung", async () => {
    const { c } = client(300, { code: "PGRST201", message: "Could not embed because more than one relationship was found", details: null, hint: "Try changing 'profile'" });
    const fehler = await c.from("termine").select("*, mitarbeiter:profile(id)").eq("id", "x").maybeSingle().then(
      () => null,
      (e: unknown) => e,
    );
    expect(fehler).toBeInstanceOf(DbFehler);
    expect((fehler as DbFehler).code).toBe("PGRST201");
    expect((fehler as DbFehler).message).toContain("„termine“ (lesen)");
    expect((fehler as DbFehler).message).toContain("Fremdschlüssel angeben");
  });

  it("wirft auch, wenn die Abfrage erst in einer Variablen gebaut wird", async () => {
    const { c } = client(400, { code: "42703", message: "column termine.gibtsnicht does not exist" });
    let q = c.from("termine").select("id");
    q = q.eq("status", "x");
    await expect(q).rejects.toThrow(/Migration/);
  });

  it("wirft bei Änderungen und in Promise.all", async () => {
    const { c } = client(409, { code: "23505", message: "duplicate key" });
    await expect(c.from("kunden").update({ name: "A" }).eq("id", "1")).rejects.toThrow(/„kunden“ \(ändern\).*gibt es schon/);
    await expect(Promise.all([c.from("kunden").insert({ name: "A" })])).rejects.toBeInstanceOf(DbFehler);
  });

  it("nennt die Funktion bei rpc", async () => {
    const { c } = client(404, { code: "PGRST202", message: "Could not find the function public.termin_anlegen" });
    await expect(c.rpc("termin_anlegen", { p: {} })).rejects.toThrow(/Funktion „termin_anlegen“.*Migration/);
  });

  it("lässt .single() ohne Treffer als „nicht gefunden“ durch", async () => {
    const { c } = client(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows" });
    const { data } = await c.from("termine").select("id").eq("id", "x").single();
    expect(data).toBeNull();
  });

  it("wirft bei .single() mit mehreren Treffern", async () => {
    const { c } = client(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 2 rows" });
    await expect(c.from("termine").select("id").single()).rejects.toThrow(/mehrere/);
  });
});
