import { dash } from "@better-auth/infra";
import dotenv from "dotenv";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/db";
import { schema } from "#/db/schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  process.env.AUTH_SECRET ??
  process.env.SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "deckdiff-dev-auth-secret");

const dashApiKey = process.env.BETTER_AUTH_API_KEY?.trim();

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is not configured.");
}

const authBaseURL = process.env.BETTER_AUTH_URL;

function toOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function getVercelOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  return toOrigin(value.startsWith("http") ? value : `https://${value}`);
}

const trustedOrigins = [
  toOrigin(authBaseURL),
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  getVercelOrigin(process.env.VERCEL_URL),
  getVercelOrigin(process.env.VERCEL_BRANCH_URL),
  getVercelOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  "*.vercel.app",
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? []),
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  baseURL: authBaseURL,
  trustedOrigins,
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [dash({ apiKey: dashApiKey }), tanstackStartCookies()],
});
