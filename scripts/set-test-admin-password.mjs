/**
 * Give the admin account a known password ON THE TEST BRANCH ONLY.
 *
 * Every session so far has recorded the same limitation — "admin pages could
 * not be exercised in a browser (no admin password)" — which is exactly how a
 * missing Approve button survived for months while its API worked perfectly.
 *
 * Safe here and only here: the test branch is disposable and holds no real
 * traffic. This must never be pointed at production, hence the assertion.
 *
 * Run: node scripts/set-test-admin-password.mjs
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const env = {};
config({ path: ".env.test", processEnv: env });

const TEST_ENDPOINT = "ep-polished-heart-ahl7bvmv";
const url = env.DATABASE_URL;

if (!url) throw new Error("No DATABASE_URL in .env.test");
if (!url.includes(TEST_ENDPOINT)) {
  throw new Error(`REFUSING: not the test branch (${TEST_ENDPOINT})`);
}

const sql = neon(url);
const PASSWORD = "TestAdmin!2026";

const [admin] = await sql`
  SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`;
if (!admin) throw new Error("No admin account on the test branch");

// Cost 12, matching /api/auth/register — so the login path is exercised
// exactly as a real one would be, not through a weaker hash.
const hash = await bcrypt.hash(PASSWORD, 12);

await sql`
  UPDATE users
  SET password_hash = ${hash},
      email_verified = COALESCE(email_verified, now()),
      is_active = true
  WHERE id = ${admin.id}`;

console.log(`test-branch admin ready: ${admin.email}`);
console.log(`password: ${PASSWORD}`);
