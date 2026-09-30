const fs = require('fs');

function updateFile(filePath, isTracking) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. useEffect dependency
  if (isTracking) {
    content = content.replace('useEffect(() => {\n    run();\n  }, []);', 'useEffect(() => {\n    run();\n  }, [from, to, customerId]);');
  } else {
    content = content.replace('useEffect(() => {\n    run();\n  }, []);', 'useEffect(() => {\n    run();\n  }, [from, to]);');
  }

  // 2. table fixed
  content = content.replace('className="table"', 'className="table w-full table-fixed"');

  // 3. remove buttons
  const btnBlockTracking = `            <div className="flex items-end gap-2">
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
                  setFrom("");
                  setTo("");
                  setCustomerId("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>`;

  const btnBlockProfit = `            <div className="flex items-end gap-2">
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
                  setFrom("");
                  setTo("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>`;

  content = content.replace(isTracking ? btnBlockTracking : btnBlockProfit, '');
  fs.writeFileSync(filePath, content, 'utf8');
}

updateFile('client/src/pages/modules/sales/reports/SalesTrackingReportPage.jsx', true);
updateFile('client/src/pages/modules/sales/reports/SalesProfitabilityReportPage.jsx', false);
console.log('done');
