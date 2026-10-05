export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  // Jest's ESM support is experimental (hence --experimental-vm-modules in
  // package.json's test script) - this project uses native ESM throughout
  // rather than transpiling, so there is no babel/ts-jest transform step.
};
