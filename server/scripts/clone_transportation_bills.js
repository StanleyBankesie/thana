const fs = require('fs');
const path = require('path');

function copyAndReplace(src, dest, replacements) {
  let content = fs.readFileSync(src, 'utf8');
  for (const [search, replace] of Object.entries(replacements)) {
    content = content.replace(new RegExp(search, 'g'), replace);
  }
  fs.writeFileSync(dest, content);
}

const dir = path.join(__dirname, 'client/src/pages/modules/transport');
const srcDir = path.join(dir, 'fuel-bills');
const destDir = path.join(dir, 'transportation-bills');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const replacements = {
  'FuelBills': 'TransportationBills',
  'FuelBill': 'TransportationBill',
  'Fuel Bills': 'Transportation Bills',
  'fuel-bills': 'transportation-bills',
  'fuel bills': 'transportation bills',
  'FUEL.BILLS': 'BILLS'
};

copyAndReplace(
  path.join(srcDir, 'FuelBillsList.jsx'),
  path.join(destDir, 'TransportationBillsList.jsx'),
  replacements
);

copyAndReplace(
  path.join(srcDir, 'FuelBillForm.jsx'),
  path.join(destDir, 'TransportationBillForm.jsx'),
  replacements
);

console.log("Transportation Bills frontend files cloned successfully.");
