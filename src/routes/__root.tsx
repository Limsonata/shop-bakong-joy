import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { FloatingVideoWidget } from "@/components/site/FloatingVideoWidget";
import { MobileTabBar } from "@/components/site/MobileTabBar";
import { InstallPrompt } from "@/components/site/InstallPrompt";
import { useCartSync } from "@/hooks/useCartSync";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#090809" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "BillieGrace" },
      { name: "format-detection", content: "telephone=no" },
      { title: "BillieGrace Closet" },
      {
        name: "description",
        content:
          "Activewear and everyday essentials designed for women. New arrivals dropping weekly, delivered across Cambodia.",
      },
      { name: "author", content: "BillieGrace Closet" },
      { property: "og:title", content: "BillieGrace Closet — Made for Her" },
      {
        property: "og:description",
        content:
          "Activewear and everyday essentials designed for women. New arrivals dropping weekly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/Billie.svg",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "apple-touch-icon",
        href: "/icons/apple-touch-icon.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useCartSync();

  // The back office has its own header and navigation, so the storefront
  // chrome is hidden there — it only gets in the way while serving customers.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isBackOffice = pathname.startsWith("/admin");

  // Offline support + installability. Production only, so dev hot-reload is never cached.
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className={`flex min-h-screen flex-col bg-background ${
          isBackOffice ? "" : "pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
        }`}
      >
        {isBackOffice ? null : <Navbar />}
        <main className="flex-1">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        {isBackOffice ? null : <Footer />}
        {isBackOffice ? null : <FloatingVideoWidget />}
        {isBackOffice ? null : <MobileTabBar />}
        {isBackOffice ? null : <InstallPrompt />}
      </div>
      <Toaster position="top-center" richColors />
      <SpeedInsights />
    </QueryClientProvider>
  );
}
