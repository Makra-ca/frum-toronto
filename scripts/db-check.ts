/**
 * Database Check Utility
 * Usage: npm run db:check [command] [args]
 *
 * Commands:
 *   tables              - List all tables
 *   columns <table>     - Show columns for a table
 *   count <table>       - Count rows in a table
 *   sample <table> [n]  - Show n sample rows (default 5)
 *   query <sql>         - Run a custom SQL query
 */

import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

const args = process.argv.slice(2);
const command = args[0] || "tables";

async function main() {
  try {
    switch (command) {
      case "tables": {
        const result = await db.execute(sql`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        console.log("\n📋 Tables in database:");
        console.log("─".repeat(40));
        result.rows.forEach((row: Record<string, unknown>) => {
          console.log(`  • ${row.table_name}`);
        });
        break;
      }

      case "columns": {
        const table = args[1];
        if (!table) {
          console.error("❌ Please specify a table name: npm run db:check columns <table>");
          process.exit(1);
        }
        const result = await db.execute(sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = ${table}
          ORDER BY ordinal_position
        `);
        console.log(`\n📋 Columns in "${table}":`);
        console.log("─".repeat(60));
        result.rows.forEach((row: Record<string, unknown>) => {
          const nullable = row.is_nullable === "YES" ? "nullable" : "required";
          const defaultVal = row.column_default ? ` (default: ${row.column_default})` : "";
          console.log(`  • ${row.column_name}: ${row.data_type} [${nullable}]${defaultVal}`);
        });
        break;
      }

      case "count": {
        const table = args[1];
        if (!table) {
          console.error("❌ Please specify a table name: npm run db:check count <table>");
          process.exit(1);
        }
        const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
        console.log(`\n📊 Row count in "${table}": ${result.rows[0]?.count || 0}`);
        break;
      }

      case "sample": {
        const table = args[1];
        const limit = parseInt(args[2]) || 5;
        if (!table) {
          console.error("❌ Please specify a table name: npm run db:check sample <table> [limit]");
          process.exit(1);
        }
        const result = await db.execute(sql.raw(`SELECT * FROM "${table}" LIMIT ${limit}`));
        console.log(`\n📋 Sample rows from "${table}" (${result.rows.length} rows):`);
        console.log("─".repeat(60));
        result.rows.forEach((row: Record<string, unknown>, i: number) => {
          console.log(`\n[${i + 1}]`, JSON.stringify(row, null, 2));
        });
        break;
      }

      case "query": {
        const query = args.slice(1).join(" ");
        if (!query) {
          console.error("❌ Please provide a SQL query: npm run db:check query <sql>");
          process.exit(1);
        }
        console.log(`\n🔍 Executing: ${query}`);
        console.log("─".repeat(60));
        const result = await db.execute(sql.raw(query));
        console.log(`\nResults (${result.rows.length} rows):`);
        result.rows.forEach((row: Record<string, unknown>) => {
          console.log(JSON.stringify(row, null, 2));
        });
        break;
      }

      default:
        console.log(`
📚 Database Check Utility

Commands:
  npm run db:check tables              - List all tables
  npm run db:check columns <table>     - Show columns for a table
  npm run db:check count <table>       - Count rows in a table
  npm run db:check sample <table> [n]  - Show n sample rows (default 5)
  npm run db:check query "<sql>"       - Run a custom SQL query
        `);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
