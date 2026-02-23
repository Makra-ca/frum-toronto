import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config();

async function check() {
  const sql = neon(process.env.DATABASE_URL!);
  const recipients = await sql`SELECT * FROM form_email_recipients`;
  console.log("Recipients:", JSON.stringify(recipients, null, 2));
}

check();
