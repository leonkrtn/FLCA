import Link from "next/link";

/** Seitenkopf im Admin: Titel links, Aktionen rechts. */
export function Kopf({ titel, unter, children, zurueck }: { titel: string; unter?: React.ReactNode; children?: React.ReactNode; zurueck?: { href: string; text: string } }) {
  return (
    <div className="mb-6 md:mb-8">
      {zurueck ? (
        <Link href={zurueck.href} className="mb-3 inline-block text-sm text-grau hover:text-tinte">
          ← {zurueck.text}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="schmal text-3xl md:text-4xl">{titel}</h1>
          {unter ? <div className="mt-1 text-grau">{unter}</div> : null}
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function Abschnitt({ titel, children, aktion, className = "" }: { titel?: string; children: React.ReactNode; aktion?: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-8 bg-weiss p-4 md:p-6 ${className}`}>
      {titel || aktion ? (
        <div className="mb-4 flex items-center justify-between gap-4">
          {titel ? <h2 className="text-lg font-semibold">{titel}</h2> : <span />}
          {aktion}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const TONE = {
  neutral: "bg-boden text-tinte",
  dunkel: "bg-tinte text-weiss",
  warnung: "bg-kreide text-tinte",
  ok: "bg-ok text-weiss",
  rot: "bg-rot text-weiss",
  hell: "border border-linie text-grau",
} as const;

export function Marke({ children, ton = "neutral" }: { children: React.ReactNode; ton?: keyof typeof TONE }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${TONE[ton]}`}>{children}</span>;
}

export function Leer({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-grau">{children}</p>;
}

/** Reiter als Links, Zustand steht in der URL (Zurück-Taste und Deep-Links funktionieren). */
export function Reiter({ eintraege, aktiv }: { eintraege: { href: string; text: string; anzahl?: number }[]; aktiv: string }) {
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-linie px-4 md:mx-0 md:px-0" aria-label="Ansicht">
      {eintraege.map((e) => {
        const ist = e.href === aktiv;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={ist ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${ist ? "border-tinte text-tinte" : "border-transparent text-grau hover:text-tinte"}`}
          >
            {e.text}
            {e.anzahl ? <span className="zahlen rounded-full bg-tinte px-1.5 text-xs text-weiss">{e.anzahl}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Feld({
  label,
  name,
  wert,
  typ = "text",
  hilfe,
  className = "",
  ...rest
}: {
  label: string;
  name: string;
  wert?: string | number | null;
  typ?: string;
  hilfe?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "defaultValue">) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <input id={`f-${name}`} name={name} type={typ} defaultValue={wert ?? ""} className="feld" {...rest} />
      {hilfe ? <p className="mt-1 text-sm text-grau">{hilfe}</p> : null}
    </div>
  );
}

export function Textfeld({ label, name, wert, zeilen = 4, hilfe, className = "" }: { label: string; name: string; wert?: string | null; zeilen?: number; hilfe?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <textarea id={`f-${name}`} name={name} rows={zeilen} defaultValue={wert ?? ""} className="feld" />
      {hilfe ? <p className="mt-1 text-sm text-grau">{hilfe}</p> : null}
    </div>
  );
}

export function Auswahl({ label, name, wert, optionen, className = "", leer }: { label: string; name: string; wert?: string | null; optionen: [string, string][]; className?: string; leer?: string }) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={wert ?? ""} className="feld">
        {leer !== undefined ? <option value="">{leer}</option> : null}
        {optionen.map(([w, t]) => (
          <option key={w} value={w}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Schalter({ label, name, an, hilfe }: { label: string; name: string; an: boolean; hilfe?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={an} className="mt-1 size-5 accent-tinte" />
      <span>
        <span className="font-semibold">{label}</span>
        {hilfe ? <span className="block text-sm text-grau">{hilfe}</span> : null}
      </span>
    </label>
  );
}

/** Tabelle: Zahlenspalten rechtsbündig mit gleich breiten Ziffern (Klasse „zahl“ an th und td). */
export function Tabelle({ kopf, children }: { kopf: (string | { text: string; zahl?: boolean })[]; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-tinte text-left">
            {kopf.map((k) => {
              const t = typeof k === "string" ? { text: k } : k;
              return (
                <th key={t.text} className={`px-3 py-2 font-semibold first:pl-4 md:first:pl-0 ${t.zahl ? "text-right" : ""}`}>
                  {t.text}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&_td.zahl]:zahlen [&_td.zahl]:text-right [&_td]:border-b [&_td]:border-linie [&_td]:px-3 [&_td]:py-2.5 [&_td:first-child]:pl-4 md:[&_td:first-child]:pl-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}
