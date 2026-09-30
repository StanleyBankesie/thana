import sys

with open('patch.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\\`', '`')

with open('patch.js', 'w', encoding='utf-8') as f:
    f.write(text)
