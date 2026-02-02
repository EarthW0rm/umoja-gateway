/**
 * Ensures NODE_ENV is 'test' before any e2e spec is loaded,
 * so AuthModelModule selects the in-memory repository.
 */
process.env.NODE_ENV = 'test';
