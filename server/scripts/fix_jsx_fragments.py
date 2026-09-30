import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"
error_files = ['ExceptionalPermissionsList.jsx', 'ContraVoucherList.jsx', 'CreditNoteList.jsx', 'DebitNoteList.jsx', 'JournalVoucherList.jsx', 'PaymentVoucherList.jsx', 'PurchaseVoucherList.jsx', 'ReceiptVoucherList.jsx', 'SalesVoucherList.jsx', 'EmployeeList.jsx', 'PurchaseReturnList.jsx', 'DirectPurchaseList.jsx', 'DeliveryList.jsx', 'QuotationList.jsx', 'SalesReturnList.jsx', 'ServiceExecutionsList.jsx', 'ServiceInvoiceList.jsx', 'ExpenseLogList.jsx', 'TransportExpenseList.jsx', 'TransportIncomeList.jsx']

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find where the injection happened right after `) : (` or `return (`
    pattern = re.compile(r'(\)\s*:\s*\(\s*|return\s*\(\s*)\n*\s*<div className="flex justify-end mb-4">')
    match = pattern.search(content)
    if not match:
        return False

    start_idx = match.end(1) # The end of `) : (`
    
    # We need to find the matching `)` for the `(` that opened at `start_idx - 1`
    open_paren_idx = content.rfind('(', 0, start_idx)
    
    stack = 1
    end_idx = -1
    for i in range(open_paren_idx + 1, len(content)):
        if content[i] == '(':
            stack += 1
        elif content[i] == ')':
            stack -= 1
            if stack == 0:
                end_idx = i
                break
                
    if end_idx != -1:
        new_content = content[:start_idx] + "<>\n" + content[start_idx:end_idx] + "\n</>\n" + content[end_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

count = 0
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file in error_files:
            if fix_file(os.path.join(root, file)):
                count += 1
                print(f"Fixed {file}")

print(f"Total fixed: {count}")
