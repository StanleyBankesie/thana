const fs = require('fs');
const path = require('path');

const clientRegistryPath = path.join(__dirname, '../../client/src/data/modulesRegistry.js');
const serverRegistryPath = path.join(__dirname, '../data/featuresRegistry.js');

let c = fs.readFileSync(clientRegistryPath, 'utf8');
c = c.replace(/\\n/g, '\n');
fs.writeFileSync(clientRegistryPath, c, 'utf8');

let s = fs.readFileSync(serverRegistryPath, 'utf8');
s = s.replace(/\\n/g, '\n');
fs.writeFileSync(serverRegistryPath, s, 'utf8');

console.log("Fixed newlines");
