/** Engine-only Jest config — UI is tested manually for now. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-native', esModuleInterop: true, strict: true, target: 'ES2020', moduleResolution: 'node' } }],
  },
};
