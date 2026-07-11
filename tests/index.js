// Test entry point. Requires every *.test.js suite, then runs them.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./harness');

const dir = __dirname;
for (const file of fs.readdirSync(dir)) {
  if (file.endsWith('.test.js')) {
    require(path.join(dir, file));
  }
}

run();
