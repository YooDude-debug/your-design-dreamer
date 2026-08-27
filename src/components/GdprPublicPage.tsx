import { BackButton } from "@/components/ui/nav-buttons";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { GdprTexts } from "@/lib/i18n-gdpr-public";

/** Gemeinsames Layout der öffentlichen DSGVO-Seiten. */
export function GdprPublicPage({
  title,
  lead,
  t,
  children,
}: {
  title: string;
  lead: string;
  t: GdprTexts;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <BackButton to="/" label="Y-Dude" className="mb-6" />

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lead}</p>

      <div className="mt-8">{children}</div>

      <section className="mt-10 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
          {t.privacyTitle}
        </h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          {t.privacyPoints.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link to="/datenschutz" className="underline hover:text-foreground">
            Datenschutzerklärung
          </Link>
          {" · "}
          <Link to="/impressum" className="underline hover:text-foreground">
            Impressum
          </Link>
        </p>
      </section>
    </main>
  );
}

export const gdprInputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand";

export const gdprLabelClass = "block text-xs font-medium text-muted-foreground";

/** Aufzählung der betroffenen Datenkategorien. */
export function GdprDataList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
