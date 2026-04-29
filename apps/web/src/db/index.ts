import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "./schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle({ client: sql, schema });
