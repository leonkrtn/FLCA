import Link from "next/link";

export default function NichtGefunden() {
  return (
    <main className="rand flex min-h-[70dvh] flex-col justify-center py-16">
      <p className="zahlen mb-2 text-grau">404</p>
      <h1 className="schmal mb-4 text-4xl">Diese Seite gibt es nicht.</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="knopf knopf-dunkel">Zur Startseite</Link>
        <Link href="/termin" className="knopf knopf-rahmen">Termin anfragen</Link>
      </div>
    </main>
  );
}
