import type { Config } from 'jest';

/**
 * Jest Configuration (Centralized)
 *
 * This file is the single source of truth for Jest configuration.
 * DO NOT add jest configuration to package.json - keep it centralized here.
 *
 * Module path mappings MUST be synchronized with tsconfig.json paths.
 * If you add a new alias in tsconfig.json, also add it here.
 */

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>'],

  /**
   * Module name mapper for alias resolution during tests.
   *
   * CRITICAL: Must be synchronized with tsconfig.json "paths" section.
   * Each alias here should have corresponding entry in tsconfig.json.
   *
   * When adding a new module:
   * 1. Add path to tsconfig.json
   * 2. Add moduleNameMapper entry here
   * 3. If using @nestjs DI, ensure import (not import type)
   */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
    '^@tenant/(.*)$': '<rootDir>/tenant/$1',
    '^@auth/(.*)$': '<rootDir>/modules/auth/$1',
    '^@users/(.*)$': '<rootDir>/modules/users/$1',
    '^@payments/(.*)$': '<rootDir>/modules/payments/$1',
    '^@service-requests/(.*)$': '<rootDir>/modules/service-requests/$1',
    '^@geocoding/(.*)$': '<rootDir>/modules/geocoding/$1',
    '^@mail/(.*)$': '<rootDir>/modules/mail/$1',
  },
};

export default config;
