import "dotenv/config";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const NEW_PASSWORD = "Admin123!";

async function resetAdminPassword() {
  console.log("Finding admin users...");

  const adminUsers = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.role, "admin"));

  if (adminUsers.length === 0) {
    console.log("No admin users found. Creating one...");

    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

    const [newAdmin] = await db
      .insert(users)
      .values({
        email: "admin@frumtoronto.com",
        passwordHash,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true,
        emailVerified: new Date(),
      })
      .returning({ id: users.id, email: users.email });

    console.log(`Created admin user: ${newAdmin.email}`);
    console.log(`Password: ${NEW_PASSWORD}`);
    return;
  }

  console.log(`Found ${adminUsers.length} admin user(s):`);
  adminUsers.forEach((u) => console.log(`  - ${u.email} (id: ${u.id})`));

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

  for (const admin of adminUsers) {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, admin.id));

    console.log(`Reset password for: ${admin.email}`);
  }

  console.log(`\nNew password: ${NEW_PASSWORD}`);
}

resetAdminPassword()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
