import re

with open('MaintenanceRequestsList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update headers
content = content.replace('<th>Created Date</th>\n                  <th className="text-right">Actions</th>', '<th>Created Date</th>\n                  <th>Approval</th>\n                  <th className="text-right">Actions</th>')
content = content.replace('colSpan="8"', 'colSpan="9"')

# 2. Extract approval slot
# The structure is:
#                           <div className="min-w-[160px]">
#                             <div className="list-approval-slot">
#                               ...
#                             </div>
#                           </div>
#                         </div>
#                       </td>

# Let's find the entire <div className="min-w-[160px]">...</div> inside the Actions td, remove it, and prepend it as a new td before the Actions td.

# Using a regex to find the td containing actions
td_pattern = re.compile(r'(<td className="px-6 py-4 text-right">.*?)(<div className="min-w-\[160px\]">.*?</div>\s*</div>\s*</div>\s*</td>)', re.DOTALL)

# Wait, this regex is prone to error.
# Let's just do a string split since the file is predictable.
search_str = """                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">"""
                            
end_str = """                            </div>
                          </div>"""

# Better yet, I can just use a simple regex replacement on the exact lines.
import sys

# We want to replace the forward button styling too
content = content.replace('className="list-approval-forward-btn"', 'className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors h-9"')

# Move the approval cell
# I'll just write a custom parser for this file
lines = content.split('\n')
new_lines = []
in_approval = False
approval_lines = []

for line in lines:
    if '<div className="min-w-[160px]">' in line and 'list-approval-slot' in content[content.find(line):content.find(line)+150]:
        in_approval = True
        approval_lines.append(line)
    elif in_approval:
        approval_lines.append(line)
        if '</div>' in line and len([l for l in approval_lines if '<div' in l]) == len([l for l in approval_lines if '</div' in l]):
            in_approval = False
            # Now we have approval lines, we need to insert them BEFORE the <td className="px-6 py-4 text-right">
            # We can't do it in one pass this easily because the td has already been appended.
            pass
    else:
        # Not doing it this way.
        pass

# Let's use re.sub with a function
def replacer(match):
    before_actions = match.group(1)
    approval_div = match.group(2)
    # The approval_div contains the closing of the flex container and the td
    # Wait, the approval div is INSIDE the flex container
    
    # We want to move approval_div into its own td BEFORE the actions td.
    pass

# Easiest way:
# 1. Delete the min-w-[160px] block from the actions td.
# 2. Insert it before the actions td.

block_to_move = """                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">
                              {displayStatus === "APPROVED" ? (
                                <div className="flex items-center gap-2">
                                  <span className="list-approval-approved-pill">Approved</span>
                                  {!autoApproved && canReverseApproval() && (
                                    <ReverseApprovalButton
                                      docType="MAINT_REQUEST"
                                      docId={r.id}
                                      className="list-approval-reverse-btn"
                                      onDone={() => load()}
                                    >
                                      Reverse Approval
                                    </ReverseApprovalButton>
                                  )}
                                </div>
                              ) : displayStatus === "PENDING_APPROVAL" ? (
                                <span className="list-approval-forwarded-pill">
                                  Forwarded to {r.forwarded_to_username || "Approver"}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors h-9"
                                  onClick={() => openForwardModal(r)}
                                  disabled={submittingForward || workflowDisabled}
                                >
                                  Forward for Approval
                                </button>
                              )}
                            </div>
                          </div>"""
                          
# First replace the button class
content = content.replace('className="list-approval-forward-btn"', 'className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors h-9"')

# Extract the block (with updated button class)
# Remove it from its current location
content = content.replace(block_to_move, "")

# Insert it before the Actions td
target = '<td className="px-6 py-4 text-right">'
replacement = f'''<td className="px-4 py-3">
{block_to_move}
                      </td>
                      {target}'''
                      
content = content.replace(target, replacement)

with open('MaintenanceRequestsList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Modifications complete')
