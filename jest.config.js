module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
  // Separate test configurations
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/__tests__/*.test.ts'],
      globals: {
        'ts-jest': {
          tsconfig: './tsconfig.test.json',
        },
      },
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/integration-tests/**/*.integration.test.ts', '<rootDir>/tests/**/*.integration.test.ts'],
      testTimeout: 30000,
      setupFiles: ['dotenv/config'],
      globals: {
        'ts-jest': {
          tsconfig: './tsconfig.test.json',
        },
      },
    },
  ],
};
