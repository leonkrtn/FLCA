import Link from "next/link";
import { Logo } from "@/components/logo";

export function LoginKarte({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-graphit px-4 py-10">
      <Link href="/" aria-label="Zur Website" className="mb-8 text-boden">
        <Logo className="h-16 w-auto" />
      </Link>
      <div className="w-full max-w-sm bg-papier p-6">
        <h1 className="schmal mb-6 text-2xl">{titel}</h1>
        {children}
      </div>
    </main>
  );
}
