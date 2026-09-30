import fs from 'fs';

const files = [
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\ContraVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\CreditNoteList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\DebitNoteList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\JournalVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\PaymentVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\PurchaseVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\ReceiptVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\SalesVoucherList.jsx",
  "C:\\Users\\stanl\\baseline\\client\\src\\pages\\modules\\finance\\vouchers\\VoucherListPage.jsx"
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let content = fs.readFileSync(f, 'utf8');
  
  const toReplace = `  function formatVoucherNoDisplay(voucherNo, typeCode) {
    const raw = String(voucherNo || "");
    const code = String(typeCode || "").toUpperCase();

    // Extract numeric part
    const numMatch = raw.match(/(\\d+)$/);
    const num = numMatch ? numMatch[1] : raw.replace(/[^\\d]/g, "");

    if (!num) return raw;

    // Format based on voucher type
    if (code === "PAYV") {
      return \`PV\${String(num).padStart(6, "0")}\`;
    } else if (code === "PV" || code === "PUV") {
      return \`PB\${String(num).padStart(6, "0")}\`;
    }
    return raw;
  }`;

  const replacement = `  function formatVoucherNoDisplay(voucherNo, typeCode) {
    return String(voucherNo || "");
  }`;

  if (content.includes(toReplace)) {
    content = content.replace(toReplace, replacement);
    fs.writeFileSync(f, content);
    console.log("Updated", f);
  } else {
    console.log("Not matched in", f);
  }
}
