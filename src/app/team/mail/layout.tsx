import { SchreibenRahmen } from "@/components/mail/schreiben";

/** Schreibfenster und „Rückgängig“ bleiben beim Wechsel zwischen Ordnern und Mails stehen. */
export default function MailLayout({ children }: { children: React.ReactNode }) {
  return <SchreibenRahmen>{children}</SchreibenRahmen>;
}
