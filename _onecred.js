/**
 * Picks ONE imported community member and verifies their legacy password
 * actually validates against the hash stored in Postgres, so the credential
 * handed over is proven rather than assumed.
 *
 * Legacy DB is read SELECT-only. Prints a single account.
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

(async () => {
  // Candidates: imported, active, has a password. Ordered by legacy id for a
  // stable pick rather than something random.
  const candidates = await pg.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, s.old_member_id
      FROM users u
      JOIN email_subscribers s ON s.user_id = u.id
     WHERE s.old_member_id IS NOT NULL
       AND u.is_active
       AND u.password_hash IS NOT NULL
     ORDER BY s.old_member_id
     LIMIT 40`);

  const pool = await mssql.connect(legacyCfg);

  for (const c of candidates) {
    const legacy = (
      await pool
        .request()
        .query(`SELECT Password, FirstName, LastName, Email FROM MemberList WHERE MemberID = ${c.old_member_id}`)
    ).recordset[0];

    if (!legacy || !legacy.Password) continue;

    const ok = await bcrypt.compare(legacy.Password, c.password_hash);
    if (!ok) continue;

    console.log("VERIFIED WORKING LOGIN");
    console.log("  email    :", c.email);
    console.log("  password :", legacy.Password);
    console.log("  name     :", `${c.first_name || ""} ${c.last_name || ""}`.trim());
    console.log("  user id  :", c.id, " legacy MemberID:", c.old_member_id);
    console.log("\n  bcrypt.compare(legacy password, stored hash) =", ok);
    await pool.close();
    return;
  }

  console.log("No candidate validated — that would mean the import is broken.");
  await pool.close();
  process.exit(1);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
