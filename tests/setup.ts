import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

// Ensure we're using test database
if (!process.env.DATABASE_URL?.includes('ep-super-bonus')) {
  throw new Error('Tests must use test database branch! Check .env.test');
}

console.log('🧪 Test environment loaded - using test database branch');
