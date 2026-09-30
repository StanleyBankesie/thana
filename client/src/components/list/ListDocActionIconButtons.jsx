import React from "react";
import { Printer, FileText, Paperclip, Mail } from "lucide-react";

/** Matches list “PDF” row style: bordered neutral pill, fixed height (see styles.css `.list-doc-action-btn`). */
export function ListPrintIconButton({ onClick, disabled, title = "Print" }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="list-doc-action-btn"
    >
      <Printer className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function ListPdfIconButton({ onClick, disabled, title = "PDF" }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="list-doc-action-btn"
    >
      <FileText className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function ListAttachmentIconButton({ onClick, disabled, title = "Attachments" }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="list-doc-action-btn"
    >
      <Paperclip className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}

export function ListEmailIconButton({ onClick, disabled, title = "Email" }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="list-doc-action-btn"
    >
      <Mail className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}
