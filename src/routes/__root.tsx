import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LazyToaster } from "@/components/lazy/LazyToaster";
import { LanguageProvider } from "@/lib/i18n";
import { useLang } from "@/lib/lang-context";
import { ThemeProvider } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { installStaleBundleRecovery, recoverFromStaleBundle } from "@/lib/recover-stale-bundle";
import { installGlobalZoomGuards } from "@/lib/no-zoom";
import { useLastSeenHeartbeat } from "@/lib/use-last-seen-heartbeat";
import { AppSplash } from "@/components/AppSplash";

function NotFoundComponent() {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div className="relative">
        <h1 className="text-8xl font-extrabold tracking-tighter text-gradient-green sm:text-9xl">
          {t.notFoundTitle}
        </h1>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 blur-3xl opacity-20"
          style={{
            background: "linear-gradient(90deg, var(--brand), var(--brand-cyan))",
          }}
        />
      </div>

      <h2 className="mt-6 max-w-sm text-xl font-semibold leading-snug text-foreground sm:max-w-md sm:text-2xl">
        {t.notFoundLine1}
      </h2>
      <p className="mt-3 max-w-sm text-base text-muted-foreground sm:max-w-md sm:text-lg">
        {t.notFoundLine2}
      </p>

      <div className="mt-10">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-glow-subtle transition-all hover:shadow-glow active:scale-95"
        >
          {t.backToYdude}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // Veralteter Bundle-Cache (alte Seite aus dem Service Worker) heilt sich
    // selbst: Caches leeren und einmalig frisch laden.
    void recoverFromStaleBundle(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },

      { title: "Y-Dude – Speak Local. Connect Global." },
      {
        name: "description",
        content:
          "Y-Dude connects people through local slang. Share SlangTags, discover regional language and connect with people around the world.",
      },
      { property: "og:title", content: "Y-Dude – Speak Local. Connect Global." },
      {
        property: "og:description",
        content:
          "Y-Dude connects people through local slang. Share SlangTags, discover regional language and connect with people around the world.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Y-Dude" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "Y-Dude" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // Das Theme-Skript setzt data-theme vor dem ersten Paint – bewusst
    // von der Hydration ausgenommen.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          // Verhindert kurzes Aufblitzen des Standard-Themes beim Laden.
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('y-dude:theme');if(t&&t!=='aktuell'&&['dark','white','rainbow'].indexOf(t)>=0){document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t==='white'?'light':'dark';}}catch(e){}",
          }}
        />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Ein einziger Auth-Listener: hält Router und Cache mit der Session synchron,
  // ohne bei Token-Refresh unnötig neu zu laden.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // Selbstheilung bei veraltetem Bundle-Cache (kein Service Worker der App).
  useEffect(() => {
    installStaleBundleRecovery();
  }, []);

  // Antippen einer Push-Benachrichtigung: der Push-Worker meldet das Ziel,
  // die App navigiert im bestehenden Fenster (kein neuer Tab, kein Reload).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; link?: string } | null;
      if (data?.type !== "push-navigate") return;
      const link = typeof data.link === "string" && data.link.startsWith("/") ? data.link : "/dev";
      void (async () => {
        try {
          await router.navigate({ to: link as never });
        } catch {
          window.location.assign(link);
        }
      })();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  // Kein globales Browser-/Viewport-Zoom (Ausnahme: Bild-Viewer).
  useEffect(() => installGlobalZoomGuards(), []);

  // Aktivitätszeitpunkt (`Zuletzt online`) aktuell halten.
  useLastSeenHeartbeat();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <AppSplash />
          <LazyToaster />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
