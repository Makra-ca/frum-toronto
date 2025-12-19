# Database Connection Setup Guide

This document explains how to connect to the Microsoft SQL Server (MSSQL) database in this Next.js application.

## Overview

This project uses **Microsoft SQL Server (MSSQL)** as the database, with connections to two separate databases:
- **FrumShared** - For Q&A/Ask the Rabbi content
- **FrumToronto** - For Classifieds and other Toronto-specific content

## Required Dependencies

### NPM Package
Install the MSSQL driver for Node.js:

```bash
npm install mssql
```

### TypeScript Types (if using TypeScript)
```bash
npm install --save-dev @types/mssql
```

## Environment Variables

Create a `.env.local` file in the root of your project with the following variables:

```env
DB_USER=your_username
DB_PASSWORD=your_password
DB_SERVER=your_server_ip_or_hostname
DB_PORT=1433

# For Q&A (FrumShared database)
DB_DATABASE_SHARED=FrumShared

# For Classifieds (FrumToronto database)
DB_DATABASE_TORONTO=FrumToronto
```

### Environment Variables Explanation:
- `DB_USER`: Database username for authentication
- `DB_PASSWORD`: Database password for authentication
- `DB_SERVER`: Server IP address or hostname (e.g., `216.105.90.65`)
- `DB_PORT`: SQL Server port (default is `1433`)
- `DB_DATABASE_SHARED`: Name of the shared database (for Q&A content)
- `DB_DATABASE_TORONTO`: Name of the Toronto database (for Classifieds)

## Connection Configuration

### Base Configuration Object

```javascript
const baseConfig = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,                    // Set to true if using Azure SQL
    trustServerCertificate: true,      // Trust self-signed certificates
    connectTimeout: 30000,             // Connection timeout in milliseconds (30 seconds)
  },
};
```

### Database-Specific Configurations

#### For FrumShared Database (Q&A content):
```javascript
const frumSharedConfig = {
  ...baseConfig,
  database: process.env.DB_DATABASE_SHARED || '',
};
```

#### For FrumToronto Database (Classifieds):
```javascript
const frumTorontoConfig = {
  ...baseConfig,
  database: process.env.DB_DATABASE_TORONTO || '',
};
```

## Connection Patterns

### Pattern 1: Basic Connection (TypeScript)

```typescript
import sql from 'mssql';

const config = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE_SHARED || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  },
};

let pool: sql.ConnectionPool | undefined;

try {
  pool = await sql.connect(config);

  const query = 'SELECT * FROM [dbo].[YourTable]';
  const result = await pool.request().query(query);

  console.log(result.recordset);
} catch (err: any) {
  console.error('Database query failed:', err);
} finally {
  if (pool) {
    await pool.close();
  }
}
```

### Pattern 2: Connection in Next.js API Route

```typescript
import { NextResponse } from 'next/server';
import sql from 'mssql';

const frumSharedConfig = {
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE_SHARED || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  },
};

export async function GET() {
  let pool: sql.ConnectionPool | undefined;

  try {
    // Establish connection
    pool = await sql.connect(frumSharedConfig);

    // Execute query
    const query = `
      SELECT TOP 6 BlogEntryID, BlogEntryTitle, BlogEntryText
      FROM [dbo].[BlogEntries]
      WHERE BlogCategoryID = 98
      ORDER BY NEWID()
    `;

    const result = await pool.request().query(query);

    // Return results
    return NextResponse.json(result.recordset);
  } catch (err: any) {
    console.error('SQL Connection or Query Failed:', err);
    return NextResponse.json(
      { error: 'Database query failed', details: err.message },
      { status: 500 }
    );
  } finally {
    // Always close the connection
    if (pool) {
      await pool.close();
    }
  }
}
```

### Pattern 3: Dynamic Database Selection

```typescript
async function getDbConnection(source: string) {
  if (source === 'ask-the-rabbi') {
    return sql.connect(frumSharedConfig);
  } else if (source === 'classifieds') {
    return sql.connect(frumTorontoConfig);
  }
  throw new Error('Invalid data source');
}

// Usage
const pool = await getDbConnection('ask-the-rabbi');
```

### Pattern 4: Parameterized Queries (Prevent SQL Injection)

```typescript
const searchTerm = "Labour doula";

const result = await pool.request()
  .input('searchTerm', sql.NVarChar, `%${searchTerm}%`)
  .query('SELECT * FROM [dbo].[Classified] WHERE ClassifiedTitle LIKE @searchTerm');
```

## Common Query Examples

### Select All Records
```typescript
const result = await pool.request().query(`
  SELECT * FROM [dbo].[BlogEntries]
`);
```

### Select with WHERE Clause
```typescript
const result = await pool.request().query(`
  SELECT BlogEntryID, BlogEntryTitle, BlogEntryText
  FROM [dbo].[BlogEntries]
  WHERE BlogCategoryID = 98
`);
```

### Select Latest Records
```typescript
const result = await pool.request().query(`
  SELECT TOP 6
    ID as BlogEntryID,
    ClassifiedTitle as BlogEntryTitle,
    ClassifiedDetails as BlogEntryText
  FROM [dbo].[Classified]
  ORDER BY StartDte DESC
`);
```

### Get Database Schema Information
```typescript
// Get all tables
const tables = await pool.request().query(`
  SELECT name FROM sys.tables WHERE type = 'U' ORDER BY name
`);

// Get columns for a specific table
const columns = await pool.request().query(`
  SELECT COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'YourTableName'
    AND DATA_TYPE IN ('char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext')
`);
```

## Important Best Practices

### 1. Always Close Connections
```typescript
finally {
  if (pool) {
    await pool.close();
  }
}
```

### 2. Use Try-Catch for Error Handling
```typescript
try {
  // Database operations
} catch (err: any) {
  console.error('Database error:', err);
  // Handle error appropriately
}
```

### 3. Use Parameterized Queries
Never concatenate user input directly into SQL queries. Always use parameters:
```typescript
// ✅ GOOD - Uses parameters
await pool.request()
  .input('searchTerm', sql.NVarChar, searchValue)
  .query('SELECT * FROM Users WHERE Name = @searchTerm');

// ❌ BAD - Vulnerable to SQL injection
await pool.request()
  .query(`SELECT * FROM Users WHERE Name = '${searchValue}'`);
```

### 4. Handle Connection Timeouts
The configuration includes a 30-second connection timeout:
```javascript
options: {
  connectTimeout: 30000,  // 30 seconds
}
```

### 5. Connection Pool Type Annotation (TypeScript)
```typescript
let pool: sql.ConnectionPool | undefined;
```

## Database Tables Used in This Project

### FrumShared Database
- **BlogEntries**: Contains Q&A content
  - `BlogEntryID`: Unique identifier
  - `BlogEntryTitle`: Title of the entry
  - `BlogEntryText`: Full text content
  - `BlogCategoryID`: Category (98 = Ask the Rabbi)

### FrumToronto Database
- **Classified**: Contains classified ads
  - `ID`: Unique identifier
  - `ClassifiedTitle`: Title of the classified
  - `ClassifiedDetails`: Details of the classified
  - `StartDte`: Start date for sorting

## Configuration Options Explained

### `encrypt: false`
- Set to `false` for on-premise SQL Server
- Set to `true` if using Azure SQL Database

### `trustServerCertificate: true`
- Trusts self-signed certificates
- Set to `false` in production with proper SSL certificates

### `connectTimeout: 30000`
- Maximum time (in milliseconds) to wait for connection
- 30000 = 30 seconds

## Testing the Connection

You can test the database connection using the included `db-test.js` file:

```bash
node db-test.js
```

This script will:
1. Connect to the FrumToronto database
2. Search through all tables for a specific term
3. Display results if found
4. Close the connection

## Troubleshooting

### Connection Timeout
- Check if the SQL Server is accessible from your network
- Verify firewall settings allow port 1433
- Increase `connectTimeout` value if needed

### Authentication Failed
- Verify `DB_USER` and `DB_PASSWORD` are correct
- Check if SQL Server authentication is enabled (not just Windows Auth)

### Database Not Found
- Verify the database name in `DB_DATABASE_SHARED` or `DB_DATABASE_TORONTO`
- Ensure the user has permissions to access the database

### SSL/TLS Errors
- If you see certificate errors, ensure `trustServerCertificate: true`
- For production, use proper SSL certificates and set to `false`

## Summary

This project uses the `mssql` npm package to connect to Microsoft SQL Server databases. The connection pattern involves:
1. Defining configuration objects with credentials and options
2. Establishing connections using `sql.connect(config)`
3. Executing queries with `pool.request().query(sql)`
4. Always closing connections in a `finally` block
5. Using environment variables for sensitive credentials

All API routes in the `/app/api` directory follow this pattern for database access.
