import React, { useState, useMemo } from 'react';
import { UpOutlined, DownOutlined, FilterOutlined } from '@ant-design/icons';

/**
 * Reusable DataTable component with column filtering and sorting.
 * 
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions:
 *   {
 *     header: String,
 *     accessor: String | Function,
 *     render: Function(item),
 *     filterable: Boolean (default true),
 *     sortable: Boolean (default true)
 *   }
 * @param {String} defaultSortColumn - The header name to sort by default
 */
export default function DataTable({ data = [], columns = [], defaultSortColumn = 'Created Date' }) {
  const [sortConfig, setSortConfig] = useState({ key: defaultSortColumn, direction: 'desc' });
  const [filters, setFilters] = useState({});

  const handleSort = (header) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === header && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: header, direction });
  };

  const handleFilterChange = (header, value) => {
    setFilters(prev => ({ ...prev, [header]: value }));
  };

  const processedData = useMemo(() => {
    let filteredData = [...data];

    // 1. Apply Filters
    Object.keys(filters).forEach(header => {
      const filterValue = filters[header].toLowerCase();
      if (!filterValue) return;

      const column = columns.find(c => c.header === header);
      if (!column) return;

      filteredData = filteredData.filter(item => {
        let val;
        if (typeof column.accessor === 'function') {
          val = column.accessor(item);
        } else if (column.accessor) {
          val = item[column.accessor];
        }
        
        if (val == null) return false;
        return String(val).toLowerCase().includes(filterValue);
      });
    });

    // 2. Apply Sort
    if (sortConfig.key) {
      const column = columns.find(c => c.header === sortConfig.key);
      if (column) {
        filteredData.sort((a, b) => {
          let aVal, bVal;
          if (typeof column.accessor === 'function') {
            aVal = column.accessor(a);
            bVal = column.accessor(b);
          } else if (column.accessor) {
            aVal = a[column.accessor];
            bVal = b[column.accessor];
          }

          if (aVal == null) aVal = '';
          if (bVal == null) bVal = '';

          // Basic date detection
          const dateA = Date.parse(aVal);
          const dateB = Date.parse(bVal);
          if (!isNaN(dateA) && !isNaN(dateB)) {
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
          }

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return filteredData;
  }, [data, columns, sortConfig, filters]);

  return (
    <div className="overflow-x-auto w-full">
      <table className="table w-full">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="align-top bg-slate-50">
                <div className="flex flex-col gap-2">
                  <div 
                    className={`flex items-center justify-between gap-2 ${col.sortable !== false ? 'cursor-pointer hover:text-brand' : ''}`}
                    onClick={() => col.sortable !== false && handleSort(col.header)}
                  >
                    <span className="font-semibold text-slate-700">{col.header}</span>
                    {col.sortable !== false && (
                      <span className="text-slate-400">
                        {sortConfig.key === col.header ? (
                          sortConfig.direction === 'asc' ? <UpOutlined className="text-brand text-[10px]" /> : <DownOutlined className="text-brand text-[10px]" />
                        ) : (
                          <UpOutlined className="opacity-30 text-[10px]" />
                        )}
                      </span>
                    )}
                  </div>
                  {col.filterable !== false && (
                    <div className="relative">
                      <FilterOutlined className="absolute left-2 top-3 text-slate-400 text-[10px]" />
                      <input 
                        type="text" 
                        placeholder="Filter..." 
                        className="input input-sm w-full pl-6 text-xs font-normal"
                        value={filters[col.header] || ''}
                        onChange={(e) => handleFilterChange(col.header, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-6 text-slate-500">
                No matching records found.
              </td>
            </tr>
          ) : (
            processedData.map((item, rowIdx) => (
              <tr key={item.id || rowIdx} className="hover:bg-slate-50/50">
                {columns.map((col, colIdx) => (
                  <td key={colIdx}>
                    {col.render ? col.render(item) : (
                      typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor]
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
