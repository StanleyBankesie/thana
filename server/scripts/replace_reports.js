const fs = require('fs');
const path = require('path');

const modules = [
  'sales', 'purchase', 'inventory', 'finance', 'pos', 'business-intelligence', 'service-management'
];

// Mapping from directory name to the actual module name used in featuresRegistry.js
const serverModuleMap = {
  'sales': 'sales',
  'purchase': 'purchase',
  'inventory': 'inventory',
  'finance': 'finance',
  'pos': 'pos',
  'business-intelligence': 'business-intelligence',
  'service-management': 'service-management'
};

const clientRegistryPath = path.join(__dirname, '../../client/src/data/modulesRegistry.js');
const serverRegistryPath = path.join(__dirname, '../data/featuresRegistry.js');

let clientRegistryContent = fs.readFileSync(clientRegistryPath, 'utf8');
let serverRegistryContent = fs.readFileSync(serverRegistryPath, 'utf8');

function camelToTitle(str) {
  let result = str.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1).trim();
}

function generateKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// 1. First, replace the generic "reports" keys module by module.
for (const mod of modules) {
  // Wait, bi directory is business-intelligence?
  let dirMod = mod;
  if (mod === 'bi') dirMod = 'business-intelligence';
  const reportsDir = path.join(__dirname, `../../client/src/pages/modules/${dirMod}/reports`);
  if (!fs.existsSync(reportsDir)) {
    console.log(`No reports dir for ${mod}`);
    continue;
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('ReportPage.jsx'));
  const reportFeatures = [];
  const serverReportFeatures = [];

  for (const file of files) {
    let name = file.replace('Page.jsx', '').replace('.jsx', '');
    let label = camelToTitle(name);
    let key = generateKey(name);

    if (key.includes('sales-reports') || key.includes('inventory-reports')) continue; // Skip generic wrapper if any
    
    reportFeatures.push(`      { key: "${key}", label: "${label}", type: "feature" }`);
    
    const serverMod = serverModuleMap[mod];
    serverReportFeatures.push(`      { feature_key: "${serverMod}:${key}", type: "feature", label: "${label}", path: "/${dirMod}/reports/${key}" }`);
  }

  const serverMod = serverModuleMap[mod];
  const modKey = serverMod === 'business-intelligence' ? 'businessIntelligence' : (mod === 'service-management' ? "'service-management'" : mod);
  
  // Replace in clientRegistry
  const clientRegex = new RegExp(`([ \\t]*\\{[ \\t]*key:[ \\t]*"reports"[ \\t]*,[ \\t]*label:[ \\t]*"[^"]+"[ \\t]*,[ \\t]*type:[ \\t]*"feature"[ \\t]*\\},?)`);
  
  const modSplit = clientRegistryContent.split(new RegExp(`(\\b${modKey}:[ \\t]*\\{)`));
  if (modSplit.length > 2) {
    const before = modSplit[0];
    const match = modSplit[1];
    let after = modSplit[2];
    
    // find next module definition to limit the replacement scope
    const nextModIndex = after.search(/\b[a-zA-Z0-9_'\-]+:[ \t]*\{/);
    if (nextModIndex !== -1) {
      const scope = after.substring(0, nextModIndex);
      const rest = after.substring(nextModIndex);
      const replacedScope = scope.replace(clientRegex, '\\n' + reportFeatures.join(',\\n') + ',');
      after = replacedScope + rest;
    } else {
      after = after.replace(clientRegex, '\\n' + reportFeatures.join(',\\n') + ',');
    }
    clientRegistryContent = before + match + after;
  }

  // Replace in serverRegistry
  const serverRegex = new RegExp(`([ \\t]*\\{[ \\t]*feature_key:[ \\t]*"${serverMod}:reports"[ \\t]*,[ \\t]*type:[ \\t]*"feature"[ \\t]*,[ \\t]*label:[ \\t]*"[^"]+"[ \\t]*,[ \\t]*path:[ \\t]*"[^"]+"[ \\t]*\\},?)`);
  serverRegistryContent = serverRegistryContent.replace(serverRegex, '\\n' + serverReportFeatures.join(',\\n') + ',');
}

// 2. Remove placeholders specified in previous and current tasks
const placeholdersToRemove = [
  'sales-overview',
  'hr-overview',
  'attendance-dashboard',
  'payroll-dashboard',
  'project-overview',
  'resource-utilization',
  'service-overview',
  'billing-analytics',
  'efficiency-report',
  'production-reports'
];

for (const p of placeholdersToRemove) {
  // client regex
  const cRegex = new RegExp(`[ \\t]*\\{[ \\t]*key:[ \\t]*"${p}"[ \\t]*,[ \\t]*label:[ \\t]*"[^"]+"[ \\t]*,[ \\t]*type:[ \\t]*"(dashboard|feature)"[ \\t]*\\},?\\n?`, 'g');
  clientRegistryContent = clientRegistryContent.replace(cRegex, '');
  
  // server regex
  const sRegex = new RegExp(`[ \\t]*\\{[ \\t]*feature_key:[ \\t]*"[a-zA-Z0-9\\-]+:${p}"[ \\t]*,[ \\t]*type:[ \\t]*"(dashboard|feature)"[ \\t]*,[ \\t]*label:[ \\t]*"[^"]+"[ \\t]*,[ \\t]*path:[ \\t]*"[^"]+"[ \\t]*\\},?\\n?`, 'g');
  serverRegistryContent = serverRegistryContent.replace(sRegex, '');
}

fs.writeFileSync(clientRegistryPath, clientRegistryContent, 'utf8');
fs.writeFileSync(serverRegistryPath, serverRegistryContent, 'utf8');

console.log("Registry updated safely.");
