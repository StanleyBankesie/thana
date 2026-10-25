/**
 * @fileoverview A modal component for previewing HTML content before printing or downloading as a PDF.
 * Uses an iframe to isolate the print layout and CSS.
 */

import React, { useEffect, useRef } from "react";
import { Printer, Download, Loader2 } from "lucide-react";
import Modal from "./common/Modal.jsx";

/**
 * PrintPreviewModal component
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is currently visible.
 * @param {Function} props.onClose - Callback triggered to close the modal.
 * @param {string} props.html - The raw HTML content to display in the iframe.
 * @param {boolean} [props.downloading=false] - Loading state for the download action.
 * @param {Function} props.onDownload - Callback triggered when the 'Download PDF' button is clicked.
 * @returns {JSX.Element|null} The modal overlay.
 */
export default function PrintPreviewModal({
  open,
  onClose,
  html,
  downloading = false,
  onDownload,
}) {
  const iframeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    try {
      const f = iframeRef.current;
      if (f && f.contentWindow) f.contentWindow.focus();
    } catch {}
  }, [open, html]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Print Preview"
      subtitle="Document formatted output and layout preview"
      icon={Printer}
      maxWidth="max-w-5xl lg:max-w-6xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            className="btn btn-secondary px-4 py-2 text-sm font-medium"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-secondary px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
            onClick={() => {
              try {
                const f = iframeRef.current;
                if (f && f.contentWindow) f.contentWindow.print();
              } catch {}
            }}
          >
            <Printer size={16} />
            Print
          </button>
          {onDownload && (
            <button
              type="button"
              className="btn btn-primary px-5 py-2 text-sm font-medium inline-flex items-center gap-2"
              disabled={downloading}
              onClick={onDownload}
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
          )}
        </div>
      }
    >
      <div className="-mx-6 -my-4">
        <iframe
          ref={iframeRef}
          title="preview"
          srcDoc={String(html || "")}
          className="w-full h-[70vh] rounded-b-none border-0"
        />
      </div>
    </Modal>
  );
}
