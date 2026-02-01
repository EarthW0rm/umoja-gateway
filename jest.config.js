/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['libs/oauth/src/**/*.ts'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '.spec.ts$',
    'index.ts$',
    'oauth.module.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/', '<rootDir>/apps/'],
  moduleNameMapper: {
    '^@core/core(|/.*)$': '<rootDir>/libs/core/src/$1',
    '^@oauth/oauth(|/.*)$': '<rootDir>/libs/oauth/src/$1',
  },
};
