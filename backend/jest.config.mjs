export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  // The suite is authored in ESM (package "type": "module"). Jest's default
  // babel-jest transform cannot parse native ESM import statements unless
  // the source file is treated as ESM — bake mode uses NODE_OPTIONS to
  // extend this default. Passing no options keeps plain `npx jest` working.
};
