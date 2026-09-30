/**
 * @fileoverview A generic button component to trigger document approval reversals.
 * Primarily used in legacy modules (e.g., Inventory) for workflow actions.
 */

import React, { useState } from "react";
// Shared reverse-approval button used in some legacy modules (inventory, etc.)
// For purchase orders we now call module-specific reverse endpoints directly
// in their list pages, so this component is no longer used for POs.
import { api } from "../api/client.js";
import { usePermission } from "../auth/PermissionContext.jsx";
import { toast } from "react-toastify";

/**
 * ReverseApprovalButton component
 * Triggers a backend workflow action to reverse an already approved document.
 * 
 * @param {Object} props
 * @param {string} props.docType - The type of document (e.g., 'purchase_order', 'stock_adjustment').
 * @param {string|number} props.docId - The unique ID of the document.
 * @param {string} [props.className] - Optional custom CSS classes.
 * @param {Function} [props.onDone] - Callback fired upon successful reversal.
 * @param {React.ReactNode} [props.children] - Custom button content (defaults to 'Reverse Approval').
 * @returns {JSX.Element|null} The action button.
 */
export default function ReverseApprovalButton({
  docType,
  docId,
  className,
  onDone,
  children,
}) {
  const { canReverseApproval } = usePermission();
  const [busy, setBusy] = useState(false);
  if (!canReverseApproval()) return null;
  /**
   * Executes the reverse approval action.
   */
  async function run() {
    if (!docType || !docId) return;
    setBusy(true);
    try {
      await api.post("/workflows/reverse-by-document", {
        document_type: docType,
        document_id: docId,
      });
      toast.success("Approval reversed and document returned");
      if (typeof onDone === "function") onDone();
    } catch (e) {
      const detail =
        e?.response?.data?.message || e?.message || "Reverse approval failed";
      toast.error(detail);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className={
        className ||
        "ml-2 text-indigo-700 hover:text-indigo-800 text-sm font-medium"
      }
    >
      {children || (busy ? "Reversing Approval..." : "Reverse Approval")}
    </button>
  );
}
