/**
 * @fileoverview BulkCustomerUpload component.
 * Provides functionality for BulkCustomerUpload.
 */

import React, { useState } from "react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BulkCustomerUpload() {
  const [fileName, setFileName] = useState("");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <h1 className="text-2xl font-bold dark:text-brand-300">
            Bulk Customer Upload
          </h1>
          <p className="text-sm mt-1">Upload customers in bulk (placeholder)</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">CSV File</label>
            <input
              className="input"
              type="file"
              accept=".csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            />
            {fileName ? (
              <div className="text-sm mt-2">Selected: {fileName}</div>
            ) : null}
          </div>

          <div className="text-sm">
            Expected columns: customer_code, customer_name, email, phone,
            address
          </div>

          <button
            type="button"
            className="btn-success"
            onClick={() =>
              window.alert(
                "Upload processing will be implemented in Sales module backend.",
              )
            }
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
