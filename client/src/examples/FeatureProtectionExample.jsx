/**
 * Example: Feature Protection Implementation for ModuleHome Components
 * 
 * This shows how to protect individual features, cards, and buttons
 * in module home screens using the new RBAC system.
 */

import React from "react";
import { usePermission } from "../../../auth/PermissionContextNew.jsx";

// Example protected feature card component
const ProtectedFeatureCard = ({ 
  title, 
  description, 
  icon, 
  path, 
  featureKey, 
  action = "view",
  children 
}) => {
  const { canFeaturePath } = usePermission();
  
  const hasPermission = canFeaturePath(path, action);
  
  if (!hasPermission) {
    return null; // Don't render the card at all
  }
  
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 border border-transparent transition-all duration-200 cursor-pointer group relative overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-slate-700 flex items-center justify-center text-xl group-hover:bg-brand-100 dark:group-hover:bg-slate-600 transition-colors">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Example protected button component
const ProtectedButton = ({ 
  children, 
  path, 
  featureKey, 
  action = "view",
  className = "",
  ...props 
}) => {
  const { canFeaturePath } = usePermission();
  
  const hasPermission = canFeaturePath(path, action);
  
  if (!hasPermission) {
    return null; // Don't render the button
  }
  
  return (
    <button 
      className={`btn ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Example protected link component
const ProtectedLink = ({ 
  children, 
  path, 
  featureKey, 
  action = "view",
  className = "",
  ...props 
}) => {
  const { canFeaturePath } = usePermission();
  
  const hasPermission = canFeaturePath(path, action);
  
  if (!hasPermission) {
    return null; // Don't render the link
  }
  
  return (
    <a 
      href={path}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
};

// Example implementation in a ModuleHome component
export const ExampleModuleHome = () => {
  const { hasModule } = usePermission();
  
  // Check module access first
  if (!hasModule("example-module")) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="card-body">
            <div className="text-center text-slate-600">
              You do not have access to Example Module.
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Protected Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <ProtectedFeatureCard
          title="Create Invoice"
          description="Create new sales invoices"
          icon="🧾"
          path="/example-module/invoices/new"
          featureKey="example-module:invoices"
          action="create"
        />
        
        <ProtectedFeatureCard
          title="View Invoices"
          description="List and manage sales invoices"
          icon="📋"
          path="/example-module/invoices"
          featureKey="example-module:invoices"
          action="view"
        />
        
        <ProtectedFeatureCard
          title="Sales Reports"
          description="View sales analytics and reports"
          icon="📊"
          path="/example-module/reports"
          featureKey="example-module:reports"
          action="view"
        />
        
        <ProtectedFeatureCard
          title="Customer List"
          description="Manage customer information"
          icon="👥"
          path="/example-module/customers"
          featureKey="example-module:customers"
          action="view"
        />
      </div>
      
      {/* Protected Actions Section */}
      <div className="flex justify-end">
        <ProtectedButton
          path="/example-module/invoices/new"
          featureKey="example-module:invoices"
          action="create"
          className="btn-primary"
        >
          Create New Invoice
        </ProtectedButton>
        
        <ProtectedLink
          path="/example-module/reports"
          featureKey="example-module:reports"
          action="view"
          className="btn-secondary ml-2"
        >
          View Reports
        </ProtectedLink>
      </div>
      
      {/* Protected Dashboard Link */}
      <div className="text-center">
        <ProtectedLink
          path="/example-module/dashboard"
          featureKey="example-module:overview-dashboard"
          action="view"
          className="text-brand-600 hover:text-brand-700 font-medium"
        >
          View Dashboard →
        </ProtectedLink>
      </div>
    </div>
  );
};

// Usage in routing (example for routes configuration)
export const ExampleRoutes = () => {
  const { canFeaturePath } = usePermission();
  
  return (
    <Routes>
      <Route path="/" element={<ExampleModuleHome />} />
      
      <Route 
        path="/invoices" 
        element={
          canFeaturePath("/example-module/invoices", "view") ? (
            <InvoiceList />
          ) : (
            <NoAccess />
          )
        } 
      />
      
      <Route 
        path="/invoices/new" 
        element={
          canFeaturePath("/example-module/invoices/new", "create") ? (
            <InvoiceForm />
          ) : (
            <NoAccess />
          )
        } 
      />
      
      <Route 
        path="/dashboard" 
        element={
          canFeaturePath("/example-module/overview-dashboard", "view") ? (
            <Dashboard />
          ) : (
            <NoAccess />
          )
        } 
      />
    </Routes>
  );
};

const NoAccess = () => (
  <div className="p-6">
    <div className="card">
      <div className="card-body">
        <div className="text-center text-slate-600">
          You do not have permission to view this page.
        </div>
      </div>
    </div>
  </div>
);

export { ProtectedFeatureCard, ProtectedButton, ProtectedLink };
