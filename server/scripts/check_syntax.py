import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"
error_files = []

# Pattern to find places where the toggle was injected right after a return or ternary
pattern = re.compile(r'(return\s*\(\s*|\)\s*:\s*\(\s*)<div className="flex justify-end mb-4">')

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith("List.jsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            if pattern.search(content):
                error_files.append(file)
                # Let's fix it right here by wrapping in <> </>
                # We need to find the matching closing parenthesis for the return/ternary!
                # Actually, simpler: replace the start with ( <> <div... 
                # AND we must also append </> before the matching ). This is hard with regex.

print("Files with syntax errors:", error_files)
