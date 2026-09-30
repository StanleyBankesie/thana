import React from "react";
import { usePermission } from "../auth/PermissionContext";

/**
 * A button that conditionally renders based on user permissions
 * @param {Object} props
 * @param {string} props.featureKey - The feature key to check permission for (e.g., "sales:customers")
 * @param {string} props.action - The action to check permission for ("view", "create", "edit", "delete")
 * @param {boolean} props.fallback - Whether to render the button disabled instead of hiding it
 * @param {React.ReactNode} props.children - Button content
 * @param {Object} props.rest - Any other button props to pass through
 */
export const PermissionBasedButton = ({ 
  featureKey, 
  action = "view", 
  fallback = false, 
  children, 
  ...rest 
}) => {
  const { canPerformAction } = usePermission();
  const hasPermission = canPerformAction(featureKey, action);

  if (!hasPermission) {
    if (fallback) {
      return (
        <button {...rest} disabled title="You don't have permission for this action">
          {children}
        </button>
      );
    }
    return null;
  }

  return <button {...rest}>{children}</button>;
};

/**
 * A hook to check if a button should be visible based on permissions
 * @param {string} featureKey - The feature key to check permission for
 * @param {string} action - The action to check permission for
 * @returns {boolean} Whether the button should be visible
 */
export const useButtonPermission = (featureKey, action = "view") => {
  const { canPerformAction } = usePermission();
  return canPerformAction(featureKey, action);
};

/**
 * Higher-order component to wrap any component with permission checks
 * @param {React.Component} WrappedComponent - The component to wrap
 * @param {string} featureKey - The feature key to check permission for
 * @param {string} action - The action to check permission for
 * @param {boolean} fallback - Whether to render disabled instead of hiding
 * @returns {React.Component} The wrapped component
 */
export const withPermission = (WrappedComponent, featureKey, action = "view", fallback = false) => {
  return function PermissionWrapper(props) {
    const { canPerformAction } = usePermission();
    const hasPermission = canPerformAction(featureKey, action);

    if (!hasPermission) {
      if (fallback) {
        return <WrappedComponent {...props} disabled title="You don't have permission for this action" />;
      }
      return null;
    }

    return <WrappedComponent {...props} />;
  };
};

export default PermissionBasedButton;
