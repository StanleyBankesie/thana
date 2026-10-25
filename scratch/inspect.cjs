const fs = require("fs");
const file = process.argv[2];
const term = process.argv[3];
if (!file) process.exit(1);
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
lines.forEach((l, i) => {
  if (!term || l.toLowerCase().includes(term.toLowerCase())) {
    console.log(`${i+1}: ${l}`);
  }
});
