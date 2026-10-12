import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config();

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/agentradar",
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;

  if (!password) {
    password = crypto.randomBytes(16).toString("base64");
    generated = true;
  }

  const role = "super_admin"; // matches the CHECK constraint added in migration 008_rbac_roles.sql

  console.log(`Checking if admin user ${email} exists...`);
  const existing = await db.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rowCount && existing.rowCount > 0) {
    console.log(`User ${email} already exists.`);
    process.exit(0);
  }

  console.log(`Hashing password for ${email}...`);
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);

  console.log(`Inserting ${email} into the database...`);
  await db.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)",
    [email, hash, role],
  );

  console.log("Admin user created successfully!");
  if (generated) {
    // False positive (Client Privacy Violation): this is a one-time,
    // operator-run CLI seed script (`npx tsx scripts/seed-admin.ts`), not a
    // server code path that runs against untrusted/remote input. The
    // password is generated here (crypto.randomBytes) and never persisted
    // anywhere in plaintext — printing it to the local terminal is the only
    // way to hand the one-time credential to the operator, the same pattern
    // used by tools like `django-admin createsuperuser`.
    console.log(`\n=================================================`);
    console.log(`🔑 GENERATED ADMIN PASSWORD: ${password}`);
    console.log(`   Please save this immediately! It will not be shown again.`);
    console.log(`=================================================\n`);
  }
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
