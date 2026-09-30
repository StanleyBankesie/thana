/**
 * @fileoverview SalaryConfigList component.
 * Provides functionality for SalaryConfigList.
 */

import React from "react";
import { Link } from "react-router-dom";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const CONFIG_CARDS = [
  {
    title: "Base Salaries",
    description:
      "Set and manage each employee's base pay. Changes take effect on the next payroll run.",
    icon: "💵",
    path: "/human-resources/salary-config/base-salaries",
    accent: "from-emerald-500 to-teal-600",
    badge: "Employee Rates",
  },
  {
    title: "Salary Structure",
    description:
      "Define the net-pay formula — choose which allowances, PAYE brackets, SSF, and deductions apply.",
    icon: "⚙️",
    path: "/human-resources/salary-config/structure",
    accent: "from-indigo-500 to-purple-600",
    badge: "Formula Builder",
  },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryConfigList() {
  const [viewMode, setViewMode] = useViewMode();
  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 md:p-8 space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Salary Configurations
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Configure base salaries and payroll calculation structures
            </p>
          </div>
          <button onClick={() => window.history.back()} className="btn-secondary shrink-0">
            ← Back to Menu
          </button>
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CONFIG_CARDS.map((card) => (
            <Link
              key={card.path}
              to={card.path}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Gradient accent bar */}
              <div
                className={`h-1.5 w-full bg-gradient-to-r ${card.accent}`}
              />

              <div className="p-6 flex flex-col gap-4">
                {/* Icon + badge row */}
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{card.icon}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {card.badge}
                  </span>
                </div>

                {/* Title + description */}
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* CTA */}
                <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
                  Open
                  <svg
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick info panel */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            How payroll is calculated
          </h3>
          <ol className="list-decimal ml-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>Employee base salary is retrieved from <strong>Base Salaries</strong>.</li>
            <li>Applicable allowances are added according to the <strong>Salary Structure</strong> formula.</li>
            <li>Statutory deductions (PAYE, SSNIT, Tier 3) are subtracted.</li>
            <li>Net salary is calculated and used to generate payslips.</li>
          </ol>
        </div>
      </div>
    </Guard>
  );
}
