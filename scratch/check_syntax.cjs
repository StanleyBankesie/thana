const esbuild = require('../client/node_modules/esbuild');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'client', 'src', 'pages', 'modules', 'project-management');

function checkDir(d) {
  const items = fs.readdirSync(d, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(d, item.name);
    if (item.isDirectory()) {
      checkDir(full);
    } else if (item.name.endsWith('.jsx')) {
      const code = fs.readFileSync(full, 'utf8');
      try {
        esbuild.transformSync(code, { loader: 'jsx' });
        console.log('PASS:', path.relative(dir, full));
      } catch (err) {
        console.error('FAIL:', path.relative(dir, full), err.message);
        process.exitCode = 1;
      }
    }
  }
}

checkDir(dir);
console.log('All syntax checks completed.');
