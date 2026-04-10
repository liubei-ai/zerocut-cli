const fs = require("node:fs");
const path = require("node:path");

const srcDir = path.resolve(__dirname, "../src/skill");
const distDir = path.resolve(__dirname, "../dist/skill");

fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(srcDir, distDir, { recursive: true });
