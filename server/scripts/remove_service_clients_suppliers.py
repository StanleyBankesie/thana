import os

setup_path = os.path.join('client', 'src', 'pages', 'modules', 'service-management', 'setup', 'ServiceParametersPage.jsx')

with open(setup_path, 'r', encoding='utf8') as f:
    lines = f.read().split('\n')

start_state = -1
end_state = -1

for i, line in enumerate(lines):
    if 'const [suppliers, setSuppliers] = useState' in line and start_state == -1:
        start_state = i
    if start_state != -1 and 'const deleteClient = async (id) => {' in line:
        for j in range(i, len(lines)):
            if '} catch (e) { toast.error(e?.response?.data?.message || "Failed to delete client"); }' in lines[j]:
                end_state = j + 2
                break
        break

start_jsx = -1
end_jsx = -1

for i, line in enumerate(lines):
    if '{activeTab === "suppliers" && (' in line and start_jsx == -1:
        start_jsx = i
    if start_jsx != -1 and '{activeTab !== "clients" && activeTab !== "suppliers" && (' in line:
        end_jsx = i
        break

if start_state != -1 and end_state != -1 and start_jsx != -1 and end_jsx != -1:
    new_lines = lines[:start_state] + lines[end_state:start_jsx] + ['      {/* Deleted clients and suppliers sections */}'] + lines[end_jsx:]
    
    with open(setup_path, 'w', encoding='utf8') as f:
        f.write('\n'.join(new_lines).replace('{activeTab !== "clients" && activeTab !== "suppliers" && (', '{true && ('))
    print(f"Cleaned up successfully. Removed state from {start_state} to {end_state} and JSX from {start_jsx} to {end_jsx}")
else:
    print(f"Failed to find blocks: state({start_state},{end_state}) jsx({start_jsx},{end_jsx})")

