import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"
pattern = re.compile(r"(\w+)\.forwarded_to_username \? \(")

files_fixed = 0
for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".jsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if pattern.search(content):
                # Only replace if not already fixed
                if "&& ![\"RETURNED\"" not in content:
                    new_content = pattern.sub(r'\1.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(\1.status || "").toUpperCase()) ? (', content)
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    files_fixed += 1
                    print(f"Fixed {file}")

print(f"Total files fixed: {files_fixed}")
