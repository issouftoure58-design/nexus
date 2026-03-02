/**
 * Jest Configuration for NEXUS Backend
 */

export default {
  // Use ESM modules
  testEnvironment: 'node',
  transform: {},

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],

  // Exclude integration tests that need a running server
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/tenant-isolation.test.js'
  ],

  // Module paths
  moduleFileExtensions: ['js', 'json'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage settings
  collectCoverageFrom: [
    'src/services/**/*.js',
    'src/utils/**/*.js',
    'src/middleware/**/*.js',
    'src/queues/**/*.js',
    '!src/**/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      statements: 5,
      branches: 3,
      functions: 5,
      lines: 5
    }
  },

  // Timeouts
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true
};
