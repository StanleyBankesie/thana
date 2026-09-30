const fs = require('fs');
const path = 'client/src/pages/modules/inventory/reports/StockTransferRegisterReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add states
const statesToAdd = `
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [itemsFilter, setItemsFilter] = useState([]);

  async function loadFilters() {
    try {
      const [whRes, itRes] = await Promise.all([
        api.get("/inventory/warehouses"),
        api.get("/inventory/items"),
      ]);
      setWarehouses(whRes.data?.items || []);
      setItemsFilter(itRes.data?.items || []);
    } catch {}
  }

  useEffect(() => {
    loadFilters();
  }, []);
`;
content = content.replace('  const [loading, setLoading] = useState(false);', '  const [loading, setLoading] = useState(false);' + statesToAdd);

// 2. Add params
content = content.replace('params: { from: from || null, to: to || null },', 'params: { from: from || null, to: to || null, warehouseId: warehouseId || null, itemId: itemId || null },');

// 3. Update deps
content = content.replace('}, [from, to]);', '}, [from, to, warehouseId, itemId]);');

// 4. Add dropdowns
const dropdowns = `
            <div>
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Item</label>
              <select
                className="input"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">All Items</option>
                {itemsFilter.map(i => (
                  <option key={i.id} value={i.id}>{i.item_name || i.item_code}</option>
                ))}
              </select>
            </div>
`;
content = content.replace('            <div className="md:col-span-2 flex items-end gap-2">', dropdowns + '            <div className="md:col-span-2 flex items-end gap-2">');
content = content.replace('grid-cols-1 md:grid-cols-4', 'grid-cols-1 md:grid-cols-6'); // update grid columns

fs.writeFileSync(path, content, 'utf8');
console.log('StockTransferRegisterReportPage updated successfully.');
