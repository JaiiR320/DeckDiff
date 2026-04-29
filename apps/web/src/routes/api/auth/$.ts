import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";

async function handleAuthRequest({ request }: { request: Request }) {
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handleAuthRequest,
      POST: handleAuthRequest,
    },
  },
});
