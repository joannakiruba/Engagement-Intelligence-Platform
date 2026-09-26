// Provide default env vars so config/index.ts doesn't throw during import.
// These are test-only defaults — a real DATABASE_URL enables integration tests.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_skip';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
if (!process.env.TOKEN_HASH_SECRET) process.env.TOKEN_HASH_SECRET = 'test-token-hash-secret';
