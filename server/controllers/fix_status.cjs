const fs = require('fs');
let code = fs.readFileSync('finance.controller.js', 'utf8');

// Replace status logic in transportation bills
code = code.replace(
  /payment_status = CASE([^]*?)ELSE COALESCE\(payment_status, 'UNPAID'\)\s*END/g,
  (match, p1) => {
    return match + ",\n                  status = CASE" + p1 + "ELSE COALESCE(status, 'PENDING')\n                  END";
  }
);

fs.writeFileSync('finance.controller.js', code);
