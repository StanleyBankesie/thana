/**
 * @fileoverview QuotationAnalysis component.
 * Provides functionality for QuotationAnalysis.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { format } from "date-fns";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function QuotationAnalysis() {
  const [selectedRFQ, setSelectedRFQ] = useState("");
  const [loadingRFQs, setLoadingRFQs] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [rfqList, setRfqList] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [currentTab, setCurrentTab] = useState("comparison");
  const { canPerformAction } = usePermission();

  useEffect(() => {
    let mounted = true;
    setLoadingRFQs(true);
    setError("");

    api
      .get("/purchase/rfqs")
      .then((res) => {
        if (!mounted) return;
        setRfqList(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load RFQs");
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingRFQs(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadAnalysis = async () => {
    if (!canPerformAction("purchase:quotation-analysis", "view")) {
      return;
    }
    if (!selectedRFQ) return;
    setLoadingAnalysis(true);
    setError("");
    try {
      const res = await api.get("/purchase/quotation-analysis", {
        params: { rfq_no: selectedRFQ },
      });
      setAnalysis(res.data);
    } catch (e) {
      setError(
        e?.response?.data?.message || "Failed to load quotation analysis"
      );
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const uniqueSuppliers = useMemo(() => {
    if (!analysis?.items) return [];
    const suppliers = new Set();
    analysis.items.forEach((item) => {
      item.suppliers.forEach((s) => suppliers.add(s.supplier));
    });
    return Array.from(suppliers);
  }, [analysis]);

  const getLowestPrice = (item) => {
    if (!item.suppliers || item.suppliers.length === 0) return Infinity;
    return Math.min(...item.suppliers.map((s) => s.unit_price));
  };

  const getFastestDelivery = (item) => {
    if (!item.suppliers || item.suppliers.length === 0) return Infinity;
    return Math.min(...item.suppliers.map((s) => s.delivery_days));
  };

  const getSupplierOffer = (item, supplierName) => {
    return item.suppliers.find((s) => s.supplier === supplierName);
  };

  const calculateSupplierTotal = (supplierName) => {
    if (!analysis?.items) return 0;
    return analysis.items.reduce((total, item) => {
      const offer = getSupplierOffer(item, supplierName);
      return total + (offer ? offer.total : 0);
    }, 0);
  };

  const getSelectedRFQDetails = () => {
    return rfqList.find((r) => r.rfq_no === selectedRFQ) || {};
  };

  const rfqDetails = getSelectedRFQDetails();

  if (!canPerformAction("purchase:quotation-analysis", "view")) {
    return (
      <div className="p-6">
        <div className="max-w-3xl mx-auto card">
          <div className="card-body">
            <h1 className="text-xl font-semibold mb-2">Quotation Analysis</h1>
            <p className="text-sm text-slate-600 mb-4">
              You do not have permission to view quotation analysis.
            </p>
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              Back to Purchase
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quotation-analysis-container">
      <style>{`
        :root {
            --primary: #0E3646;
            --primary-dark: #082330;
            --primary-light: #1a5570;
            --success: #28a745;
            --warning: #ffc107;
            --danger: #dc3545;
            --info: #17a2b8;
            --light: #f8f9fa;
            --border: #dee2e6;
        }

        .quotation-analysis-container {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
            min-height: 100vh;
        }

        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white;
            padding: 30px;
            border-radius: 12px 12px 0 0;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .header p {
            opacity: 0.9;
            font-size: 14px;
        }

        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            background: var(--light);
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 15px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(14, 54, 70, 0.3);
        }

        .btn-success {
            background: var(--success);
            color: white;
        }
        
        .btn-info {
            background: var(--info);
            color: white;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .form-content {
            padding: 30px;
        }

        .form-section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--primary);
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .form-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
        }

        .form-group label {
            font-size: 13px;
            font-weight: 600;
            color: var(--primary);
            margin-bottom: 6px;
        }

        .form-control {
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .comparison-table-container {
            overflow-x: auto;
            margin-top: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .comparison-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: white;
            min-width: 1200px;
        }

        .comparison-table thead th {
            background: var(--primary);
            color: white;
            padding: 15px;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
            text-align: left;
        }

        .comparison-table tbody td {
            padding: 12px;
            border-bottom: 1px solid var(--border);
            border-right: 1px solid var(--border);
            vertical-align: top;
        }

        .comparison-table tbody td:last-child {
            border-right: none;
        }

        .supplier-column {
            min-width: 220px;
            background: #f8f9fa;
        }

        .price-cell {
            font-weight: 600;
            font-size: 15px;
            color: var(--primary);
        }

        .best-price {
            background: #d4edda !important;
            position: relative;
        }

        .best-price::after {
            content: "🏆 Best";
            position: absolute;
            top: 5px;
            right: 5px;
            font-size: 10px;
            background: var(--success);
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: 600;
        }
        
        .tabs {
            display: flex;
            gap: 0;
            border-bottom: 2px solid var(--border);
            margin-bottom: 20px;
        }

        .tab {
            padding: 12px 24px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-weight: 500;
            color: #6c757d;
            transition: all 0.3s;
            font-size: 14px;
        }

        .tab.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            background: rgba(14, 54, 70, 0.05);
        }

        .info-card {
            background: #e7f3ff;
            border-left: 4px solid var(--info);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .supplier-info-card {
            background: white;
            border: 2px solid var(--border);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            transition: all 0.3s;
        }

        .supplier-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .supplier-name-large {
            font-size: 18px;
            font-weight: 600;
            color: var(--primary);
        }
        
        .stat-row {
            display: flex;
            gap: 30px;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .stat-label {
            font-size: 12px;
            color: #6c757d;
            font-weight: 600;
            text-transform: uppercase;
        }

        .stat-value {
            font-size: 16px;
            font-weight: 600;
            color: var(--primary);
        }
        
        .score-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 12px;
        }
        
        .score-excellent { background: #d4edda; color: #155724; }
        .score-good { background: #d1ecf1; color: #0c5460; }
        .score-average { background: #fff3cd; color: #856404; }

      `}</style>

      <div className="container mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="header">
          <h1>📊 Quotation Analysis & Comparison</h1>
          <p>Compare supplier quotations and select the best offer</p>
        </div>

        <div className="toolbar">
          <div className="form-group" style={{ maxWidth: "300px", margin: 0 }}>
            <select
              className="form-control"
              value={selectedRFQ}
              onChange={(e) => setSelectedRFQ(e.target.value)}
            >
              <option value="">Select RFQ</option>
              {rfqList.map((rfq) => (
                <option key={rfq.id} value={rfq.rfq_no}>
                  {rfq.rfq_no} -{" "}
                  {rfq.description || rfq.status || "No Description"}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="btn btn-info"
              onClick={loadAnalysis}
              disabled={!selectedRFQ || loadingAnalysis}
            >
              {loadingAnalysis ? "Loading..." : "📈 Generate Report"}
            </button>
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              Back to Purchase
            </button>
          </div>
        </div>

        <div className="form-content">
          {/* RFQ Summary */}
          {selectedRFQ && (
            <div className="form-section">
              <div className="section-title">📋 RFQ Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label>RFQ Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rfqDetails.rfq_no || ""}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>RFQ Date</label>
                  <input
                    type="text"
                    className="form-control"
                    value={
                      rfqDetails.rfq_date
                        ? format(new Date(rfqDetails.rfq_date), "yyyy-MM-dd")
                        : ""
                    }
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <input
                    type="text"
                    className="form-control"
                    value={rfqDetails.status || ""}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="text"
                    className="form-control"
                    value={
                      rfqDetails.expiry_date
                        ? format(new Date(rfqDetails.expiry_date), "yyyy-MM-dd")
                        : ""
                    }
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 text-red-600 bg-red-50 rounded mb-4">
              {error}
            </div>
          )}

          {analysis && (
            <>
              <div className="info-card">
                <p>
                  <strong>📌 Analysis Status:</strong> Quotations loaded. Review
                  the comparison below to make your selection.
                </p>
              </div>

              {/* Tabs */}
              <div className="tabs">
                <button
                  className={`tab ${
                    currentTab === "comparison" ? "active" : ""
                  }`}
                  onClick={() => setCurrentTab("comparison")}
                >
                  📊 Price Comparison
                </button>
                <button
                  className={`tab ${currentTab === "detailed" ? "active" : ""}`}
                  onClick={() => setCurrentTab("detailed")}
                >
                  📋 Detailed Analysis
                </button>
                <button
                  className={`tab ${currentTab === "scoring" ? "active" : ""}`}
                  onClick={() => setCurrentTab("scoring")}
                >
                  ⭐ Scoring Matrix
                </button>
              </div>

              {/* Tab: Price Comparison */}
              {currentTab === "comparison" && (
                <div className="tab-content active">
                  <div className="comparison-table-container">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: "250px" }}>Item Details</th>
                          {uniqueSuppliers.map((supplier) => (
                            <th key={supplier} className="supplier-column">
                              {supplier}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.items.map((item, index) => {
                          const lowestPrice = getLowestPrice(item);
                          return (
                            <tr key={index}>
                              <td>
                                <strong>{item.item_name}</strong>
                                <br />
                                <small style={{ color: "#6c757d" }}>
                                  {item.item_code}
                                </small>
                                <br />
                                <small style={{ color: "#6c757d" }}>
                                  Qty: {item.qty} {item.uom || "Units"}
                                </small>
                              </td>
                              {uniqueSuppliers.map((supplierName) => {
                                const offer = getSupplierOffer(
                                  item,
                                  supplierName
                                );
                                if (!offer)
                                  return <td key={supplierName}>-</td>;

                                const isBestPrice =
                                  offer.unit_price === lowestPrice;

                                return (
                                  <td
                                    key={supplierName}
                                    className={`price-cell ${
                                      isBestPrice ? "best-price" : ""
                                    }`}
                                  >
                                    <div
                                      style={{
                                        fontSize: "16px",
                                        marginBottom: "5px",
                                      }}
                                    >
                                      ${offer.unit_price.toFixed(2)}
                                    </div>
                                    <div
                                      style={{
                                        color: "#6c757d",
                                        fontWeight: "normal",
                                        fontSize: "13px",
                                      }}
                                    >
                                      Subtotal: ${offer.total.toFixed(2)}
                                    </div>
                                    <div
                                      style={{
                                        marginTop: "5px",
                                        color: "var(--primary)",
                                      }}
                                    >
                                      Total: ${offer.total.toFixed(2)}
                                    </div>
                                    <div
                                      style={{
                                        marginTop: "8px",
                                        fontSize: "12px",
                                        fontWeight: "normal",
                                      }}
                                    >
                                      <div style={{ color: "#28a745" }}>
                                        ✓ {offer.delivery_days} days delivery
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        <tr
                          style={{
                            background: "var(--primary)",
                            color: "white",
                            fontWeight: 700,
                            fontSize: "15px",
                          }}
                        >
                          <td>GRAND TOTAL</td>
                          {uniqueSuppliers.map((supplier) => (
                            <td key={supplier}>
                              $
                              {calculateSupplierTotal(supplier).toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2 }
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab: Detailed Analysis */}
              {currentTab === "detailed" && (
                <div className="tab-content active">
                  {uniqueSuppliers.map((supplier, idx) => (
                    <div key={idx} className="supplier-info-card">
                      <div className="supplier-header">
                        <span className="supplier-name-large">{supplier}</span>
                        <span className="score-badge score-good">
                          Score: TBD
                        </span>
                      </div>
                      <div className="stat-row">
                        <div className="stat-item">
                          <span className="stat-label">Total Quoted</span>
                          <span className="stat-value">
                            ${calculateSupplierTotal(supplier).toLocaleString()}
                          </span>
                        </div>
                        {/* Placeholder for other stats as they might not be in the current API */}
                        <div className="stat-item">
                          <span className="stat-label">Status</span>
                          <span className="stat-value">Active</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Scoring Matrix */}
              {currentTab === "scoring" && (
                <div className="tab-content active">
                  <div className="comparison-table-container">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: "250px" }}>Criteria</th>
                          <th style={{ width: "120px" }}>Weight</th>
                          {uniqueSuppliers.map((s) => (
                            <th key={s} className="supplier-column">
                              {s}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <strong>Price Competitiveness</strong>
                          </td>
                          <td>40%</td>
                          {uniqueSuppliers.map((s) => (
                            <td key={s}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td>
                            <strong>Delivery Speed</strong>
                          </td>
                          <td>30%</td>
                          {uniqueSuppliers.map((s) => (
                            <td key={s}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td>
                            <strong>Quality / Specs</strong>
                          </td>
                          <td>20%</td>
                          {uniqueSuppliers.map((s) => (
                            <td key={s}>-</td>
                          ))}
                        </tr>
                        <tr>
                          <td>
                            <strong>Payment Terms</strong>
                          </td>
                          <td>10%</td>
                          {uniqueSuppliers.map((s) => (
                            <td key={s}>-</td>
                          ))}
                        </tr>
                        <tr style={{ background: "#f8f9fa", fontWeight: 600 }}>
                          <td>
                            <strong>TOTAL SCORE</strong>
                          </td>
                          <td>100%</td>
                          {uniqueSuppliers.map((s) => (
                            <td key={s}>-</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
