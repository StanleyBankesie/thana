const fs = require('fs');

function fixFile(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /onClick=\{.*?\}\s*(className=.*?)\s*>\s*Back to Menu/g,
      'onClick={() => navigate(\'/administration\')} >Back to Menu'
    );
    // If navigate is not in scope we can use window.location.href or just ensure navigate is imported. 
    // They usually use navigate.
    content = content.replace(
      /onClick=\{.*?\}\s*className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded shadow-sm transition"\s*>\s*Back to Menu/g,
      'onClick={() => navigate(\'/administration\')} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded shadow-sm transition">Back to Menu'
    );
    fs.writeFileSync(file, content);
  }
}

fixFile('./client/src/pages/admin/LicenseManagement.jsx');
fixFile('./client/src/pages/admin/PaymentPackages.jsx');
