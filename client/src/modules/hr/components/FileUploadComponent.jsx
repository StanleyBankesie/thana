/**
 * @fileoverview A simple reusable file upload component for HR documents.
 */

import React from "react";

/**
 * FileUploadComponent
 * Provides an input element to select a file and an upload button.
 * 
 * @param {Object} props
 * @param {Function} props.onUpload - Callback fired with the selected file when 'Upload' is clicked.
 * @returns {JSX.Element} The file upload component.
 */
export default function FileUploadComponent({ onUpload }) {
  const [file, setFile] = React.useState(null);
  return (
    <div className="flex items-center gap-2">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button type="button" className="btn-secondary" onClick={() => onUpload?.(file)} disabled={!file}>
        Upload
      </button>
    </div>
  );
}
