const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve(__dirname, "../src/skill/SKILL.md");
const dest = path.resolve(__dirname, "../dist/skill/SKILL.md");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
