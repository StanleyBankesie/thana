/**
 * @fileoverview CustomerCreditList component.
 * Provides functionality for CustomerCreditList.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerCreditList() {
  const [viewMode, setViewMode] = useViewMode();
  const items = [{ id: 1, customer: 'ABC Corporation', creditLimit: 50000, currency: 'GHS' }];
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "customer", "asc");

  return (
    <div className="space-y-4">
      <div className="card"><div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
        <div><h1 className="text-2xl font-bold dark:text-brand-300">Customer Credit Limits</h1><p className="text-sm mt-1">Credit limit setup (placeholder)</p></div>
        <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
      </div></div>

      <div className="card"><div className="card-body overflow-x-auto">
        <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}><thead><tr><SortableHeader label="Customer" sortKey="customer" currentKey={sortKey} direction={sortDir} onToggle={toggle} /><SortableHeader label="Credit Limit" sortKey="creditLimit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" /><SortableHeader label="Currency" sortKey="currency" currentKey={sortKey} direction={sortDir} onToggle={toggle} /><th />                    <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    </tr></thead>
          <tbody>
            {sortedItems.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.customer}</td>
                <td className="text-right">{Number(r.creditLimit).toFixed(2)}</td>
                <td>{r.currency}</td>
                <td><Link to={`/sales/customer-credit/${r.id}`} className="text-brand hover:text-brand-600 text-sm font-medium">Edit</Link></td>
                <td>{r.created_by_name || "-"}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}







