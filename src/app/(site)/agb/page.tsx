import type { Metadata } from "next";
import { rechtstext } from "@/lib/rechtstexte";

export const revalidate = 86400;
export const metadata: Metadata = { title: "AGB" };

export default async function Agb() {
  const { html } = await rechtstext("agb");
  return (
    <article className="rand pb-24 *:max-w-3xl pt-8 md:pt-14">
      <h1 className="schmal mb-8 text-4xl md:text-5xl">Allgemeine Geschäftsbedingungen</h1>
      <div className="rechtstext" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
