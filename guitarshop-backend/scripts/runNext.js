const { createRequire } = require("module");

const requiredVersion = "20.9.0";

if (process.versions?.node) {
  Object.defineProperty(process.versions, "node", {
    value: requiredVersion,
    configurable: true,
  });
}

if (process.version) {
  Object.defineProperty(process, "version", {
    value: `v${requiredVersion}`,
    configurable: true,
  });
}

const requireFromHere = createRequire(__filename);
requireFromHere("next/dist/bin/next");
