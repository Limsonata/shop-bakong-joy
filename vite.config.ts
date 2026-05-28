// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      include: [
        "@supabase/supabase-js",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@tanstack/react-start",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-label",
        "@radix-ui/react-select",
        "@radix-ui/react-slider",
        "@radix-ui/react-tabs",
        "@radix-ui/react-slot",
        "lucide-react",
        "qrcode.react",
        "sonner",
        "zod",
        "zustand",
        "zustand/middleware",
      ],
    },
  },
});
