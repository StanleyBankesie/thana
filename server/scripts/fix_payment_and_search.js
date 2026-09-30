import fs from 'fs';

let content = fs.readFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', 'utf8');

// 1. Fix the search clearing logic. 
// Old: onClick={() => { setForm({...form, supplier_id: s.id, supplier_name: s.supplier_name}); setSupplierSearch(""); }}
// New: onClick={() => { setForm({...form, supplier_id: s.id, supplier_name: s.supplier_name}); setSupplierSearch(s.supplier_name); }}
content = content.replace(
  /setSupplierSearch\(""\)/g,
  `setSupplierSearch(s.supplier_name)`
);

// 2. Add filtering to the Payment Source (PV) select
const oldPaymentSourceBlock = `{accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}`;

const newPaymentSourceBlock = `{accounts.filter(a => {
                      const gc = String(a.group_code || "").toUpperCase();
                      const gn = String(a.group_name || "").toUpperCase();
                      const isChequeLike = ['Cheque', 'Bank Transfer', 'Credit Card'].includes(form.payment_method);
                      return isChequeLike ? (gc === "AST_BANK" || gn === "BANK ACCOUNTS") : (gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS");
                    }).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}`;

if (content.includes(oldPaymentSourceBlock)) {
  content = content.replace(oldPaymentSourceBlock, newPaymentSourceBlock);
} else {
  console.error("Could not find Payment Source options to replace");
}

fs.writeFileSync('client/src/pages/modules/transport/expenses/TransportExpenseList.jsx', content);
console.log("Updated TransportExpenseList.jsx with Payment Account filter and Supplier search logic");
