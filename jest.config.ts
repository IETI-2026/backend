import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>'],

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
