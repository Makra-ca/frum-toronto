import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

// Ensure we're using the dedicated test database branch — never production.
// This guard is the last line of defense: the integration tests run destructive
// cleanup (DELETE of [TEST]% rows), so they must NEVER point at production.
const TEST_DB_ENDPOINT = 'ep-long-band-ahaha6ks';
if (!process.env.DATABASE_URL?.includes(TEST_DB_ENDPOINT)) {
  throw new Error(
    `Tests must use the test database branch (${TEST_DB_ENDPOINT})! Check .env.test`
  );
}

console.log('🧪 Test environment loaded - using test database branch');
