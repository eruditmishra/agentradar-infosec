import { Pool } from "pg";
import { config } from "../shared/config";

// Note: Config parsing is assumed to handle the DATABASE_URL.
// If your config doesn't export the URL directly, modify this as needed.
export const db = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/agentradar",
});
