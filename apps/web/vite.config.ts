import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// The design system ships TSX source, so Vite only discovers its dependencies once a page
// imports them, and reloads the page when it does. Pre-bundle them up front.
const designSystemDeps = [
  "@ui-sdk/react/alert-dialog",
  "@ui-sdk/react/button",
  "@ui-sdk/react/collapsible",
  "@ui-sdk/react/dialog",
  "@ui-sdk/react/field",
  "@ui-sdk/react/input",
  "@ui-sdk/react/label",
  "@ui-sdk/react/menu",
  "@ui-sdk/react/popover",
  "@ui-sdk/react/primitive",
  "@ui-sdk/react/scroll-area",
  "@ui-sdk/react/select",
  "@ui-sdk/react/separator",
  "@ui-sdk/react/switch",
  "@ui-sdk/react/tabs",
  "@ui-sdk/react/textarea",
  "@ui-sdk/react/toggle",
  "@ui-sdk/react/tooltip",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
].map((dep) => `@jaiir320/design-system > ${dep}`);

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    // The CommonJS use-sync-external-store shim (still imported by TanStack's react-store) breaks
    // server rendering in the production build (a second React); serve it as ESM instead.
    // See src/lib/syncExternalStore.ts.
    alias: [
      {
        find: /^use-sync-external-store\/shim(\/index|\/with-selector)?(\.js)?$/,
        replacement: fileURLToPath(new URL("./src/lib/syncExternalStore.ts", import.meta.url)),
      },
    ],
  },
  optimizeDeps: { include: designSystemDeps },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
