const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith(".jsx")) {
      results.push(full);
    }
  });
  return results;
}

const lucideIcons = [
  "ArrowLeft", "ArrowRight", "ChevronLeft", "ChevronRight", "ChevronDown", "ChevronUp",
  "Plus", "Minus", "Trash2", "Pencil", "Edit", "Search", "Filter", "Download",
  "Upload", "Printer", "FileText", "Check", "CheckCircle", "CheckCircle2",
  "AlertCircle", "AlertTriangle", "Clock", "Calendar", "DollarSign", "Activity",
  "Briefcase", "Folder", "Eye", "X", "Loader2", "Save", "RefreshCw", "User", "Users",
  "Layers", "TrendingUp", "TrendingDown", "Paperclip", "Building2", "HardHat", "Wrench", "Package"
];

const files = walk("client/src/pages/modules/project-management");
const missingByFile = {};

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const rel = path.relative(".", f).replace(/\\/g, "/");
  
  // Find all used icon tags: e.g. <ArrowLeft
  lucideIcons.forEach(icon => {
    const tagRegex = new RegExp(`<${icon}\\b`);
    if (tagRegex.test(content)) {
      // Check if imported
      const importRegex = new RegExp(`\\b${icon}\\b.*from\\s+["\']lucide-react["\']|from\\s+["\']lucide-react["\'].*\\b${icon}\\b`);
      const anyImportRegex = new RegExp(`\\b${icon}\\b`);
      // Simpler check: check if file has `import ... icon ... from "lucide-react"`
      const lucideImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/);
      let isImported = false;
      if (lucideImportMatch) {
        const importedIcons = lucideImportMatch[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]);
        if (importedIcons.includes(icon)) {
          isImported = true;
        }
      }
      // Also check multiple lucide imports if any
      const allLucideImports = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g)];
      for (const m of allLucideImports) {
        const icons = m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0]);
        if (icons.includes(icon)) isImported = true;
      }

      if (!isImported) {
        if (!missingByFile[rel]) missingByFile[rel] = [];
        missingByFile[rel].push(icon);
      }
    }
  });
});

console.log(JSON.stringify(missingByFile, null, 2));
