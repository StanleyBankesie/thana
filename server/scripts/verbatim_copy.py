import os

setup_path = os.path.join('client', 'src', 'pages', 'modules', 'project-management', 'setup', 'Setup.jsx')
service_path = os.path.join('client', 'src', 'pages', 'modules', 'service-management', 'setup', 'ServiceParametersPage.jsx')

# Read Setup.jsx
with open(setup_path, 'r', encoding='utf8') as f:
    setup_lines = f.read().split('\n')

# Read ServiceParametersPage.jsx
with open(service_path, 'r', encoding='utf8') as f:
    service_lines = f.read().split('\n')

# 1. Extract State & Functions from Setup.jsx
state_start = -1
state_end = -1
for i, line in enumerate(setup_lines):
    if 'const [suppliers, setSuppliers] = useState([]);' in line and state_start == -1:
        state_start = i
    if state_start != -1 and 'const deleteClient = async (id) => {' in line:
        for j in range(i, len(setup_lines)):
            if '} catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }' in setup_lines[j]:
                state_end = j + 2
                break
        break

state_block = "\n".join(setup_lines[state_start:state_end])

# 2. Extract JSX from Setup.jsx
jsx_start = -1
jsx_end = -1
for i, line in enumerate(setup_lines):
    if '{activeTab === "suppliers" && (' in line and jsx_start == -1:
        jsx_start = i
    if jsx_start != -1 and 'const TABS = [' in line:
        # TABS is on line 408 in Setup.jsx, so the jsx_end would be just before that
        # But wait, in Setup.jsx, the JSX is from line 602 to 892. 
        pass

for i, line in enumerate(setup_lines):
    if '{activeTab === "suppliers" && (' in line:
        jsx_start = i
    if '{activeTab === "clients" && (' in line:
        for j in range(i, len(setup_lines)):
            if '</ModalForm>' in setup_lines[j]:
                # find the matching closing tag block for clients
                # Just find the 2nd </ModalForm> after clients
                # But to be exact, in Setup.jsx, clients block ends around line 892 before `</div>`
                if '        </>' in setup_lines[j+1] and '      )}' in setup_lines[j+2]:
                    jsx_end = j + 3
                    break

jsx_block = "\n".join(setup_lines[jsx_start:jsx_end])

# 3. Replace in ServiceParametersPage.jsx
s_state_start = -1
s_state_end = -1
for i, line in enumerate(service_lines):
    if 'const [suppliers, setSuppliers] = useState([]);' in line and s_state_start == -1:
        s_state_start = i
    if s_state_start != -1 and 'const deleteClient = async (id) => {' in line:
        for j in range(i, len(service_lines)):
            if '} catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }' in service_lines[j]:
                s_state_end = j + 2
                break
        break

s_jsx_start = -1
s_jsx_end = -1
for i, line in enumerate(service_lines):
    if '{activeTab === "suppliers" && (' in line and s_jsx_start == -1:
        s_jsx_start = i
    if s_jsx_start != -1 and '{activeTab !== "clients" && activeTab !== "suppliers" && (' in line:
        s_jsx_end = i
        break

# Also replace React import
for i, line in enumerate(service_lines):
    if 'import React, { useEffect, useState } from "react";' in line:
        service_lines[i] = 'import React, { useEffect, useState, useCallback, useMemo } from "react";'

if s_state_start != -1 and s_state_end != -1 and s_jsx_start != -1 and s_jsx_end != -1:
    new_lines = service_lines[:s_state_start] + [state_block] + service_lines[s_state_end:s_jsx_start] + [jsx_block] + service_lines[s_jsx_end:]
    with open(service_path, 'w', encoding='utf8') as f:
        f.write('\n'.join(new_lines))
    print("Verbatim replacement successful!")
else:
    print(f"Failed to find blocks in ServiceParametersPage.jsx: state({s_state_start},{s_state_end}) jsx({s_jsx_start},{s_jsx_end})")
