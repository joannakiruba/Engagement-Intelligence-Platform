/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  setupFiles: ["./tests/setup.js"],
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "@swc/jest",
  },
};
