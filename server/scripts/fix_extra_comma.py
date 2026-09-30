import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".jsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            # Fix the extraneous comma at the start of the line
            new_content = re.sub(r'\n,\s*comments: forwardComments,', '\n        comments: forwardComments,', content)
            
            # Wait, also some might be \n  ,      comments or similar. Let's just catch \n\s*,\s*comments: forwardComments,
            new_content = re.sub(r'\n\s*,\s*comments: forwardComments,', '\n        comments: forwardComments,', new_content)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed extra comma in {file}")
