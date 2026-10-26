/** Engine, bot and campaign-data Jest config — UI is tested manually for now. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine', '<rootDir>/src/ai', '<rootDir>/src/campaign', '<rootDir>/src/achievements', '<rootDir>/src/store'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-native', esModuleInterop: true, strict: true, target: 'ES2020', moduleResolution: 'node', resolveJsonModule: true } }],
  },
};
