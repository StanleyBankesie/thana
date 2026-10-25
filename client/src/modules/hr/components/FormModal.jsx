/**
 * @fileoverview A reusable modal component for displaying forms.
 * Standardized to conform to the ERP Project Management modal design.
 */

import React from "react";
import Modal from "@/components/common/Modal.jsx";

/**
 * FormModal component
 * Renders a modal overlay with a header, body (children), and footer actions (Cancel/Save).
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible.
 * @param {string} props.title - Modal header title.
 * @param {string} [props.subtitle] - Modal header subtitle.
 * @param {React.ReactNode} [props.icon] - Optional header icon.
 * @param {React.ReactNode} props.children - Form content.
 * @param {Function} props.onClose - Callback when modal is closed.
 * @param {Function} [props.onSubmit] - Callback when the save button is clicked.
 * @param {boolean} [props.submitting=false] - True if the form is currently saving.
 * @param {string} [props.maxWidth='max-w-2xl'] - Max width class.
 * @returns {JSX.Element|null} The modal element or null if closed.
 */
export default function FormModal({
  open,
  title,
  subtitle,
  icon,
  children,
  onClose,
  onSubmit,
  submitting = false,
  maxWidth = "max-w-2xl",
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      maxWidth={maxWidth}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {children}
    </Modal>
  );
}
