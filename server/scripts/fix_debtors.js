const fs = require('fs');
const file = 'C:/Users/stanl/baseline/client/src/pages/modules/finance/reports/DebtorsLedgerReportPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const filteredAccountsBlock = 
  const filteredAccounts = useMemo(() => {
    // Filter for asset nature accounts (debtors)
    const debtorsAccounts = accounts.filter(
      (a) => String(a.nature || a.group_nature || "").toUpperCase() === "ASSET"
    );
    return filterAndSort(debtorsAccounts, {
      query: accountQuery,
      getKeys: (a) => [a.code, a.name],
    });
  }, [accounts, accountQuery]);
;

// Remove the old block
content = content.replace(filteredAccountsBlock.trim(), '');

// Insert it where it belongs
const targetStr = '  const accountDropdownRef = useRef(null);';
content = content.replace(targetStr, targetStr + '\n\n' + filteredAccountsBlock.trim());

fs.writeFileSync(file, content);
