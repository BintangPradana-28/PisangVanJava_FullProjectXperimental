const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['components/**/*.{ts,tsx}', 'lib/**/*.ts', 'data/**/*.ts', '!**/*.d.ts'],
})
