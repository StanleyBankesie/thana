/**
 * @fileoverview Reusable floating action button (FAB) for triggering creation actions.
 */

import React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

/**
 * FloatingCreateButton component
 * Renders a fixed floating action button at the bottom-right of the screen via React Portal.
 * 
 * @param {Object} props
 * @param {string} props.to - The URL path to navigate to when clicked.
 * @param {string} props.title - Tooltip title on hover.
 * @param {string} props.className - Custom CSS classes for the button.
 * @param {React.ReactNode} props.children - Inner content of the button.
 * @returns {JSX.Element|null} The portal rendered button or null on the server.
 */
export default function FloatingCreateButton({
  to,
  title,
  className,
  children,
}) {
  if (typeof document === "undefined") return null;
  const style = {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: 2147483647,
    pointerEvents: "auto",
  };
  const content = (
    <div style={style}>
      <Link
        to={to}
        title={title}
        className={
          className ||
          "btn-success inline-flex rounded-full w-12 h-12 shadow-erp-lg items-center justify-center text-xl"
        }
      >
        {children || "+"}
      </Link>
    </div>
  );
  return createPortal(content, document.body);
}
