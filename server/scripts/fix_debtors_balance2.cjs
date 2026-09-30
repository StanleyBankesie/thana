const fs = require('fs');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. table fixed
  content = content.replace('className="table w-full"', 'className="table w-full table-fixed"');
  content = content.replace('className="table"', 'className="table w-full table-fixed"');

  // 2. remove buttons
  const btnBlock = `            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setAsOf("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>`;

  content = content.replace(btnBlock, '');
  
  // also check for duplicate </div> that might have been left over
  content = content.replace('            </div>\n            </div>\n          </div>', '            </div>\n          </div>');

  fs.writeFileSync(filePath, content, 'utf8');
}

updateFile('client/src/pages/modules/sales/reports/DebtorsBalanceReportPage.jsx');
console.log('done');
