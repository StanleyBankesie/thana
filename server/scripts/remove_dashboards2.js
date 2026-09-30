const fs = require('fs');
const path = require('path');

function removeDashboardsFromFile(filePath) {
  let lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // If the line contains 'label:' and 'Dashboard' and 'key:', we skip it.
    if (line.match(/key:.*label:.*Dashboard/i)) {
      continue;
    }
    // Also skip things like 'Dashboard Permissions' which is a feature
    // Wait, the user said "remove all pages with dashboard attached"
    // So yes, remove 'Dashboard Permissions' feature too? 
    // They said "remove all pages with dashboard attached" from role setup page.
    newLines.push(line);
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'));
  console.log(`Cleaned ${filePath}`);
}

const clientFile = path.join(__dirname, '../../client/src/data/modulesRegistry.js');
const serverFile = path.join(__dirname, '../../server/data/featuresRegistry.js');

removeDashboardsFromFile(clientFile);
removeDashboardsFromFile(serverFile);
