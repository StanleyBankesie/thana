/**
 * @fileoverview PosReports component.
 * Provides functionality for PosReports.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosReports() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dailyItems, setDailyItems] = useState([]);
  const [paymentItems, setPaymentItems] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [categoryShare, setCategoryShare] = useState([]);
  const [returnByDay, setReturnByDay] = useState([]);
  const [returnByMethod, setReturnByMethod] = useState([]);
  const [profitByGroup, setProfitByGroup] = useState([]);
  const [profitByItem, setProfitByItem] = useState([]);
  const [topItemsShowAll, setTopItemsShowAll] = useState(false);
  const [profitByItemShowAll, setProfitByItemShowAll] = useState(false);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setEndDate(`${yyyy}-${mm}-${dd}`);
    const lastWeek = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    const lyyyy = lastWeek.getFullYear();
    const lmm = String(lastWeek.getMonth() + 1).padStart(2, "0");
    const ldd = String(lastWeek.getDate()).padStart(2, "0");
    setStartDate(`${lyyyy}-${lmm}-${ldd}`);
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let mounted = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/pos/reports/daily-sales", { params: { startDate, endDate } }),
      api.get("/pos/reports/payment-breakdown", {
        params: { startDate, endDate },
      }),
      api.get("/pos/reports/top-items", {
        params: { startDate, endDate, limit: 20 },
      }),
      api.get("/pos/reports/returns-summary", {
        params: { startDate, endDate },
      }),
      api.get("/pos/analytics/category-share", {
        params: { startDate, endDate },
      }),
      api.get("/pos/analytics/profit-by-group", {
        params: { startDate, endDate },
      }),
      api.get("/pos/analytics/profit-by-item", {
        params: { startDate, endDate },
      }),
    ])
      .then(([dailyRes, payRes, topRes, retRes, catRes, profitRes, profitItemRes]) => {
        if (!mounted) return;
        setDailyItems(
          Array.isArray(dailyRes.data?.items) ? dailyRes.data.items : [],
        );
        setPaymentItems(
          Array.isArray(payRes.data?.items) ? payRes.data.items : [],
        );
        setTopItems(
          Array.isArray(topRes.data?.items)
            ? [...topRes.data.items].sort(
                (a, b) => Number(b.qty || 0) - Number(a.qty || 0),
              )
            : [],
        );
        setReturnByDay(Array.isArray(retRes.data?.byDay) ? retRes.data.byDay : []);
        setReturnByMethod(
          Array.isArray(retRes.data?.byMethod) ? retRes.data.byMethod : [],
        );
        setCategoryShare(
          Array.isArray(catRes.data?.items) ? catRes.data.items : [],
        );
        setProfitByGroup(
          Array.isArray(profitRes.data?.items) ? profitRes.data.items : [],
        );
        setProfitByItem(
          Array.isArray(profitItemRes.data?.items) ? profitItemRes.data.items : [],
        );
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load reports");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [startDate, endDate, pollingCounter]);

  const fmtCurrency = (n) =>
    `GH₵${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to POS
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          POS Reports
        </h1>
        <p className="text-sm mt-1">Sales analytics and end-of-day reporting</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-3">
            <div className="text-sm">Start</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <div className="text-sm">End</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <span className="badge">{loading ? "Loading" : "Updated"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Daily Sales Summary</div>
            <div className="text-xs text-slate-500">Totals per day</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyItems.map((d, idx) => (
                    <tr key={idx}>
                      <td>{String(d.date)}</td>
                      <td className="text-right">
                        {Number(d.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right">{fmtCurrency(d.gross)}</td>
                      <td className="text-right">{fmtCurrency(d.discount)}</td>
                      <td className="text-right">{fmtCurrency(d.tax)}</td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(d.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Payment Method Breakdown</div>
            <div className="text-xs text-slate-500">Totals by method</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentItems.map((p, idx) => (
                    <tr key={idx}>
                      <td>{String(p.method || "").toUpperCase()}</td>
                      <td className="text-right">
                        {Number(p.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Returns Summary (By Day)</div>
            <div className="text-xs text-slate-500">Totals per day</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Total Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {returnByDay.map((d, idx) => (
                    <tr key={idx}>
                      <td>{String(d.date)}</td>
                      <td className="text-right">
                        {Number(d.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(d.total)}
                      </td>
                    </tr>
                  ))}
                  {!returnByDay.length ? (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-500">
                        No returns
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Returns Summary (By Method)</div>
            <div className="text-xs text-slate-500">Cash/Card/Mobile totals</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Count</th>
                    <th className="text-right">Total Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {returnByMethod.map((m, idx) => (
                    <tr key={idx}>
                      <td>{String(m.method || "").toUpperCase()}</td>
                      <td className="text-right">
                        {Number(m.count || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(m.total)}
                      </td>
                    </tr>
                  ))}
                  {!returnByMethod.length ? (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-500">
                        No returns
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Sales by Category</div>
            <div className="text-xs text-slate-500">Revenue and performance by item category</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Total Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryShare.map((c, idx) => (
                    <tr key={idx}>
                      <td>{String(c.category || "Uncategorized")}</td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(c.total)}
                      </td>
                    </tr>
                  ))}
                  {categoryShare.length > 0 && (
                    <tr className="bg-slate-50 font-bold">
                      <td>Total</td>
                      <td className="text-right">
                        {fmtCurrency(
                          categoryShare.reduce((sum, c) => sum + Number(c.total || 0), 0)
                        )}
                      </td>
                    </tr>
                  )}
                  {!categoryShare.length && (
                    <tr>
                      <td colSpan={2} className="text-center text-slate-500">
                        No category data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Top Selling by Quantity</div>
            <div className="text-xs text-slate-500">Best performers</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(topItemsShowAll ? topItems : topItems.slice(0, 5)).map((t, idx) => (
                    <tr key={idx}>
                      <td>{String(t.item || "")}</td>
                      <td className="text-right">
                        {Number(t.qty || 0).toLocaleString()}
                      </td>
                      <td className="text-right font-semibold">
                        {fmtCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                  {!topItems.length && (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-500">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {topItems.length > 5 && (
              <button
                onClick={() => setTopItemsShowAll((v) => !v)}
                className="mt-3 text-sm text-brand hover:text-brand-600 font-medium"
              >
                {topItemsShowAll ? "Show Less" : `Show More (${topItems.length - 5} more)`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Profit Margin by Item Group</div>
            <div className="text-xs text-slate-500">Cost vs revenue performance by item group</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item Group</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitByGroup.map((g, idx) => (
                    <tr key={idx}>
                      <td>{String(g.item_group || "Uncategorized")}</td>
                      <td className="text-right">{fmtCurrency(g.revenue)}</td>
                      <td className="text-right">{fmtCurrency(g.total_cost)}</td>
                      <td className="text-right font-semibold">{fmtCurrency(g.profit)}</td>
                      <td className="text-right font-bold">
                        <span className={Number(g.margin_pct) >= 0 ? "text-green-600" : "text-red-600"}>
                          {Number(g.margin_pct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {profitByGroup.length > 0 && (
                    <tr className="bg-slate-50 font-bold">
                      <td>Total</td>
                      <td className="text-right">{fmtCurrency(profitByGroup.reduce((s, g) => s + Number(g.revenue || 0), 0))}</td>
                      <td className="text-right">{fmtCurrency(profitByGroup.reduce((s, g) => s + Number(g.total_cost || 0), 0))}</td>
                      <td className="text-right">{fmtCurrency(profitByGroup.reduce((s, g) => s + Number(g.profit || 0), 0))}</td>
                      <td className="text-right">
                        {(() => {
                          const totalRev = profitByGroup.reduce((s, g) => s + Number(g.revenue || 0), 0);
                          const totalCost = profitByGroup.reduce((s, g) => s + Number(g.total_cost || 0), 0);
                          const overallMargin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
                          return (
                            <span className={overallMargin >= 0 ? "text-green-600" : "text-red-600"}>
                              {overallMargin.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                  {!profitByGroup.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500">
                        No profit data found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-slate-50 rounded-t-lg">
            <div className="font-semibold">Profit Margin by Individual Item</div>
            <div className="text-xs text-slate-500">Cost vs revenue per item</div>
          </div>
          <div className="card-body">
            <div className="overflow-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitByItemShowAll ? profitByItem : profitByItem.slice(0, 5)).map((g, idx) => (
                    <tr key={idx}>
                      <td>{String(g.item || "Unknown")}</td>
                      <td className="text-right">{fmtCurrency(g.revenue)}</td>
                      <td className="text-right">{fmtCurrency(g.total_cost)}</td>
                      <td className="text-right font-semibold">{fmtCurrency(g.profit)}</td>
                      <td className="text-right font-bold">
                        <span className={Number(g.margin_pct) >= 0 ? "text-green-600" : "text-red-600"}>
                          {Number(g.margin_pct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {profitByItem.length > 0 && (
                    <tr className="bg-slate-50 font-bold">
                      <td>Total</td>
                      <td className="text-right">{fmtCurrency(profitByItem.reduce((s, g) => s + Number(g.revenue || 0), 0))}</td>
                      <td className="text-right">{fmtCurrency(profitByItem.reduce((s, g) => s + Number(g.total_cost || 0), 0))}</td>
                      <td className="text-right">{fmtCurrency(profitByItem.reduce((s, g) => s + Number(g.profit || 0), 0))}</td>
                      <td className="text-right">
                        {(() => {
                          const totalRev = profitByItem.reduce((s, g) => s + Number(g.revenue || 0), 0);
                          const totalCost = profitByItem.reduce((s, g) => s + Number(g.total_cost || 0), 0);
                          const overallMargin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
                          return (
                            <span className={overallMargin >= 0 ? "text-green-600" : "text-red-600"}>
                              {overallMargin.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                  {!profitByItem.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500">
                        No profit data found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {profitByItem.length > 5 && (
              <button
                onClick={() => setProfitByItemShowAll((v) => !v)}
                className="mt-3 text-sm text-brand hover:text-brand-600 font-medium"
              >
                {profitByItemShowAll ? "Show Less" : `Show More (${profitByItem.length - 5} more)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
