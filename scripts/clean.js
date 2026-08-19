const fs = require("node:fs");
const path = require("node:path");

const outDirectory = path.resolve(__dirname, "..", "out");
fs.rmSync(outDirectory, { recursive: true, force: true });
