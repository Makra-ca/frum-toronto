/**
 * Prints ONE imported community member's working login, for testing that the
 * legacy password import actually works end to end.
 *
 * Run it yourself (it prints a real password, so it is not run by the assistant):
 *
 *   node -r dotenv/config scripts/legacy-import/show-test-login.js
 *
 * What it does:
 *   1. picks an imported account that is active and has a password hash
 *   2. reads that member's original password from the legacy MSSQL DB (SELECT only)
 *   3. verifies it with bcrypt.compare against the hash stored in Postgres
 *   4. prints the pair only if the check passes
 *
 * So whatever it prints is proven to work, not assumed. Nothing is written to
 * either database.
 *
 * NOTE: this is a real member's real password, which they may reuse elsewhere.
 * Use it once to confirm login works, then ask them to change it — or just
 * delete this script when you are done.
 */
const mssql = require("mssql");
const bcrypt = require("bcryptjs");
const { neon } = require("@neondatabase/serverless");

const pg = neon(process.env.DATABASE_URL);

const legacyCfg = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || "1433", 10),
  database: "FrumToronto",
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 60000 },
  requestTimeout: 120000,
};

/** Pass --staff to prefer a frumtoronto.com address over a community member. */
const preferStaff = process.argv.includes("--staff");

(async () => {
  const candidates = await pg.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, s.old_member_id
       FROM users u
       JOIN email_subscribers s ON s.user_id = u.id
      WHERE s.old_member_id IS NOT NULL
        AND u.is_active
        AND u.password_hash IS NOT NULL
        ${preferStaff ? "AND u.email LIKE '%@frumtoronto.com'" : ""}
      ORDER BY s.old_member_id
      LIMIT 40`
  );

  if (candidates.length === 0) {
    console.log("No candidates found.");
    process.exit(1);
  }

  const pool = await mssql.connect(legacyCfg);

  for (const c of candidates) {
    const [legacy] = (
      await pool
        .request()
        .query(`SELECT Password FROM MemberList WHERE MemberID = ${c.old_member_id}`)
    ).recordset;

    if (!legacy || !legacy.Password) continue;
    if (!(await bcrypt.compare(legacy.Password, c.password_hash))) continue;

    console.log("\nVERIFIED WORKING LOGIN (bcrypt.compare passed)\n");
    console.log("  email    :", c.email);
    console.log("  password :", legacy.Password);
    console.log("  name     :", `${c.first_name || ""} ${c.last_name || ""}`.trim() || "(none)");
    console.log("  user id  :", c.id, "| legacy MemberID:", c.old_member_id);
    console.log("\nSign in at /login with the email and password above.\n");
    await pool.close();
    return;
  }

  console.log("No candidate validated — that would mean the password import is broken.");
  await pool.close();
  process.exit(1);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
