/**
 * @fileoverview HRDashboardPage component.
 * Provides functionality for HRDashboardPage.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../api/client.js";
import ChartPie from "@/components/charts/ChartPie.jsx";

function Card({ title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-bold mt-1">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function SimpleBarChart({ title, data, palette = [] }) {
  const max = Math.max(...data.map((d) => Number(d.value || 0)), 1);
  const w = 760;
  const h = 300;
  const pad = 40;
  const barW = Math.max(18, (w - pad * 2) / Math.max(data.length * 1.6, 1));
  const step = (w - pad * 2) / Math.max(data.length, 1);
  const depth = 6;
  const colors = palette.length
    ? palette
    : [
        "#4f46e5",
        "#06b6d4",
        "#22c55e",
        "#f59e0b",
        "#a855f7",
        "#ef4444",
        "#14b8a6",
        "#8b5cf6",
        "#f97316",
        "#0ea5e9",
        "#10b981",
      ];
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
      <div className="text-lg font-bold mb-3">{title}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[300px]">
        {data.map((d, i) => {
          const x = pad + i * step + (step - barW) / 2;
          const vh = ((Number(d.value || 0) / max) * (h - pad * 2)) | 0;
          const y = h - pad - vh;
          return (
            <g key={i}>
              <polygon
                points={`${x + barW},${y} ${x + barW + depth},${y - depth} ${x + barW + depth},${y - depth + vh} ${x + barW},${y + vh}`}
                fill="#0f172a20"
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={vh}
                fill={colors[i % colors.length]}
                rx="2"
              />
              <polygon
                points={`${x},${y} ${x + barW},${y} ${x + barW + depth},${y - depth} ${x + depth},${y - depth}`}
                fill="#ffffff40"
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                fontSize="10"
                textAnchor="middle"
                fill="#334155"
              >
                {Number(d.value || 0).toLocaleString()}
              </text>
              <text
                x={x + barW / 2}
                y={h - pad + 12}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {String(d.label || "").slice(0, 14)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function HRDashboardPage() {
  const location = useLocation();
  const backTo =
    location.state?.fromExecutiveOverview === true
      ? "/executive-overview"
      : "/human-resources";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/hr/dashboard/metrics", {
          params: { year },
        });
        if (!mounted) return;
        setData(res.data || {});
      } catch (e) {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load HR dashboard metrics",
        );
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [year]);

  const cards = data?.cards || {};
  const categoryPie = data?.category_pie || [];
  const locationPie = data?.location_pie || [];
  const typeBar = data?.employee_type_bar || [];
  const departmentBar = data?.department_bar || [];
  const statusBar = data?.status_bar || [];
  const confirmationsByDept = data?.confirmations_by_department || [];
  const monthlyJoiners = data?.monthly_joiners_trend || [];

  const years = useMemo(
    () => Array.from({ length: 8 }, (_, i) => currentYear - i),
    [currentYear],
  );

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold">HR Dashboard</h1>
              <p className="text-sm mt-1">
                Employees overview and distribution
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">Year</label>
              <select
                className="input input-sm w-28"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                title="Year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <Link to={backTo} className="btn btn-secondary">
                Return to HR
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          {loading ? <div className="text-slate-500">Loading...</div> : null}
          {!loading && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                <Card title="Total Employees" value={cards.total_employees} />
                <Card
                  title={`New Employees ${year}`}
                  value={cards.new_employees_year}
                />
                <Card
                  title={`Confirmations ${year}`}
                  value={cards.confirmations_year}
                />
                <Card title="Male" value={cards.male_count} />
                <Card title="Female" value={cards.female_count} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  title="Average Tenure (Years)"
                  value={Number(cards.average_tenure_years || 0).toFixed(1)}
                />
                <Card
                  title={`Attrition Rate ${year} (%)`}
                  value={Number(cards.attrition_rate || 0).toFixed(1)}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
                  <div className="text-lg font-bold mb-3">
                    Category-wise Employee Count
                  </div>
                  <ChartPie data={categoryPie} />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
                  <div className="text-lg font-bold mb-3">
                    Location-wise Employee Count
                  </div>
                  <ChartPie data={locationPie} />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SimpleBarChart
                  title="Employee Type-wise Count"
                  data={typeBar}
                />
                <SimpleBarChart
                  title="Department-wise Count"
                  data={departmentBar}
                />
              </div>
              <div className="grid grid-cols-1">
                <SimpleBarChart title="Status-wise Count" data={statusBar} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SimpleBarChart
                  title={`Confirmations by Department ${year}`}
                  data={confirmationsByDept}
                />
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-erp">
                  <div className="text-lg font-bold mb-3">
                    Monthly Joiners Trend
                  </div>
                  <svg viewBox="0 0 760 300" className="w-full h-[300px]">
                    {(() => {
                      const w = 760,
                        h = 300,
                        pad = 40;
                      const vals = monthlyJoiners.map((r) =>
                        Number(r.value || 0),
                      );
                      const max = Math.max(...vals, 1);
                      const sx = (i) =>
                        pad +
                        (i * (w - pad * 2)) /
                          Math.max(monthlyJoiners.length - 1, 1);
                      const sy = (v) => h - pad - (v / max) * (h - pad * 2);
                      const pts = monthlyJoiners.map((r, i) => [
                        sx(i),
                        sy(Number(r.value || 0)),
                      ]);
                      const path =
                        "M " + pts.map(([x, y]) => `${x} ${y}`).join(" L ");
                      const area =
                        path +
                        ` L ${sx(monthlyJoiners.length - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
                      return (
                        <>
                          <path d={area} fill="rgba(14,165,233,0.2)" />
                          <polyline
                            points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                            fill="none"
                            stroke="#0ea5e9"
                            strokeWidth="2"
                          />
                          {pts.map(([x, y], i) => (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="3"
                              fill="#0ea5e9"
                            />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
