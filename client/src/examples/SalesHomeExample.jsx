import React from "react";
import { ProtectedFeature, ProtectedButton } from "../auth/PermissionContext.jsx";

export default function SalesHome() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Sales Module</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create Invoice Feature */}
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:create-invoice"
          action="create"
          fallback={null}
        >
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-2">Create Invoice</h3>
              <p className="text-slate-600 mb-4">Create a new sales invoice</p>
              <ProtectedButton
                moduleKey="sales"
                featureKey="sales:create-invoice"
                action="create"
                className="btn btn-primary"
              >
                New Invoice
              </ProtectedButton>
            </div>
          </div>
        </ProtectedFeature>

        {/* View Invoices Feature */}
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:view-invoices"
          action="view"
          fallback={null}
        >
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-2">View Invoices</h3>
              <p className="text-slate-600 mb-4">Browse and manage existing invoices</p>
              <ProtectedButton
                moduleKey="sales"
                featureKey="sales:view-invoices"
                action="view"
                className="btn btn-secondary"
              >
                View All
              </ProtectedButton>
            </div>
          </div>
        </ProtectedFeature>

        {/* Customer List Feature */}
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:customer-list"
          action="view"
          fallback={null}
        >
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-2">Customer List</h3>
              <p className="text-slate-600 mb-4">Manage customer information</p>
              <ProtectedButton
                moduleKey="sales"
                featureKey="sales:customer-list"
                action="view"
                className="btn btn-secondary"
              >
                View Customers
              </ProtectedButton>
            </div>
          </div>
        </ProtectedFeature>

        {/* Sales Reports Feature */}
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:sales-reports"
          action="view"
          fallback={null}
        >
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-2">Sales Reports</h3>
              <p className="text-slate-600 mb-4">View sales analytics and reports</p>
              <ProtectedButton
                moduleKey="sales"
                featureKey="sales:sales-reports"
                action="view"
                className="btn btn-secondary"
              >
                View Reports
              </ProtectedButton>
            </div>
          </div>
        </ProtectedFeature>

        {/* Payment Collection Feature */}
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:payment-collection"
          action="view"
          fallback={null}
        >
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-semibold mb-2">Payment Collection</h3>
              <p className="text-slate-600 mb-4">Record and track payments</p>
              <ProtectedButton
                moduleKey="sales"
                featureKey="sales:payment-collection"
                action="create"
                className="btn btn-primary"
              >
                Record Payment
              </ProtectedButton>
            </div>
          </div>
        </ProtectedFeature>
      </div>

      {/* Example of conditional rendering based on permissions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Invoices</h2>
        <ProtectedFeature
          moduleKey="sales"
          featureKey="sales:view-invoices"
          action="view"
          fallback={
            <div className="text-center py-8 text-slate-500">
              You don't have permission to view invoices.
            </div>
          }
        >
          <div className="card">
            <div className="card-body">
              {/* Invoice list would go here */}
              <p className="text-slate-600">Invoice list content...</p>
            </div>
          </div>
        </ProtectedFeature>
      </div>
    </div>
  );
}
