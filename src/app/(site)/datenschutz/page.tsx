import type { Metadata } from "next";
import { rechtstext } from "@/lib/rechtstexte";

export const revalidate = 86400;
export const metadata: Metadata = { title: "Datenschutz" };

export default async function Datenschutz() {
  const { html } = await rechtstext("datenschutz");
  return (
    <article className="rand pb-24 *:max-w-3xl pt-8 md:pt-14">
      <h1 className="schmal mb-8 text-4xl md:text-5xl">Datenschutz</h1>
      <div className="rechtstext" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
