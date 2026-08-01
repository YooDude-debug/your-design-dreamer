import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import ydudeLogo from "@/assets/ydude-logo.png";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum — Y-Dude" },
      {
        name: "description",
        content: "Impressum und Anbieterkennzeichnung von Y-Dude gemäß § 5 DDG.",
      },
      { property: "og:title", content: "Impressum — Y-Dude" },
      { property: "og:description", content: "Impressum und Anbieterkennzeichnung von Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImpressumPage,
});

function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[760px] px-4 py-8">
        <div className="rounded-2xl border border-border bg-surface/40 p-6 md:p-10">
          <div className="flex items-center justify-between">
            <img src={ydudeLogo} alt="Y-Dude" className="h-10 w-auto" />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
          </div>

          <h1 className="mt-8 text-3xl font-black tracking-tight">
            <span className="text-gradient-green">Impressum</span>
          </h1>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-base font-semibold text-foreground">Angaben gemäß § 5 DDG</h2>
              <p className="mt-2">
                Mario Jorde
                <br />
                Kienbergstraße 21
                <br />
                12685 Berlin
              </p>
              <p className="mt-2">
                E-Mail:{" "}
                <a
                  href="mailto:Tidymagic@gmail.com"
                  className="text-brand underline underline-offset-2"
                >
                  Tidymagic@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground">
                Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
              </h2>
              <p className="mt-2">
                Mario Jorde
                <br />
                Kienbergstraße 21
                <br />
                12685 Berlin
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
