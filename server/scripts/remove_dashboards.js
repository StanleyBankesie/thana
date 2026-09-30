const fs = require('fs');
const path = require('path');

function removeDashboardsFromFile(filePath, isServer) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // We can just use regex to remove any line that looks like a feature or dashboard with 'dashboard' in it.
  // Example: { key: "dashboard", label: "Administration Dashboard", type: "dashboard" }
  // Or empty all dashboards arrays:
  // We can parse the file or do string replacement. Since it's JS, maybe regex is easier.
  
  // Remove lines like: { key: "...", label: "...Dashboard...", type: "..." },
  const dashboardRegex = /^[ \t]*\{[ \t]*key:[ \t]*"[^"]+"[ \t]*,[ \t]*label:[ \t]*"[^"]*Dashboard[^"]*"[ \t]*,[ \t]*type:[ \t]*"[^"]+"[ \t]*\},?\s*$/gim;
  content = content.replace(dashboardRegex, '');
  
  // Also remove { key: "dashboards", label: "Dashboard Management", type: "feature" },
  // Wait, let's just match any label with "Dashboard" case-insensitive
  
  fs.writeFileSync(filePath, content);
  console.log(`Removed dashboards from ${filePath}`);
}

const clientFile = path.join(__dirname, '../../client/src/data/modulesRegistry.js');
const serverFile = path.join(__dirname, '../../server/data/featuresRegistry.js');

removeDashboardsFromFile(clientFile, false);
removeDashboardsFromFile(serverFile, true);
