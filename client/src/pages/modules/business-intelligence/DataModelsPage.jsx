/**
 * @fileoverview BI Data Models (Star Schema / Fact & Dimension Models)
 * Visual architecture overview of analytical fact and dimension tables.
 */
import React, { useState } from "react";
import {
  Boxes, Database, Table, Key, Calendar, Building,
  ShoppingBag, Truck, Users, Activity, Layers, Hash
} from "lucide-react";
import { PageHeader, SectionCard } from "./bi.shared.jsx";

const STAR_SCHEMA = {
  facts: [
    {
      name: "bi_fact_sales",
      label: "FactSales",
      description: "Omnichannel sales transactions, item revenues, discounts, taxes, cost of goods, and gross margins.",
      grain: "One row per invoice line / POS line item",
      color: "border-blue-500 bg-blue-50/20 dark:bg-blue-900/10",
      measures: ["quantity", "unit_price", "discount_amount", "tax_amount", "gross_amount", "net_amount", "cost_amount", "gross_profit", "margin_percentage"],
      foreignKeys: ["date_key -> DimDate", "customer_id -> DimCustomer", "product_id -> DimProduct", "branch_id -> DimBranch", "salesperson_id -> DimEmployee"]
    },
    {
      name: "bi_fact_purchases",
      label: "FactPurchases",
      description: "Procurement purchase orders, receipts, vendor spend, taxes, and fulfillment status.",
      grain: "One row per purchase order line item",
      color: "border-purple-500 bg-purple-50/20 dark:bg-purple-900/10",
      measures: ["quantity", "unit_price", "tax_amount", "total_amount"],
      foreignKeys: ["date_key -> DimDate", "supplier_id -> DimSupplier", "product_id -> DimProduct", "branch_id -> DimBranch"]
    },
    {
      name: "bi_fact_inventory",
      label: "FactInventory",
      description: "Periodic inventory snapshots, warehouse stock levels, moving average valuation, and safety reorder alerts.",
      grain: "One row per product per warehouse snapshot",
      color: "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-900/10",
      measures: ["stock_qty", "cost_price", "selling_price", "total_stock_value", "reorder_level", "is_low_stock"],
      foreignKeys: ["date_key -> DimDate", "product_id -> DimProduct", "warehouse_id -> DimWarehouse", "branch_id -> DimBranch"]
    },
    {
      name: "bi_fact_production",
      label: "FactProduction",
      description: "Shop floor work orders, planned vs good output, scrap rates, machine utilization, and quality yields.",
      grain: "One row per work order / job card execution",
      color: "border-amber-500 bg-amber-50/20 dark:bg-amber-900/10",
      measures: ["planned_qty", "good_qty", "scrap_qty", "scrap_rate", "yield_rate"],
      foreignKeys: ["date_key -> DimDate", "work_order_id -> WorkOrder", "product_id -> DimProduct", "branch_id -> DimBranch"]
    },
    {
      name: "bi_fact_finance",
      label: "FactFinance",
      description: "General ledger entry journals, account debits, credits, net revenue, and category expenditures.",
      grain: "One row per journal entry line",
      color: "border-teal-500 bg-teal-50/20 dark:bg-teal-900/10",
      measures: ["debit_amount", "credit_amount", "net_amount"],
      foreignKeys: ["date_key -> DimDate", "account_id -> DimAccount", "branch_id -> DimBranch"]
    },
    {
      name: "bi_fact_projects",
      label: "FactProjects",
      description: "Project portfolio baselines, authorized budgets, actual expenditures, variance, and milestone completion.",
      grain: "One row per project monthly milestone",
      color: "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/10",
      measures: ["budget", "total_spent", "budget_variance", "completion_pct"],
      foreignKeys: ["date_key -> DimDate", "project_id -> Project", "branch_id -> DimBranch"]
    }
  ],
  dimensions: [
    { name: "bi_dim_date", label: "DimDate", icon: Calendar, attributes: ["date_key (PK)", "full_date", "day_of_month", "day_name", "month_number", "month_name", "quarter_number", "quarter_name", "year_number", "fiscal_year"] },
    { name: "sal_customers", label: "DimCustomer", icon: Users, attributes: ["id (PK)", "customer_code", "customer_name", "customer_type", "city", "country"] },
    { name: "inv_items", label: "DimProduct", icon: ShoppingBag, attributes: ["id (PK)", "item_code", "item_name", "category_name", "cost_price", "selling_price", "uom"] },
    { name: "pur_suppliers", label: "DimSupplier", icon: Truck, attributes: ["id (PK)", "supplier_code", "supplier_name", "supplier_type", "city", "country"] },
    { name: "adm_branches", label: "DimBranch", icon: Building, attributes: ["id (PK)", "code", "name", "city", "state", "country"] },
    { name: "fin_accounts", label: "DimAccount", icon: Hash, attributes: ["id (PK)", "account_code", "account_name", "account_type"] }
  ]
};

export default function DataModelsPage() {
  const [selectedModel, setSelectedModel] = useState(STAR_SCHEMA.facts[0]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytical Data Models & Star Schema"
        description="Structured multidimensional analytical data layer separating fact tables (measures) and dimension tables (attributes) to enable fast querying without affecting operational ERP transactions."
      />

      {/* Model Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STAR_SCHEMA.facts.map((fact) => (
          <button
            key={fact.name}
            onClick={() => setSelectedModel(fact)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedModel.name === fact.name
                ? "bg-brand-900 text-white shadow-erp"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400"
            }`}
          >
            {fact.label}
          </button>
        ))}
      </div>

      {/* Active Fact Model Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title={`${selectedModel.label} Structure (${selectedModel.name})`}>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">{selectedModel.description}</p>
              
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">Granularity: </span>
                <span className="text-slate-500">{selectedModel.grain}</span>
              </div>

              {/* Measures */}
              <div>
                <h4 className="text-xs font-bold text-brand-900 dark:text-brand-300 uppercase tracking-wider mb-2">
                  Analytical Measures (Metrics)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedModel.measures.map((m) => (
                    <div key={m} className="p-2.5 bg-brand-50/50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/50 rounded-lg text-xs font-mono font-semibold text-brand-800 dark:text-brand-300">
                      Σ {m}
                    </div>
                  ))}
                </div>
              </div>

              {/* Foreign Keys / Dimensions */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Dimension Joins (Foreign Keys)
                </h4>
                <div className="space-y-1.5">
                  {selectedModel.foreignKeys.map((fk) => (
                    <div key={fk} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Key size={13} className="text-amber-500" />
                      {fk}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Dimension Tables Catalog */}
        <div className="lg:col-span-1 space-y-4">
          <SectionCard title="Conformed Dimensions">
            <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {STAR_SCHEMA.dimensions.map((dim) => {
                const Icon = dim.icon;
                return (
                  <div key={dim.name} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Icon size={15} className="text-brand-600" />
                      {dim.label} ({dim.name})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dim.attributes.map((attr) => (
                        <span key={attr} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                          {attr}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
