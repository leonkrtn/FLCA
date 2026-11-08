"use client";

export default function Fehler({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="rand flex min-h-[60dvh] flex-col justify-center py-16">
      <h1 className="schmal mb-3 text-3xl">Da ist etwas schiefgelaufen.</h1>
      <p className="mb-6 max-w-md text-grau">Bitte versuchen Sie es noch einmal. Wenn es wieder passiert, rufen Sie uns kurz an.</p>
      <button onClick={reset} className="knopf knopf-dunkel w-fit">Noch einmal versuchen</button>
    </main>
  );
}
