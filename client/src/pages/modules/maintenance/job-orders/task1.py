import re

with open('MaintenanceJobOrdersList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove timestamp from order no
content = content.replace(
    '<div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">\n                          {r.order_date}\n                        </div>',
    '<div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">\n                          {r.order_date ? new Date(r.order_date).toLocaleDateString() : "-"}\n                        </div>'
)

# 2. Schedule column date
content = content.replace(
    '<td className="px-4 py-3 text-sm text-slate-500">\n                        {r.scheduled_date}\n                      </td>',
    '<td className="px-4 py-3 text-sm text-slate-500">\n                        {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : "-"}\n                      </td>'
)

# 3. Add confirm button
# First add handleConfirm function
if 'async function handleConfirm' not in content:
    func_injection = """
  async function handleConfirm(item) {
    try {
      setLoading(true);
      await api.put(`/maintenance/job-orders/${item.id}`, { ...item, status: 'POSTED' });
      toast.success("Job order posted successfully");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to post job order");
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {"""
    content = content.replace('const filtered = useMemo(() => {', func_injection)

# Add Confirm button next to Created Date (Wait, "next to created date", maybe in the Actions column?)
# Let's put it in the Actions column next to View button.
# "add confirm button next to created date which wil change status = draft to status = POSTED"
# Let's insert a new column or just put it in Actions? "next to created date" means before Actions column.
# Let's check headers.
if '<th>Confirm</th>' not in content:
    content = content.replace(
        '<th>Created Date</th>\n                  <th className="text-right">Actions</th>',
        '<th>Created Date</th>\n                  <th>Confirm</th>\n                  <th className="text-right">Actions</th>'
    )
    content = content.replace('colSpan="9"', 'colSpan="10"')

# Now insert the td
confirm_td = """<td className="px-4 py-3 text-sm">
                        {r.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors h-9"
                            onClick={() => handleConfirm(r)}
                          >
                            Confirm
                          </button>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right">"""

content = content.replace('<td className="px-6 py-4 text-right">', confirm_td)

with open('MaintenanceJobOrdersList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Task 1 modifications applied')
