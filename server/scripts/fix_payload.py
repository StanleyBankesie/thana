import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"

def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # If the file defines forwardComments
    if "forwardComments" in content:
        # Match api.post with submit or workflows/start, until the closing bracket } of the payload
        # Find all api.post(/workflows/start or /submit blocks that don't have comments:
        pattern = re.compile(r'(api\.post\([^\)]*(?:/submit|/workflows/start)[^\)]*,\s*\{)([^}]+)(\})', re.MULTILINE)
        
        def repl(m):
            prefix = m.group(1)
            body = m.group(2)
            suffix = m.group(3)
            if "comments:" not in body:
                return prefix + body + "  comments: forwardComments,\n        " + suffix
            return m.group(0)

        new_content = pattern.sub(repl, content)
        
        if new_content != content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed {os.path.basename(path)}")

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".jsx"):
            fix_file(os.path.join(root, file))

