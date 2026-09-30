import fs from 'fs';

// 1. Update TransportSettings.jsx
const settingsPath = 'client/src/pages/modules/transport/settings/TransportSettings.jsx';
let settingsContent = fs.readFileSync(settingsPath, 'utf8');

if (!settingsContent.includes('transport_expense_types')) {
  // Add state
  settingsContent = settingsContent.replace(
    /const \[vehicleTypes, setVehicleTypes\] = useState\([\s\S]*?\);/,
    `$&
  const [expenseTypes, setExpenseTypes] = useState(
    localStorage.getItem("transport_expense_types") || "FUEL, MAINTENANCE, TOLL, PARKING, OTHER"
  );`
  );

  // Add save logic
  settingsContent = settingsContent.replace(
    /localStorage\.setItem\("transport_vehicle_types", vehicleTypes\);/,
    `$&
    localStorage.setItem("transport_expense_types", expenseTypes);`
  );

  // Add UI
  const expenseTypeUI = `
          <div className="form-control mt-4">
            <label className="label">
              <span className="label-text font-semibold">Expense Types</span>
              <span className="label-text-alt text-slate-500">Comma separated list</span>
            </label>
            <textarea 
              className="textarea textarea-bordered h-24"
              value={expenseTypes}
              onChange={(e) => setExpenseTypes(e.target.value)}
              placeholder="e.g. FUEL, MAINTENANCE, TOLL"
            ></textarea>
          </div>
`;
  settingsContent = settingsContent.replace(
    /<\/textarea>\s*<\/div>\s*<\/div>\s*<\/div>/,
    `</textarea>
          </div>${expenseTypeUI}        </div>
      </div>`
  );

  fs.writeFileSync(settingsPath, settingsContent);
  console.log("Updated TransportSettings.jsx");
}

// 2. Update perms.json
const permsPath = 'server/perms.json';
let permsContent = JSON.parse(fs.readFileSync(permsPath, 'utf8'));

const newPerms = ["TRANSPORT.FUEL_EXPENSES.VIEW", "TRANSPORT.FUEL_EXPENSES.CREATE"];
newPerms.forEach(p => {
  if (!permsContent.includes(p)) {
    permsContent.push(p);
  }
});
permsContent.sort();

fs.writeFileSync(permsPath, JSON.stringify(permsContent));
console.log("Updated perms.json");
