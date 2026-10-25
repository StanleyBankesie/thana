import os

p = r"c:\Users\stanl\OneDrive\Documents\Stanness Technologies\thana\server\controllers\maintenance.controller.js"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

target = "sign_off_by VARCHAR(200), status VARCHAR(50) DEFAULT 'DRAFT',"
repl = "sign_off_by VARCHAR(200), sign_off_date DATE NULL, status VARCHAR(50) DEFAULT 'DRAFT',"

target_mig = '["downtime_hours", "DECIMAL(8,2) NULL AFTER end_time"],'
repl_mig = '["downtime_hours", "DECIMAL(8,2) NULL AFTER end_time"],\n    ["sign_off_date", "DATE NULL AFTER sign_off_by"],'

if target in c:
    c = c.replace(target, repl, 1)
    if target_mig in c:
        c = c.replace(target_mig, repl_mig, 1)
    with open(p, "w", encoding="utf-8") as f:
        f.write(c)
    print("Updated maintenance.controller.js successfully!")
else:
    print("Target not found")
