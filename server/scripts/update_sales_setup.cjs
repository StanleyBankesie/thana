const fs = require('fs');
const path = 'client/src/pages/modules/sales/setup/SalesSetupPage.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('{["zones", "reasons", "price-types"].map((tab) => (', '{["zones", "reasons", "price-types", "salespersons"].map((tab) => (');

content = content.replace('if (activeTab === "zones") endpoint = "/sales/zones";', 'if (activeTab === "zones") endpoint = "/sales/zones";\n      if (activeTab === "salespersons") endpoint = "/sales/sales-persons";');
content = content.replace('if (activeTab === "zones") endpoint = "/sales/zones";', 'if (activeTab === "zones") endpoint = "/sales/zones";\n      if (activeTab === "salespersons") endpoint = "/sales/sales-persons";');

content = content.replace('if (activeTab === "zones") {', 'if (activeTab === "salespersons") {\n        payload = { salespersons: updatedItems };\n      } else if (activeTab === "zones") {');

content = content.replace('{activeTab === "zones" && (', '{activeTab === "salespersons" && (\n                  <>\n                    <div>\n                      <label className="label">Name</label>\n                      <input type="text" className="input" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />\n                    </div>\n                    <div>\n                      <label className="label">Email</label>\n                      <input type="email" className="input" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />\n                    </div>\n                  </>\n                )}\n                {activeTab === "zones" && (');

content = content.replace('{activeTab === "zones" && (', '{activeTab === "salespersons" && (\n                        <>\n                          <th>Name</th>\n                          <th>Email</th>\n                        </>\n                      )}\n                      {activeTab === "zones" && (');

content = content.replace('{activeTab === "zones" && (', '{activeTab === "salespersons" && (\n                          <>\n                            <td className="font-medium">{item.name}</td>\n                            <td className="text-slate-500">{item.email}</td>\n                          </>\n                        )}\n                        {activeTab === "zones" && (');

fs.writeFileSync(path, content, 'utf8');
console.log('SalesSetupPage updated successfully.');
