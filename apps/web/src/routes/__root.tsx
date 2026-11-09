import appCss from "../styles.css?url";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Analytics } from "@vercel/analytics/react";
import { AppHeader } from "#/features/root/AppHeader";
import { FeedbackGate } from "#/features/root/FeedbackGate";
import { ReactScan } from "#/features/root/ReactScan";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "DeckDiff",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col wrap-anywhere">
        <AppHeader />
        <div className="flex-1">{children}</div>
        <FeedbackGate />
        <ReactScan />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Analytics />
        <Scripts />
      </body>
    </html>
  ),
});
