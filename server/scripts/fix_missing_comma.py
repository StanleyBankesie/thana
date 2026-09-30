import os
import re

base_dir = r"C:\Users\stanl\baseline\client\src\pages\modules"

pattern = re.compile(r'([^,{;\[\]\(\)])(\s+)comments:\s+forwardComments,')

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".jsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = pattern.sub(r'\1,\2comments: forwardComments,', content)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed missing comma in {file}")
