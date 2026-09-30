import os
import re

directory = "server/controllers"

for filename in os.listdir(directory):
    if not filename.endswith(".js"):
        continue
        
    filepath = os.path.join(directory, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    pattern = r'((?:export\s+)?(?:async\s+)?function\s+ensure[A-Za-z0-9_]*\s*\([^)]*\)\s*\{)'
    replacement = r'\1\n  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === \'true\') return;'
    
    new_content = re.sub(pattern, replacement, content)
    
    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Patched {filename}")
