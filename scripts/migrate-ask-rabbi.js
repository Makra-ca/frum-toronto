// Migration script: Ask the Rabbi from MSSQL to Neon PostgreSQL
// READ from MSSQL (FrumShared.BlogEntries), WRITE to Neon (ask_the_rabbi)

const sql = require('mssql');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const mssqlConfig = {
  user: 'frumto',
  password: '201518',
  server: '216.105.90.65',
  port: 1433,
  database: 'FrumShared',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
  }
};

// Convert Excel serial date to JavaScript Date
function excelToDate(serial) {
  if (!serial) return null;
  return new Date((serial - 25569) * 86400 * 1000);
}

// Extract question number from title like "#5699 - Some Title"
function extractQuestionNumber(title) {
  if (!title) return null;
  const match = title.match(/#(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Parse Q&A from combined text
// Format is typically: "Q. question text<br /><br />A. answer text"
function parseQandA(text) {
  if (!text) return { question: null, answer: null };

  // Clean up HTML
  let cleaned = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#8203;/g, '') // zero-width space
    .replace(/&#45;/g, '-')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, '') // remove remaining HTML tags
    .trim();

  // Try to split on "A." or "A:" patterns
  // Common patterns: "Q. ... A. ...", "- Q. ... A. ...", etc.

  // Find the answer marker
  const answerPatterns = [
    /\n\s*A\.\s*/i,
    /\n\s*A:\s*/i,
    /\n\s*Answer:\s*/i,
  ];

  let question = cleaned;
  let answer = null;

  for (const pattern of answerPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const parts = cleaned.split(pattern);
      if (parts.length >= 2) {
        question = parts[0].replace(/^[\s\-]*Q[\.\:]\s*/i, '').trim();
        answer = parts.slice(1).join('\n').trim();
        break;
      }
    }
  }

  // If no answer found, try another approach
  if (!answer) {
    // Sometimes the whole text is just the question with answer inline
    question = cleaned.replace(/^[\s\-]*Q[\.\:]\s*/i, '').trim();
  }

  return { question, answer };
}

async function migrate() {
  const neonSql = neon(process.env.DATABASE_URL);

  try {
    await sql.connect(mssqlConfig);
    console.log('Connected to MSSQL (FrumShared)\n');

    // Get Ask the Rabbi entries (CategoryID = 98)
    console.log('=== Fetching Ask the Rabbi Entries ===');
    const entries = await sql.query`
      SELECT BlogEntryID, BlogEntryTitle, BlogEntryText, BlogEntryDate, Active
      FROM BlogEntries
      WHERE BlogCategoryID = 98 AND Active = 1
      ORDER BY BlogEntryID
    `;

    console.log(`Found ${entries.recordset.length} entries to migrate\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of entries.recordset) {
      const questionNumber = extractQuestionNumber(entry.BlogEntryTitle);
      const { question, answer } = parseQandA(entry.BlogEntryText);
      const publishedAt = excelToDate(entry.BlogEntryDate);

      // Skip if no question text
      if (!question || question.length < 10) {
        skipped++;
        continue;
      }

      // Check if already exists
      const existing = await neonSql`
        SELECT id FROM ask_the_rabbi WHERE old_blog_entry_id = ${entry.BlogEntryID}
      `;

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      try {
        await neonSql`
          INSERT INTO ask_the_rabbi (
            question_number, title, question, answer,
            answered_by, is_published, published_at, old_blog_entry_id
          ) VALUES (
            ${questionNumber},
            ${entry.BlogEntryTitle || 'Untitled'},
            ${question},
            ${answer},
            ${"Hagaon Rav Shlomo Miller Shlit'a"},
            true,
            ${publishedAt},
            ${entry.BlogEntryID}
          )
        `;
        migrated++;

        if (migrated % 500 === 0) {
          console.log(`  Migrated ${migrated} entries...`);
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error migrating ID ${entry.BlogEntryID}: ${err.message}`);
        }
      }
    }

    console.log(`\n=== Migration Complete ===`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);

    // Verify
    const count = await neonSql`SELECT COUNT(*) as total FROM ask_the_rabbi`;
    console.log(`\n  Total in ask_the_rabbi table: ${count[0].total}`);

    await sql.close();
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
