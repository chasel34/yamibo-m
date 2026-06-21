module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)', '**/?(*.)+(test|spec).(ts|tsx|js)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
