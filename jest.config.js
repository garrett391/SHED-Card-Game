/** Engine, bot, campaign-data and table-logic Jest config — screens are tested manually for now. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine', '<rootDir>/src/ai', '<rootDir>/src/campaign', '<rootDir>/src/achievements', '<rootDir>/src/store', '<rootDir>/src/table'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '@react-native-async-storage/async-storage/jest/async-storage-mock',
    // Character portraits are require()d PNGs; tests only need a placeholder.
    '\\.(png|jpe?g)$': '<rootDir>/src/testing/imageStub.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-native', esModuleInterop: true, strict: true, target: 'ES2020', moduleResolution: 'node', resolveJsonModule: true } }],
  },
};
