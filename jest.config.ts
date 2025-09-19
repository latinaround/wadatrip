import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs', '<rootDir>/services'],
  moduleNameMapper: {
    '^@wadatrip/common(.*)$': '<rootDir>/libs/common/src$1',
    '^@wadatrip/connectors$': '<rootDir>/libs/connectors/src/index.ts',
    '^@wadatrip/connectors/(.*)$': '<rootDir>/libs/connectors/src/$1',
    '^@wadatrip/pricing(.*)$': '<rootDir>/libs/pricing/src$1',
    '^@wadatrip/db(.*)$': '<rootDir>/libs/db$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  setupFiles: ['dotenv/config'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.base.json',
    },
  },
};

export default config;

