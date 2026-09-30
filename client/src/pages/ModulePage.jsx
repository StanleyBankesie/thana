/**
 * @fileoverview ModulePage component.
 * Redirects the user to the home page. Used as a placeholder or fallback.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ModulePage component
 * @param {Object} props
 * @param {string} props.title - The title of the module.
 * @returns {JSX.Element} A Navigate component that redirects to the home page.
 */
export default function ModulePage({ title }) {
  return <Navigate to="/" replace />;
}
