import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// The design system ships TSX source, so Vite only discovers its dependencies once a page
// imports them and can end up serving raw CommonJS (Base UI's use-sync-external-store shim).
// Pre-bundle them up front.
const designSystemDeps = [
  "@base-ui/react/alert-dialog",
  "@base-ui/react/button",
  "@base-ui/react/collapsible",
  "@base-ui/react/context-menu",
  "@base-ui/react/dialog",
  "@base-ui/react/field",
  "@base-ui/react/input",
  "@base-ui/react/menu",
  "@base-ui/react/merge-props",
  "@base-ui/react/popover",
  "@base-ui/react/scroll-area",
  "@base-ui/react/select",
  "@base-ui/react/separator",
  "@base-ui/react/switch",
  "@base-ui/react/tabs",
  "@base-ui/react/toggle",
  "@base-ui/react/toggle-group",
  "@base-ui/react/tooltip",
  "@base-ui/react/use-render",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
].map((dep) => `@jaiir320/design-system > ${dep}`);

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Base UI's CommonJS use-sync-external-store shim breaks server rendering in the
    // production build (a second React); serve it as ESM instead. See src/lib/syncExternalStore.ts.
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
