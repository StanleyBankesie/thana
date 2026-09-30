import os
import re

files = [
    r"C:\Users\stanl\baseline\client\src\pages\modules\sales\invoices\InvoiceList.jsx",
    r"C:\Users\stanl\baseline\client\src\pages\modules\service-management\service-invoices\ServiceInvoiceList.jsx",
    r"C:\Users\stanl\baseline\client\src\pages\modules\transport\billing\BillingList.jsx"
]

for path in files:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "REVERSED:" not in content and "statusClasses =" in content:
        content = content.replace('PENDING_APPROVAL: "badge badge-warning",', 'PENDING_APPROVAL: "badge badge-warning",\n      REVERSED: "badge badge-warning",')
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {os.path.basename(path)}")
