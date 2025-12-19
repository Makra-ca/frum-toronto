/**
 * DATABASE SCHEMA EXPLORATION SCRIPT
 *
 * THIS SCRIPT IS READ-ONLY - IT ONLY USES SELECT QUERIES
 * NO INSERT, UPDATE, DELETE, DROP, OR ANY MODIFICATION COMMANDS
 */

const sql = require("mssql");

const baseConfig = {
  user: 'frumto',
  password: '201518',
  server: '216.105.90.65',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  },
};

async function exploreTables(pool, dbName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DATABASE: ${dbName}`);
  console.log('='.repeat(60));

  // Get all tables (READ-ONLY QUERY)
  const tablesResult = await pool.request().query(`
    SELECT name FROM sys.tables WHERE type = 'U' ORDER BY name
  `);

  const tables = tablesResult.recordset.map(row => row.name);
  console.log(`\nFound ${tables.length} tables:\n`);

  for (const tableName of tables) {
    console.log(`\n--- Table: [${tableName}] ---`);

    // Get columns for this table (READ-ONLY QUERY)
    const columnsResult = await pool.request().query(`
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = '${tableName}'
      ORDER BY c.ORDINAL_POSITION
    `);

    console.log('Columns:');
    for (const col of columnsResult.recordset) {
      const typeInfo = col.CHARACTER_MAXIMUM_LENGTH
        ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
        : col.DATA_TYPE;
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  - ${col.COLUMN_NAME}: ${typeInfo} ${nullable}`);
    }

    // Get row count (READ-ONLY QUERY)
    try {
      const countResult = await pool.request().query(`
        SELECT COUNT(*) as cnt FROM [dbo].[${tableName}]
      `);
      console.log(`Row count: ${countResult.recordset[0].cnt}`);
    } catch (err) {
      console.log(`Row count: Unable to count (${err.message})`);
    }
  }
}

async function getSampleData(pool, tableName, limit = 3) {
  try {
    const result = await pool.request().query(`
      SELECT TOP ${limit} * FROM [dbo].[${tableName}]
    `);
    return result.recordset;
  } catch (err) {
    return null;
  }
}

async function main() {
  let poolShared, poolToronto;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  DATABASE SCHEMA EXPLORATION (READ-ONLY)                     ║');
  console.log('║  Only SELECT queries are executed - NO modifications         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Connect to FrumShared
    console.log('\nConnecting to FrumShared...');
    poolShared = await sql.connect({
      ...baseConfig,
      database: 'FrumShared',
    });
    console.log('Connected to FrumShared successfully.');

    await exploreTables(poolShared, 'FrumShared');
    await poolShared.close();

    // Connect to FrumToronto
    console.log('\n\nConnecting to FrumToronto...');
    poolToronto = await sql.connect({
      ...baseConfig,
      database: 'FrumToronto',
    });
    console.log('Connected to FrumToronto successfully.');

    await exploreTables(poolToronto, 'FrumToronto');
    await poolToronto.close();

    console.log('\n\n' + '='.repeat(60));
    console.log('EXPLORATION COMPLETE');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (poolShared) await poolShared.close().catch(() => {});
    if (poolToronto) await poolToronto.close().catch(() => {});
  }
}

main();
