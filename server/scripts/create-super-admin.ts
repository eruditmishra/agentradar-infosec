import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

dotenv.config();

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/agentradar",
});

function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    email?: string;
    password?: string;
    name?: string;
    force?: boolean;
  } = {};

  const positional: string[] = [];

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      console.log(`
Usage:
  npx tsx scripts/create-super-admin.ts [email] [password] [name] [options]
  npm run create:super-admin -- [email] [password] [name] [options]

Options:
  --email=<email>         Email address for the Super Admin
  --password=<password>   Password (if omitted, a secure 16-char password is generated)
  --name=<name>           Display name (defaults to email prefix)
  --force, -f             Promote existing user to super_admin and update password
  --help, -h              Show this help message

Examples:
  npm run create:super-admin -- superadmin@example.com
  npm run create:super-admin -- superadmin@example.com MySecret123! "Super Admin"
  npm run create:super-admin -- --email=admin@example.com --force
`);
      process.exit(0);
    } else if (arg.startsWith("--email=")) {
      options.email = arg.split("=")[1];
    } else if (arg.startsWith("--password=")) {
      options.password = arg.split("=")[1];
    } else if (arg.startsWith("--name=")) {
      options.name = arg.split("=")[1];
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (!options.email && positional[0]) {
    options.email = positional[0];
  }
  if (!options.password && positional[1]) {
    options.password = positional[1];
  }
  if (!options.name && positional[2]) {
    options.name = positional[2];
  }

  return options;
}

async function main() {
  const parsed = parseArgs();
  let email = parsed.email || process.env.ADMIN_EMAIL;
  let password = parsed.password || process.env.ADMIN_PASSWORD;
  let name = parsed.name;
  let force = parsed.force ?? false;

  const isInteractive = input.isTTY && !process.env.CI;

  if (!email && isInteractive) {
    const rl = readline.createInterface({ input, output });
    try {
      email = await rl.question("Enter Super Admin email: ");
      if (!name) {
        const inputName = await rl.question("Enter Admin name (leave blank for email prefix): ");
        if (inputName.trim()) name = inputName.trim();
      }
      if (!password) {
        const inputPass = await rl.question("Enter password (leave blank to auto-generate): ");
        if (inputPass.trim()) password = inputPass.trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!email || !email.trim()) {
    console.error("❌ Error: Email is required.");
    console.error("Usage: npx tsx scripts/create-super-admin.ts <email> [password] [name]");
    console.error("   Or: ADMIN_EMAIL=user@company.com ADMIN_PASSWORD=secret npx tsx scripts/create-super-admin.ts");
    process.exit(1);
  }

  email = email.trim().toLowerCase();
  name = (name && name.trim()) || email.split("@")[0];

  let isGeneratedPassword = false;
  if (!password) {
    password = crypto.randomBytes(16).toString("base64");
    isGeneratedPassword = true;
  }

  const tenantId = process.env.TENANT_ID || null;
  const role = "super_admin";

  console.log(`\n🔍 Checking if user "${email}" exists...`);
  const existingRes = await db.query(
    "SELECT id, email, role, is_active FROM users WHERE email = $1",
    [email]
  );

  if (existingRes.rowCount && existingRes.rowCount > 0) {
    const existing = existingRes.rows[0];
    console.log(`⚠️ User "${email}" already exists with role: "${existing.role}".`);

    if (!force && isInteractive) {
      const rl = readline.createInterface({ input, output });
      const answer = await rl.question(
        "Do you want to promote this user to Super Admin and update their password? (y/N): "
      );
      rl.close();
      if (answer.trim().toLowerCase() !== "y") {
        console.log("Operation aborted.");
        await db.end();
        process.exit(0);
      }
    } else if (!force) {
      console.log("To update existing user, pass --force flag. Exiting.");
      await db.end();
      process.exit(0);
    }

    console.log(`🔄 Updating user "${email}" to super_admin...`);
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);

    await db.query(
      `UPDATE users
       SET role = 'super_admin',
           password_hash = $1,
           auth_method = 'password',
           mfa_enabled = TRUE,
           is_active = TRUE,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = now()
       WHERE id = $2`,
      [hash, existing.id]
    );

    console.log(`✅ User "${email}" successfully updated to Super Admin!`);
  } else {
    console.log(`🔒 Hashing password for "${email}"...`);
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);

    console.log(`💾 Creating Super Admin record...`);
    await db.query(
      `INSERT INTO users (
         tenant_id,
         email,
         name,
         password_hash,
         role,
         auth_method,
         mfa_enabled,
         is_active
       ) VALUES ($1, $2, $3, $4, $5, 'password', TRUE, TRUE)`,
      [tenantId, email, name, hash, role]
    );

    console.log(`✅ Super Admin created successfully!`);
  }

  console.log(`\n=================================================`);
  console.log(`👤 User:       ${email}`);
  console.log(`🏷️  Role:       ${role}`);
  console.log(`🔐 Auth:       Password (Direct Login)`);
  console.log(`🛡️  MFA:        Enforced (Set up on initial login)`);
  if (isGeneratedPassword) {
    console.log(`🔑 PASSWORD:   ${password}`);
    console.log(`⚠️  Please save this password securely now!`);
  } else {
    console.log(`🔑 PASSWORD:   [password configured via arguments/env]`);
  }
  console.log(`=================================================\n`);

  await db.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Failed to create super admin:", err);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
