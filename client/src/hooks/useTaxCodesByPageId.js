/**
 * @file useTaxCodesByPageId.js
 * @description Hook to fetch applicable tax codes for a specific page/form.
 */

import { useEffect, useState } from "react";
import { api } from "api/client";

/**
 * Hook to fetch applicable tax codes for a specific page/form
 * @param {number} pageId - The page ID (e.g., 2 for INVOICE, 3 for PURCHASE_BILL_LOCAL)
 * @returns {object} { taxCodes: [], loading, error }
 */
export function useTaxCodesByPageId(pageId) {
  const [taxCodes, setTaxCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pageId) {
      setTaxCodes([]);
      return;
    }

    async function loadTaxCodes() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/finance/tax-codes/by-page/${pageId}`);
        setTaxCodes(res.data?.items || []);
      } catch (err) {
        console.error("Failed to load tax codes:", err);
        setError(err?.response?.data?.message || "Failed to load tax codes");
        setTaxCodes([]);
      } finally {
        setLoading(false);
      }
    }

    loadTaxCodes();
  }, [pageId]);

  return { taxCodes, loading, error };
}

/**
 * Page ID constants for use with useTaxCodesByPageId
 */
export const PAGE_IDS = {
  DIRECT_PURCHASE: 1,
  INVOICE: 2,
  PURCHASE_BILL_LOCAL: 3,
  PURCHASE_BILL_IMPORT: 4,
  LOCAL_PURCHASE_ORDER: 5,
  IMPORT_PURCHASE_ORDER: 6,
  MAINTENANCE_BILL: 7,
  SERVICE_BILL: 8,
  SALES_ORDER: 9,
  QUOTATION: 10,
  SUPPLIER_QUOTATION: 11,
  PAYMENT_VOUCHER: 12,
  RECEIPT_VOUCHER: 13,
  JOURNAL_VOUCHER: 14,
  CONTRA_VOUCHER: 15,
  DEBIT_NOTE: 16,
  CREDIT_NOTE: 17,
  SALES_VOUCHER: 18,
  SALES_RETURN: 19,
  PURCHASE_RETURN: 20,
  DELIVERY_NOTE: 21,
};
