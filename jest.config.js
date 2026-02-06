/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'libs/oauth/src/**/*.ts',
    'libs/control-plane/src/**/*.ts',
    'libs/core/src/**/*.ts',
    'apps/umoja-api/src/**/*.ts',
    '!**/*.module.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '.spec.ts$',
    'index.ts$',
    'main.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/', '<rootDir>/apps/'],
  moduleNameMapper: {
    '^@control-plane/control-plane(|/.*)$': '<rootDir>/libs/control-plane/src/$1',
    '^@core/core(|/.*)$': '<rootDir>/libs/core/src/$1',
    '^@oauth/oauth(|/.*)$': '<rootDir>/libs/oauth/src/$1',
  },
};
