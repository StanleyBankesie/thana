import React, { useEffect, useMemo, useState } from "react";
import PendingApprovalTooltip from "@/components/PendingApprovalTooltip.jsx";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useExchangeRate } from "@/hooks/useExchangeRate";

function emptyLine() {
  return {
    accountId: "",
    accountName: "",
    accountCode: "",
    description: "",
    debit: "",
    credit: "",
    referenceNo: "",
    chequeNumber: "",
    chequeDate: "",
    paymentMethod: "",
  };
}

export default function VoucherFormPage({ voucherTypeCode, title }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const readOnly = mode === "view";
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [payees, setPayees] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoiceRefs, setSelectedInvoiceRefs] = useState([]);
  const [voucherNoPreview, setVoucherNoPreview] = useState("");

  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [narration, setNarration] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [voucherHeaderAmounts, setVoucherHeaderAmounts] = useState({
    totalDebit: 0,
    totalCredit: 0,
    balancedAmount: 0,
  });
  const isRV = String(voucherTypeCode).toUpperCase() === "RV";
  const isPAYV = String(voucherTypeCode).toUpperCase() === "PAYV";
  const isCV = String(voucherTypeCode).toUpperCase() === "CV";
  const isDN = String(voucherTypeCode).toUpperCase() === "DN";
  const isCN = String(voucherTypeCode).toUpperCase() === "CN";
  const isJV = String(voucherTypeCode).toUpperCase() === "JV";
  const isSV = String(voucherTypeCode).toUpperCase() === "SV";
  const [rvForm, setRvForm] = useState({
    receivedFrom: "",
    receivedFromCode: "",
    payerAccountId: "",
    paymentMethod: "Cash",
    reference: "",
    chequeDate: "",
    depositAccountId: "",
    taxCodeId: "",
    items: [
      {
        description: "",
        accountId: "",
        amount: "",
        referenceNo: "",
        currencyCode: "",
        exchangeRate: "1",
      },
    ],
    notes: "",
  });
  const [paymentType, setPaymentType] = useState("AGAINST_BILL");
  const [rvIsTaxIncluded, setRvIsTaxIncluded] = useState(false);
  const [pvIsTaxIncluded, setPvIsTaxIncluded] = useState(false);
  const [directBill, setDirectBill] = useState({
    billNo: "",
    billDate: "",
    supplierId: "",
    supplierName: "",
    amount: "",
    remarks: "",
  });
  const [pvForm, setPvForm] = useState({
    payTo: "",
    payToCode: "",
    payToAccountId: "",
    paymentMethod: "Cash",
    reference: "",
    chequeDate: "",
    paymentAccountId: "",
    taxCodeId: "",
    items: [{ description: "", accountId: "", amount: "", exchangeRate: "1" }],
    notes: "",
  });
  const [pvExchangeRate, setPvExchangeRate] = useState("");
  const [pvCurrencyCodeOverride, setPvCurrencyCodeOverride] = useState("");
  const [cvExchangeRate, setCvExchangeRate] = useState("");
  const [showPayToLov, setShowPayToLov] = useState(false);
  const [payToSearch, setPayToSearch] = useState("");
  const [receivedFromSearch, setReceivedFromSearch] = useState("");
  const [paidToSearch, setPaidToSearch] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardComments, setForwardComments] = useState("");
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState("DRAFT");
  const [outstandingBills, setOutstandingBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [selectedBillDetails, setSelectedBillDetails] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [cvForm, setCvForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    transferMethod: "Cash",
    reference: "",
    chequeDate: "",
    taxCodeId: "",
    items: [{ description: "", amount: "" }],
    notes: "",
  });
  const [rvExchangeRate, setRvExchangeRate] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [dncnExchangeRate, setDncnExchangeRate] = useState("");
  const [rvItemExchangeRates, setRvItemExchangeRates] = useState({});
  const { getExchangeRate } = useExchangeRate();
  const baseCurrency = useMemo(() => {
    const arr = Array.isArray(currencies) ? currencies : [];
    return (
      arr.find(
        (c) =>
          String(c.is_base) === "1" || c.is_base === 1 || c.is_base === true,
      ) ||
      arr.find(
        (c) => String(c.code || c.currency_code || "").toUpperCase() === "GHS",
      ) ||
      arr.find((c) =>
        /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
      )
    );
  }, [currencies]);
  const dncnLineCurrencyId = useMemo(() => {
    const firstLineWithAccount = lines.find((l) => String(l.accountId || ""));
    const acc = accounts.find(
      (a) => String(a.id) === String(firstLineWithAccount?.accountId || ""),
    );
    return acc?.currency_id || null;
  }, [lines, accounts]);

  async function loadSetup() {
    try {
      // Map voucherTypeCode to form ID for strict tax filtering
      const vTypeCode = String(voucherTypeCode || "").toUpperCase();
      const formIdMap = {
        PV: "PAYMENT_VOUCHER",
        PAYV: "PAYMENT_VOUCHER",
        RV: "RECEIPT_VOUCHER",
        JV: "JOURNAL_VOUCHER",
        CV: "CONTRA_VOUCHER",
        SV: "SALES_VOUCHER",
        DN: "DEBIT_NOTE",
        CN: "CREDIT_NOTE",
      };
      const formParam = formIdMap[vTypeCode] || null;

      const [vtRes, fyRes, accRes, taxRes, custRes, supRes, curRes] =
        await Promise.all([
          api.get("/finance/voucher-types"),
          api.get("/finance/fiscal-years"),
          api.get("/finance/accounts"),
          api.get("/finance/tax-codes", { params: { form: formParam } }),
          api.get("/sales/customers?active=true"),
          api.get("/purchase/suppliers?active=true"),
          api.get("/finance/currencies"),
        ]);
      const vt = vtRes.data?.items || [];
      const fys = fyRes.data?.items || [];
      const acc = accRes.data?.items || [];
      const taxes = (taxRes.data?.items || []).filter(
        (t) => Number(t.is_active || 0) === 1,
      );
      const customers = Array.isArray(custRes.data?.items)
        ? custRes.data.items
        : [];
      const suppliers = Array.isArray(supRes.data?.items)
        ? supRes.data.items
        : [];
      const currs = Array.isArray(curRes.data?.items) ? curRes.data.items : [];
      const combinedPayees = [
        ...customers.map((c) => ({
          type: "CUSTOMER",
          id: c.id,
          code:
            (c.customer_code && String(c.customer_code).trim()) ||
            `C${String(Number(c.id || 0)).padStart(5, "0")}`,
          name: String(c.customer_name || "").trim(),
        })),
        ...suppliers.map((s) => ({
          type: "SUPPLIER",
          id: s.id,
          code:
            (s.supplier_code && String(s.supplier_code).trim()) ||
            `SU-${String(Number(s.id || 0)).padStart(6, "0")}`,
          name: String(s.supplier_name || "").trim(),
          serviceContractor: String(s.service_contractor || "N").toUpperCase(),
        })),
      ]
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setVoucherTypes(vt);
      setFiscalYears(fys);
      setAccounts(acc);
      setTaxCodes(taxes);
      setPayees(combinedPayees);
      setCurrencies(currs);
      setSuppliers(suppliers);

      if (!fiscalYearId && fys.length) setFiscalYearId(String(fys[0].id));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load finance setup");
    }
  }

  async function loadInvoicesForCustomer(accountId) {
    const accountIdNum = Number(accountId || 0);
    if (!(accountIdNum > 0)) {
      setCustomerInvoices([]);
      return;
    }
    try {
      const res = await api.get("/sales/invoices/outstanding-by-account", {
        params: { account_id: accountIdNum },
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const filtered = items
        .filter((x) => {
          const status = String(x.payment_status || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
          const balance = Number(
            x.balance_amount ?? x.net_amount ?? x.total_amount ?? 0,
          );
          return (
            balance > 0 ||
            status === "UNPAID" ||
            status === "PARTIALLY_PAID" ||
            status === "PARTIAL_PAYMENT"
          );
        })
        .map((x) => ({
          id: x.id,
          invoice_no: x.invoice_no,
          balance_amount: Number(
            x.balance_amount ?? x.net_amount ?? x.total_amount ?? 0,
          ),
          total_amount: Number(x.total_amount || x.net_amount || 0),
          tax_code_id: x.tax_code_id || null,
          payment_status: x.payment_status || "",
        }))
        .sort((a, b) =>
          String(a.invoice_no || "").localeCompare(String(b.invoice_no || "")),
        );
      setCustomerInvoices(filtered);
    } catch {
      setCustomerInvoices([]);
    }
  }

  // Function to fetch outstanding bills for a supplier based on account ID
  // Server will: 1) Get account code from fin_accounts, 2) Find supplier by supplier_code, 3) Return outstanding bills
  async function loadOutstandingBillsForSupplier(accountId) {
    const idNum = Number(accountId || 0);
    if (!(idNum > 0)) {
      setOutstandingBills([]);
      setSelectedBillId("");
      setSelectedBillDetails(null);
      return;
    }
    setLoadingBills(true);
    try {
      const res = await api.get("/purchase/bills/outstanding-by-account", {
        params: { account_id: idNum },
      });
      const bills = Array.isArray(res.data?.items) ? res.data.items : [];
      setOutstandingBills(bills);
      if (!bills.some((b) => String(b.id) === String(selectedBillId))) {
        setSelectedBillId("");
        setSelectedBillDetails(null);
      }
    } catch (e) {
      setOutstandingBills([]);
      setSelectedBillId("");
      setSelectedBillDetails(null);
    } finally {
      setLoadingBills(false);
    }
  }

  useEffect(() => {
    loadSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (isEdit && accounts.length > 0) {
      loadVoucher();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, accounts.length]);
  useEffect(() => {
    async function loadNextNo() {
      if (isEdit) return;
      if (!isPAYV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=PAYV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^(?:PAYV|P)?-?(\d+)$/i);
        const formatted = m ? `P${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPAYV, isEdit]);
  useEffect(() => {
    async function loadNextNoRv() {
      if (isEdit) return;
      if (!isRV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=RV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^RV-?(\d+)$/i);
        const formatted = m ? `RV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoRv();
  }, [isRV, isEdit]);
  useEffect(() => {
    async function loadNextNoCv() {
      if (isEdit) return;
      if (!isCV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=CV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^CV-?(\d+)$/i);
        const formatted = m ? `CV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoCv();
  }, [isCV, isEdit]);
  useEffect(() => {
    async function loadNextNoDn() {
      if (isEdit) return;
      if (!isDN) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=DN",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^DN-?(\d+)$/i);
        const formatted = m ? `DN-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoDn();
  }, [isDN, isEdit]);
  useEffect(() => {
    async function loadNextNoCn() {
      if (isEdit) return;
      if (!isCN) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=CN",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^CN-?(\d+)$/i);
        const formatted = m ? `CN-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoCn();
  }, [isCN, isEdit]);

  useEffect(() => {
    async function loadNextNoJv() {
      if (isEdit) return;
      if (!isJV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=JV",
        );
        const raw = String(res.data?.nextNo || "");
        const m = raw.match(/^JV-?(\d+)$/i);
        const formatted = m ? `JV-${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoJv();
  }, [isJV, isEdit]);

  useEffect(() => {
    if (!(isCN || isDN)) return;
    const fromAcc = accounts.find(
      (a) => String(a.id) === String(dncnLineCurrencyId || ""),
    );
    const fromCode = fromAcc?.currency_code || baseCurrency?.code || "";
    const toCode = baseCurrency?.code || "";
    if (!fromCode || !toCode) {
      setDncnExchangeRate("1");
      return;
    }
    if (String(fromCode) === String(toCode)) {
      setDncnExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setDncnExchangeRate(rate ? String(rate) : "1");
      } catch {
        setDncnExchangeRate("1");
      }
    })();
  }, [isCN, isDN, dncnLineCurrencyId, baseCurrency, voucherDate, getExchangeRate, accounts]);

  async function loadVoucher() {
    if (!isEdit) return;
    try {
      setLoading(true);
      const res = await api.get(`/finance/vouchers/${id}`);
      const data = res.data || {};
      const v = data.item || data.voucher || data;
      if (!v) return;
      const dateStr = (
        v.voucher_date ||
        v.date ||
        new Date().toISOString()
      ).split("T")[0];
      setVoucherDate(dateStr);
      setVoucherNoPreview(
        String(v.voucher_no || data.voucher?.voucher_no || ""),
      );
      setVoucherStatus(String(v.status || data.voucher?.status || "DRAFT"));
      if (v.fiscal_year_id || v.fiscalYearId || data.voucher?.fiscal_year_id) {
        setFiscalYearId(
          String(
            v.fiscal_year_id || v.fiscalYearId || data.voucher?.fiscal_year_id,
          ),
        );
      }
      setNarration(v.narration || data.voucher?.narration || "");
      setVoucherHeaderAmounts({
        totalDebit: Number(v.total_debit || 0),
        totalCredit: Number(v.total_credit || 0),
        balancedAmount: Number(v.balanced_amount || 0),
      });
      const rawLines = Array.isArray(data.lines)
        ? data.lines
        : Array.isArray(v.lines)
          ? v.lines
          : v.items || [];
      const narr = String(v.narration || data.voucher?.narration || "");
      const token = (label) => {
        const m = narr.match(new RegExp(`${label}\\s*:\\s*([^|]+)`, "i"));
        return m ? String(m[1]).trim() : "";
      };
      const rawCredit = rawLines.filter((l) => Number(l.credit || 0) > 0);
      const rawDebit = rawLines.filter((l) => Number(l.debit || 0) > 0);
      const mapped =
        rawLines.map((it) => ({
          accountId: String(it.account_id || it.accountId || ""),
          accountName: String(it.account_name || ""),
          accountCode: String(it.account_code || ""),
          description: it.description || "",
          debit: Number(it.debit || 0),
          credit: Number(it.credit || 0),
        })) || [];
      setLines(mapped.length ? mapped : [emptyLine(), emptyLine()]);
      if (isRV) {
        const debitLine = mapped.find((l) => Number(l.debit || 0) > 0);
        const creditLines = mapped.filter((l) => Number(l.credit || 0) > 0);
        const creditFirstRaw = rawCredit[0] || null;
        const rvName =
          token("Received from") || creditFirstRaw?.account_name || "";
        const rvCode = creditFirstRaw?.account_code
          ? String(creditFirstRaw.account_code)
          : "";
        const rvPayAccId = creditFirstRaw?.account_id
          ? String(creditFirstRaw.account_id)
          : "";
        if (!rvPayAccId) {
          setCustomerInvoices([]);
        }
        setRvForm((prev) => ({
          ...prev,
          depositAccountId: debitLine?.accountId || "",
          receivedFrom: rvName || prev.receivedFrom,
          receivedFromCode: rvCode || prev.receivedFromCode,
          payerAccountId: rvPayAccId || prev.payerAccountId,
          paymentMethod:
            rawLines.find((l) => l.payment_method)?.payment_method ||
            token("Method") ||
            prev.paymentMethod,
          reference: token("Ref") || prev.reference,
          items:
            creditLines.length > 0
              ? creditLines.map((l) => ({
                  description: l.description || "",
                  accountId: String(l.accountId || ""),
                  amount: Number(l.credit || 0),
                  currencyCode:
                    getAccountCurrencyCode(String(l.accountId || "")) ||
                    String(v.currency_code || ""),
                  exchangeRate: String(v.exchange_rate || 1),
                  referenceNo:
                    String(
                      (
                        rawCredit.find(
                          (rc) =>
                            String(rc.account_id || "") ===
                            String(l.accountId || ""),
                        ) || {}
                      ).reference_no || "",
                    ) || "",
                }))
              : prev.items,
        }));
      } else if (isPAYV) {
        const creditLine = mapped.find((l) => Number(l.credit || 0) > 0);
        const debitLines = mapped.filter((l) => Number(l.debit || 0) > 0);
        const debitFirstRaw = rawDebit[0] || null;
        const pvName = token("Paid to") || debitFirstRaw?.account_name || "";
        const pvCode = debitFirstRaw?.account_code
          ? String(debitFirstRaw.account_code)
          : "";
        const pvPayAccId = debitFirstRaw?.account_id
          ? String(debitFirstRaw.account_id)
          : "";
        setPvForm((prev) => ({
          ...prev,
          paymentAccountId: creditLine?.accountId || "",
          payTo: pvName || prev.payTo,
          payToCode: pvCode || prev.payToCode,
          payToAccountId: pvPayAccId || prev.payToAccountId,
          paymentMethod:
            rawLines.find((l) => l.payment_method)?.payment_method ||
            token("Method") ||
            prev.paymentMethod,
          reference: token("Ref") || prev.reference,
          items:
            debitLines.length > 0
              ? debitLines.map((l) => ({
                  description: l.description || "",
                  accountId: String(l.accountId || ""),
                  amount: Number(l.debit || 0),
                }))
              : prev.items,
        }));
      } else if (isCV) {
        const debitLine = mapped.find((l) => Number(l.debit || 0) > 0);
        const creditLine = mapped.find((l) => Number(l.credit || 0) > 0);
        setCvForm((prev) => ({
          ...prev,
          toAccountId: debitLine?.accountId || "",
          fromAccountId: creditLine?.accountId || "",
          transferMethod:
            rawLines.find((l) => l.payment_method)?.payment_method ||
            token("Method") ||
            prev.transferMethod,
          items:
            mapped.length > 0
              ? mapped
                  .filter(
                    (l) =>
                      Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0,
                  )
                  .map((l) => ({
                    description: l.description || "",
                    amount: Number(l.debit || l.credit || 0),
                  }))
              : prev.items,
        }));
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load voucher");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadNextNoPv() {
      if (isEdit || !isPAYV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=PAYV",
        );
        const raw = String(res.data?.nextNo || "");
        // Format as PV000001 (no dash)
        const m = raw.match(/^PV-?(\d+)$/i);
        const formatted = m ? `PV${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoPv();
  }, [isPAYV, isEdit]);

  useEffect(() => {
    async function loadNextNoSv() {
      if (isEdit || !isSV) return;
      try {
        const res = await api.get(
          "/finance/vouchers/next-no?voucherTypeCode=SV",
        );
        const raw = String(res.data?.nextNo || "");
        // Format as SV000001 (no dash)
        const m = raw.match(/^SV-?(\d+)$/i);
        const formatted = m ? `SV${String(m[1]).padStart(6, "0")}` : raw;
        setVoucherNoPreview(formatted);
      } catch {
        setVoucherNoPreview("");
      }
    }
    loadNextNoSv();
  }, [isSV, isEdit]);

  async function resolveOrCreateVoucherTypeId(code) {
    try {
      const res = await api.get("/finance/voucher-types", { params: { code } });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      if (items.length > 0) {
        return Number(items[0].id || 0);
      }
      const upper = String(code || "").toUpperCase();
      const name =
        upper === "PV"
          ? "Payment Voucher"
          : upper === "RV"
            ? "Receipt Voucher"
            : upper === "CV"
              ? "Contra Voucher"
              : upper === "CN"
                ? "Credit Note"
                : upper === "DN"
                  ? "Debit Note"
                  : "Voucher";
      const category =
        upper === "PV"
          ? "PAYMENT"
          : upper === "RV"
            ? "RECEIPT"
            : upper === "CN"
              ? "GENERAL"
              : upper === "DN"
                ? "GENERAL"
                : "GENERAL";
      await api.post("/finance/voucher-types", {
        code: upper,
        name,
        category,
        prefix: upper,
        next_number: 1,
        requires_approval: 0,
        is_active: 1,
      
          comments: forwardComments || "Forwarded for Approval",
        });
      const res2 = await api.get("/finance/voucher-types", {
        params: { code: upper },
      });
      const items2 = Array.isArray(res2.data?.items) ? res2.data.items : [];
      return Number(items2?.[0]?.id || 0);
    } catch {
      return 0;
    }
  }

  const voucherType = useMemo(() => {
    return voucherTypes.find((x) => x.code === voucherTypeCode);
  }, [voucherTypes, voucherTypeCode]);

  const generalVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    if (vt?.name) return vt.name;
    const upper = String(voucherTypeCode || "").toUpperCase();
    return upper === "CN"
      ? "Credit Note"
      : upper === "DN"
        ? "Debit Note"
        : "Voucher";
  }, [voucherTypes, voucherTypeCode]);

  const totals = useMemo(() => {
    if (isRV) {
      const subtotal = rvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax: 0,
        grand: subtotal,
      };
    }
    if (isPAYV) {
      const subtotal = pvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      const pvRate = Number(
        taxCodes.find((t) => String(t.id) === String(pvForm.taxCodeId))
          ?.rate_percent || 0,
      );
      const tax = Math.round(subtotal * pvRate) / 100;
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax,
        grand: subtotal, // Tax not included in total amount
      };
    }
    if (isCV) {
      const subtotal = cvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      const cvRate = Number(
        taxCodes.find((t) => String(t.id) === String(cvForm.taxCodeId))
          ?.rate_percent || 0,
      );
      const tax = Math.round(subtotal * cvRate) / 100;
      return {
        debit: subtotal,
        credit: subtotal,
        subtotal,
        tax,
        grand: subtotal + tax,
      };
    }
    return lines.reduce(
      (acc, l) => {
        acc.debit += Number(l.debit || 0);
        acc.credit += Number(l.credit || 0);
        return acc;
      },
      { debit: 0, credit: 0 },
    );
  }, [lines, rvForm, pvForm, cvForm, isRV, isPAYV, isCV, taxCodes]);
  const pvAmountInBase = useMemo(() => {
    if (!isPAYV) return 0;
    const amount = Number(totals.grand || 0);
    const rate = Number(pvExchangeRate || 1) || 1;
    return Math.round(amount * rate * 100) / 100;
  }, [isPAYV, totals.grand, pvExchangeRate]);

  const balanced =
    Math.round(totals.debit * 100) === Math.round(totals.credit * 100);

  const disabledClass = readOnly
    ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
    : "";

  // moved earlier to avoid temporal-dead-zone during RV render

  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });

  const [rvTaxComponentsByCode, setRvTaxComponentsByCode] = useState({});
  const [pvTaxComponentsByCode, setPvTaxComponentsByCode] = useState({});

  // Account balance state for RV and PAYV
  const [accountBalances, setAccountBalances] = useState({});

  // Helper function to fetch account balance
  async function fetchAccountBalance(accountId) {
    if (!accountId) return null;
    const cached = accountBalances[String(accountId)];
    if (cached !== undefined) return cached;
    try {
      let balance = null;
      try {
        const gl = await api.get("/finance/reports/general-ledger", {
          params: { accountId: Number(accountId) },
        });
        balance =
          gl.data?.account?.current_balance ??
          gl.data?.account?.balance ??
          gl.data?.closing_balance ??
          null;
      } catch {}
      if (balance === null || balance === undefined) {
        const res = await api.get(`/finance/accounts/${accountId}/balance`);
        balance = res.data?.balance ?? res.data?.item?.balance ?? null;
      }
      setAccountBalances((prev) => ({ ...prev, [String(accountId)]: balance }));
      return balance;
    } catch {
      return null;
    }
  }

  const payeeOptions = useMemo(() => {
    const base = accounts.filter((a) =>
      ["DEBTORS", "CREDITORS"].includes(
        String(a.group_name || "").toUpperCase(),
      ),
    );
    const q = String(payToSearch || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (a) => [a.name, a.code],
    });
  }, [accounts, payToSearch]);

  const rvTaxComponentsTotals = useMemo(() => {
    if (!isRV) return { components: [], taxTotal: 0, grand: totals.grand };
    const sub = totals.subtotal || 0;
    const comps = rvTaxComponentsByCode[String(rvForm.taxCodeId || "")] || [];
    const components = comps
      .map((c) => {
        const rate = Number(c.rate_percent || 0);
        const amount = (sub * rate) / 100;
        return {
          name: c.component_name,
          rate,
          amount,
          sort_order: c.sort_order || 0,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const grand = sub + taxTotal;
    return { components, taxTotal, grand };
  }, [
    isRV,
    totals.subtotal,
    totals.grand,
    rvForm.taxCodeId,
    rvTaxComponentsByCode,
  ]);

  useEffect(() => {
    async function loadRvTaxComponents() {
      const key = String(rvForm.taxCodeId || "");
      if (!isRV || !key || rvTaxComponentsByCode[key]) return;
      try {
        const resp = await api.get(`/finance/tax-codes/${key}/components`);
        const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
        setRvTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
        // Auto-populate posting lines with tax components after loading
        setTimeout(() => autoPopulateRvTaxLines(), 0);
      } catch {}
    }
    loadRvTaxComponents();
  }, [isRV, rvForm.taxCodeId, rvTaxComponentsByCode]);

  // Auto-populate RV posting lines when tax code changes (even if components already cached)
  useEffect(() => {
    if (
      isRV &&
      rvForm.taxCodeId &&
      rvTaxComponentsByCode[String(rvForm.taxCodeId)]
    ) {
      autoPopulateRvTaxLines();
    }
  }, [isRV, rvForm.taxCodeId, rvTaxComponentsByCode]);

  useEffect(() => {
    async function loadPvTaxComponents() {
      const key = String(pvForm.taxCodeId || "");
      if (!isPAYV || !key || pvTaxComponentsByCode[key]) return;
      try {
        const resp = await api.get(`/finance/tax-codes/${key}/components`);
        const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
        setPvTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
        // Auto-populate posting lines with tax components after loading
        setTimeout(async () => await autoPopulatePvTaxLines(), 0);
      } catch {}
    }
    loadPvTaxComponents();
  }, [isPAYV, pvForm.taxCodeId, pvTaxComponentsByCode]);

  // Auto-populate posting lines when PAYV tax code changes (even if components already cached or cleared)
  useEffect(() => {
    if (!isPAYV) return;
    // Trigger whenever tax code changes or components load (including when cleared to empty)
    if (pvForm.taxCodeId && pvTaxComponentsByCode[String(pvForm.taxCodeId)]) {
      // Tax code selected and components loaded - populate with tax
      (async () => await autoPopulatePvTaxLines())();
    } else if (!pvForm.taxCodeId) {
      // Tax code cleared - still trigger rebuild without tax
      (async () => await autoPopulatePvTaxLines())();
    }
  }, [isPAYV, pvForm.taxCodeId, pvTaxComponentsByCode, paymentType]);

  // Fetch balance when RV deposit account changes
  useEffect(() => {
    if (isRV && rvForm.depositAccountId) {
      fetchAccountBalance(rvForm.depositAccountId);
    }
  }, [isRV, rvForm.depositAccountId]);

  // Fetch balance when PAYV payment account changes
  useEffect(() => {
    if (isPAYV && pvForm.paymentAccountId) {
      fetchAccountBalance(pvForm.paymentAccountId);
    }
  }, [isPAYV, pvForm.paymentAccountId]);

  // Load outstanding bills when Paid To account changes in Against Bill mode
  useEffect(() => {
    if (isPAYV && paymentType === "AGAINST_BILL" && pvForm.payToAccountId) {
      loadOutstandingBillsForSupplier(pvForm.payToAccountId);
    } else {
      setOutstandingBills([]);
      setSelectedBillId("");
      setSelectedBillDetails(null);
    }
  }, [isPAYV, pvForm.payToAccountId, paymentType]);

  useEffect(() => {
    let mounted = true;
    async function loadCompany() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl,
        });
      } catch {}
    }
    loadCompany();
    return () => {
      mounted = false;
    };
  }, []);

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function wrapDoc(bodyHtml) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voucher</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .vh { font-size: 12px; }
      .vh table { border-collapse: collapse; width: 100%; }
      .vh th, .vh td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      .vh th { background: #f8fafc; text-align: left; }
      .vh .right { text-align: right; }
      .vh .center { text-align: center; }
      .vh-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
      .vh-logo { min-width: 120px; max-width: 200px; }
      .vh-company { text-align: right; font-size: 11px; line-height: 1.35; }
      .vh-company .name { font-weight: 800; font-size: 14px; }
      .vh-titlebar { display: flex; align-items: center; gap: 10px; color: #0f172a; margin: 4px 0 10px; }
      .vh-titlebar .line { flex: 1; height: 1px; background: #0f172a; }
      .vh-titlebar .title { font-weight: 700; }
      .vh-details { width: 100%; margin-bottom: 10px; border: 1px solid #cbd5e1; }
      .vh-details td { border-color: #cbd5e1; }
      .vh-details .label { width: 32%; color: #475569; }
      .vh-details .label-wide { width: 40%; color: #475569; }
      .vh-items thead th { font-weight: 600; }
      .vh-footer a { color: inherit; text-decoration: underline; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  function renderReceiptVoucherHtml(data) {
    const c = data.company || {};
    const r = data.receipt || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Receipt Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Receipt No</td><td>:</td><td>${escapeHtml(r.receiptNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(r.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(r.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(r.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(r.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderPaymentVoucherHtml(data) {
    const c = data.company || {};
    const p = data.payment || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Payment Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Payment No</td><td>:</td><td>${escapeHtml(p.paymentNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(p.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(p.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(p.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(p.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  const buildReceiptVoucherTemplateData = () => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(addressParts[0] || "");
    const addressLine2 = String(addressParts.slice(1).join(" • ") || "");
    const itemsArr = (Array.isArray(rvForm.items) ? rvForm.items : []).map(
      (it) => {
        const amt = Number(it.amount || 0);
        return {
          name: String(it.description || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      },
    );
    const when = voucherDate ? new Date(voucherDate) : new Date();
    const method = String(rvForm.paymentMethod || "").toUpperCase();
    const methodLabel =
      method === "CASH"
        ? "Cash"
        : method === "BANK"
          ? "Bank"
          : method === "CHEQUE"
            ? "Cheque"
            : method === "TRANSFER"
              ? "Bank Transfer"
              : method === "CARD"
                ? "Card"
                : "Other";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1,
        addressLine2,
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: String(voucherNoPreview || ""),
        dateTime: when.toLocaleString(),
        paymentMethod: methodLabel,
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: Number(totals.subtotal || 0).toFixed(2),
        tax: Number(totals.tax || 0).toFixed(2),
        total: Number(totals.grand || 0).toFixed(2),
      },
    };
  };
  const buildPaymentVoucherTemplateData = () => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(addressParts[0] || "");
    const addressLine2 = String(addressParts.slice(1).join(" • ") || "");
    const itemsArr = (Array.isArray(pvForm.items) ? pvForm.items : []).map(
      (it) => {
        const amt = Number(it.amount || 0);
        return {
          name: String(it.description || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      },
    );
    const when = voucherDate ? new Date(voucherDate) : new Date();
    const method = String(pvForm.paymentMethod || "").toUpperCase();
    const methodLabel =
      method === "CASH"
        ? "Cash"
        : method === "BANK"
          ? "Bank"
          : method === "CHEQUE"
            ? "Cheque"
            : method === "TRANSFER"
              ? "Bank Transfer"
              : method === "CARD"
                ? "Card"
                : "Other";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1,
        addressLine2,
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      payment: {
        paymentNo: String(voucherNoPreview || ""),
        dateTime: when.toLocaleString(),
        paymentMethod: methodLabel,
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: Number(totals.subtotal || 0).toFixed(2),
        tax: Number(totals.tax || 0).toFixed(2),
        total: Number(totals.grand || 0).toFixed(2),
      },
    };
  };
  const handlePrintVoucher = async () => {
    try {
      if (!isEdit) return;
      const templateType = isRV
        ? "receipt-voucher"
        : isPAYV
          ? "payment-voucher"
          : "";
      if (!templateType) return;
      const templateName = isRV
        ? "Receipt Voucher"
        : isPAYV
          ? "Payment voucher"
          : "";
      let templateId = null;
      try {
        const tRes = await api.get(`/templates/${templateType}`, {
          params: { name: templateName },
        });
        const tItems = Array.isArray(tRes.data?.items) ? tRes.data.items : [];
        templateId = Number(tItems?.[0]?.id || 0) || null;
      } catch {}
      const resp = await api.post(
        `/documents/${templateType}/${id}/render`,
        { format: "html", ...(templateId ? { template_id: templateId } : {}) },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.width = "800px";
      iframe.style.height = "600px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc =
        iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        window.print();
        return;
      }
      const printStyle = `<style>@media print { img, svg { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>`;
      doc.open();
      doc.write(printStyle + html);
      doc.close();
      const win = iframe.contentWindow || window;
      const doPrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      const waitForImages = () => {
        const images = doc.querySelectorAll("img");
        if (images.length === 0) { doPrint(); return; }
        let loaded = 0;
        images.forEach((img) => {
          if (img.complete) { loaded++; if (loaded === images.length) doPrint(); return; }
          img.onload = () => { loaded++; if (loaded === images.length) doPrint(); };
          img.onerror = () => { loaded++; if (loaded === images.length) doPrint(); };
        });
      };
      setTimeout(waitForImages, 200);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to print voucher");
    }
  };
  const handleDownloadVoucherPdf = async () => {
    try {
      if (!isEdit) return;
      const templateType = isRV
        ? "receipt-voucher"
        : isPAYV
          ? "payment-voucher"
          : "";
      if (!templateType) return;
      const templateName = isRV
        ? "Receipt Voucher"
        : isPAYV
          ? "Payment voucher"
          : "";
      let templateId = null;
      try {
        const tRes = await api.get(`/templates/${templateType}`, {
          params: { name: templateName },
        });
        const tItems = Array.isArray(tRes.data?.items) ? tRes.data.items : [];
        templateId = Number(tItems?.[0]?.id || 0) || null;
      } catch {}
      const resp = await api.post(
        `/documents/${templateType}/${id}/render`,
        { format: "html", ...(templateId ? { template_id: templateId } : {}) },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const fname =
        (isRV ? "ReceiptVoucher_" : isPAYV ? "PaymentVoucher_" : "Voucher_") +
        (voucherNoPreview || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      await renderHtmlToPdf(html, fname);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to download voucher PDF",
      );
    }
  };

  function updateLine(index, patch) {
    if (readOnly) return;
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    if (readOnly) return;
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    if (readOnly) return;
    setLines((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (readOnly) return;

    const ensuredVoucherTypeId =
      Number(voucherType?.id || 0) ||
      (await resolveOrCreateVoucherTypeId(voucherTypeCode));
    const effVoucherTypeId = Number(ensuredVoucherTypeId || 0);

    const isRV = String(voucherTypeCode).toUpperCase() === "RV";
    const isPAYV = String(voucherTypeCode).toUpperCase() === "PAYV";
    const isCV = String(voucherTypeCode).toUpperCase() === "CV";

    let cleaned = [];
    let voucherNarration = narration;

    if (isRV && paymentType !== "DIRECT") {
      if (!rvForm.depositAccountId) {
        toast.error("Select deposit account");
        return;
      }
      const creditItems = rvForm.items
        .map((it) => ({
          accountId: Number(it.accountId || 0),
          description: String(it.description || "").trim(),
          amount: Number(it.amount || 0),
          referenceNo:
            (it.referenceNo && String(it.referenceNo).trim()) || null,
        }))
        .filter((it) => it.accountId && it.amount > 0);

      if (creditItems.length === 0) {
        toast.error("Enter at least one payment detail item");
        return;
      }

      if (creditItems.some((it) => !it.description)) {
        toast.error("Description is mandatory for all payment items");
        return;
      }

      const total = creditItems.reduce((s, it) => s + it.amount, 0);
      const firstDesc = creditItems[0]?.description || "";
      voucherNarration = [narration, firstDesc].filter(Boolean).join(" | ");

      cleaned = [
        {
          accountId: Number(rvForm.depositAccountId),
          description: firstDesc,
          debit: Number(total),
          credit: 0,
          chequeNumber: rvForm.reference || null,
          chequeDate: rvForm.chequeDate || null,
          paymentMethod: rvForm.paymentMethod || null,
        },
        ...creditItems.map((it) => ({
          accountId: it.accountId,
          description: it.description,
          debit: 0,
          credit: it.amount,
          referenceNo: it.referenceNo || null,
          chequeNumber: rvForm.reference || null,
          chequeDate: rvForm.chequeDate || null,
          paymentMethod: rvForm.paymentMethod || null,
        })),
      ];
    } else if (isPAYV && paymentType !== "DIRECT") {
      if (!pvForm.paymentAccountId) {
        toast.error("Select payment account");
        return;
      }
      const debitItems = pvForm.items
        .map((it) => ({
          accountId: Number(it.accountId || 0),
          description: String(it.description || "").trim(),
          amount: Number(it.amount || 0),
          referenceNo:
            (it.referenceNo && String(it.referenceNo).trim()) || null,
        }))
        .filter((it) => it.accountId && it.amount > 0);

      if (debitItems.length === 0) {
        toast.error("Enter at least one payment detail item");
        return;
      }

      if (debitItems.some((it) => !it.description)) {
        toast.error("Description is mandatory for all payment items");
        return;
      }

      const total = debitItems.reduce((s, it) => s + it.amount, 0);
      const firstDesc = debitItems[0]?.description || "";
      voucherNarration = [narration, firstDesc].filter(Boolean).join(" | ");

      cleaned = [
        ...debitItems.map((it) => ({
          accountId: it.accountId,
          description: it.description,
          debit: it.amount,
          credit: 0,
          referenceNo: it.referenceNo || null,
          chequeNumber: pvForm.reference || null,
          chequeDate: pvForm.chequeDate || null,
          paymentMethod: pvForm.paymentMethod || null,
        })),
        {
          accountId: Number(pvForm.paymentAccountId),
          description: firstDesc,
          debit: 0,
          credit: Number(total),
          chequeNumber: pvForm.reference || null,
          chequeDate: pvForm.chequeDate || null,
          paymentMethod: pvForm.paymentMethod || null,
        },
      ];
    } else if (isCV) {
      if (!cvForm.fromAccountId || !cvForm.toAccountId) {
        toast.error("Select both From and To accounts");
        return;
      }
      if (String(cvForm.fromAccountId) === String(cvForm.toAccountId)) {
        toast.error("From and To accounts must be different");
        return;
      }
      const items = cvForm.items
        .map((it) => ({
          description: String(it.description || "").trim(),
          amount: Number(it.amount || 0),
        }))
        .filter((it) => it.amount > 0);

      if (items.length === 0) {
        toast.error("Enter at least one transfer detail item");
        return;
      }

      if (items.some((it) => !it.description)) {
        toast.error("Description is mandatory for all transfer items");
        return;
      }

      const total = items.reduce((s, it) => s + it.amount, 0);
      const firstDesc = items[0]?.description || "";
      voucherNarration = [narration, firstDesc].filter(Boolean).join(" | ");

      cleaned = [
        {
          accountId: Number(cvForm.toAccountId),
          description: firstDesc,
          debit: Number(total),
          credit: 0,
          chequeNumber: cvForm.reference || null,
          chequeDate: cvForm.chequeDate || null,
          paymentMethod: cvForm.transferMethod || null,
        },
        {
          accountId: Number(cvForm.fromAccountId),
          description: firstDesc,
          debit: 0,
          credit: Number(total),
          chequeNumber: cvForm.reference || null,
          chequeDate: cvForm.chequeDate || null,
          paymentMethod: cvForm.transferMethod || null,
        },
      ];
    } else if (isPAYV && paymentType === "DIRECT") {
      // For PAYV DIRECT: use posting lines from UI (including tax components)
      cleaned = lines
        .map((l) => ({
          accountId: Number(l.accountId || 0),
          description: l.description || null,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          accountName: l.accountName || null,
          accountCode: l.accountCode || null,
          referenceNo: l.referenceNo || null,
          chequeNumber: l.chequeNumber || null,
          chequeDate: l.chequeDate || null,
          paymentMethod: l.paymentMethod || null,
        }))
        .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
    } else {
      // For all other voucher types: use posting lines from UI
      cleaned = lines
        .map((l) => ({
          accountId: Number(l.accountId || 0),
          description: l.description || null,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          // Preserve all additional fields from posting lines
          accountName: l.accountName || null,
          accountCode: l.accountCode || null,
          referenceNo: l.referenceNo || null,
          chequeNumber: l.chequeNumber || null,
          chequeDate: l.chequeDate || null,
          paymentMethod: l.paymentMethod || null,
        }))
        .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
    }

    // Skip posting lines validation for Direct Payment modes (lines auto-populated with tax)
    if (!((isPAYV || isRV) && paymentType === "DIRECT")) {
      if (cleaned.length < 2) {
        toast.error("Enter at least two posting lines");
        return;
      }

      const debit = cleaned.reduce((s, l) => s + Number(l.debit || 0), 0);
      const credit = cleaned.reduce((s, l) => s + Number(l.credit || 0), 0);

      if (Math.round(debit * 100) !== Math.round(credit * 100)) {
        toast.error("Total debit must equal total credit");
        return;
      }
    }

    try {
      setLoading(true);
      const firstPvPaymentItem =
        pvForm.items.find(
          (item) =>
            Number(item?.accountId || 0) && Number(item?.amount || 0) > 0,
        ) ||
        pvForm.items[0] ||
        {};
      const payload = {
        voucherTypeId: effVoucherTypeId,
        voucherTypeCode: voucherTypeCode,
        voucherDate,
        isDirectPayment: isPAYV && paymentType === "DIRECT",
        ...(isRV
          ? {
              currencyId: rvVoucherCurrencyId || null,
              exchangeRate: Number(rvVoucherExchangeRate || 1) || 1,
            }
          : {}),
        ...(isPAYV &&
        paymentType === "AGAINST_BILL" &&
        selectedBillId &&
        Number(totals.grand || 0) > 0
          ? {
              apply_to_purchase_bills: [
                {
                  bill_id: Number(selectedBillId),
                  amount: Number(totals.grand || 0),
                },
              ],
            }
          : {}),
        // Include payment details for Direct Payment - backend will generate posting lines
        ...(isPAYV && paymentType === "DIRECT"
          ? {
              paymentDetails: {
                accountId: firstPvPaymentItem.accountId || null,
                paymentAccountId: pvForm.paymentAccountId || null,
                totalAmount: Number(totals.grand || 0),
                baseAmount: Number(pvAmountInBase || 0),
                baseCurrencyCode: baseCurrency?.code || "USD",
                currencyCode: effectivePaymentCurrencyCode || "USD",
                description: firstPvPaymentItem.description || "Direct Payment",
              },
            }
          : {}),
        narration:
          isRV || isPAYV || isCV
            ? voucherNarration
            : isRV
              ? [
                  rvForm.receivedFrom
                    ? `Received from: ${rvForm.receivedFrom}`
                    : null,
                  rvForm.paymentMethod
                    ? `Method: ${rvForm.paymentMethod}`
                    : null,
                  rvForm.reference ? `Ref: ${rvForm.reference}` : null,
                  narration || null,
                ]
                  .filter(Boolean)
                  .join(" | ")
              : isPAYV
                ? [
                    pvForm.payTo ? `Paid to: ${pvForm.payTo}` : null,
                    pvForm.paymentMethod
                      ? `Method: ${pvForm.paymentMethod}`
                      : null,
                    pvForm.reference ? `Ref: ${pvForm.reference}` : null,
                    narration || null,
                  ]
                    .filter(Boolean)
                    .join(" | ")
                : isCV
                  ? [
                      cvForm.fromAccountId
                        ? `From: ${
                            accounts.find(
                              (a) =>
                                String(a.id) === String(cvForm.fromAccountId),
                            )?.code
                          }`
                        : null,
                      cvForm.toAccountId
                        ? `To: ${
                            accounts.find(
                              (a) =>
                                String(a.id) === String(cvForm.toAccountId),
                            )?.code
                          }`
                        : null,
                      cvForm.transferMethod
                        ? `Method: ${cvForm.transferMethod}`
                        : null,
                      cvForm.reference ? `Ref: ${cvForm.reference}` : null,
                      narration || null,
                    ]
                      .filter(Boolean)
                      .join(" | ")
                  : narration,
        lines: cleaned,
      };

      if (isEdit) {
        const res = await api.put(`/finance/vouchers/${id}`, payload);
        toast.success(res.data?.message || "Updated voucher");
      } else {
        const res = await api.post("/finance/vouchers", payload);
        const newId = Number(res?.data?.id || 0) || null;
        const newRef = String(res?.data?.voucherNo || "") || null;

        toast.success(`Created ${res.data?.voucherNo || "voucher"}`);
        navigate(
          `/finance/${
            voucherTypeCode === "JV"
              ? "journal-voucher"
              : voucherTypeCode === "PAYV"
                ? "payment-voucher"
                : voucherTypeCode === "RV"
                  ? "receipt-voucher"
                  : voucherTypeCode === "CV"
                    ? "contra-voucher"
                    : voucherTypeCode === "SV"
                      ? "sales-voucher"
                      : voucherTypeCode === "PV"
                        ? "purchase-voucher"
                        : voucherTypeCode === "DN"
                          ? "debit-note"
                          : voucherTypeCode === "CN"
                            ? "credit-note"
                            : "journal-voucher"
          }`,
          {
            state: {
              refresh: true,
              highlightId: newId,
              highlightRef: newRef,
            },
          },
        );
        return;
      }
      navigate(
        `/finance/${
          voucherTypeCode === "JV"
            ? "journal-voucher"
            : voucherTypeCode === "PV"
              ? "payment-voucher"
              : voucherTypeCode === "RV"
                ? "receipt-voucher"
                : voucherTypeCode === "CV"
                  ? "contra-voucher"
                  : voucherTypeCode === "SV"
                    ? "sales-voucher"
                    : voucherTypeCode === "PUV"
                      ? "purchase-voucher"
                      : voucherTypeCode === "DN"
                        ? "debit-note"
                        : voucherTypeCode === "CN"
                          ? "credit-note"
                          : "journal-voucher"
        }`,
        {
          state: {
            refresh: true,
            highlightId: id ? Number(id) : undefined,
            highlightRef:
              voucherNoPreview && String(voucherNoPreview).trim()
                ? String(voucherNoPreview)
                : undefined,
          },
        },
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to create voucher");
    } finally {
      setLoading(false);
    }
  }

  function updateRvForm(patch) {
    if (readOnly) return;
    setRvForm((prev) => ({ ...prev, ...patch }));
  }
  function updateRvItem(idx, patch) {
    if (readOnly) return;
    updateRvForm({
      items: rvForm.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it,
      ),
    });
    // Auto-populate posting lines when account, description, or amount changes
    if (
      patch.accountId !== undefined ||
      patch.description !== undefined ||
      patch.amount !== undefined
    ) {
      setTimeout(() => autoPopulateRvPostingLines(idx, patch), 0);
    }
  }

  // Auto-populate posting lines for Receipt Voucher based on payment details
  function autoPopulateRvPostingLines(changedIdx, changedPatch) {
    if (!isRV || paymentType !== "DIRECT") return;

    const currentItem = rvForm.items[changedIdx] || {};
    const updatedItem = { ...currentItem, ...changedPatch };
    const accountId = updatedItem.accountId || currentItem.accountId || "";
    const description =
      updatedItem.description || currentItem.description || "";
    const amount = Number(updatedItem.amount || currentItem.amount || 0);

    // Build base posting lines from current items
    const baseLines = rvForm.items.map((it) => {
      const acc = accounts.find((a) => String(a.id) === String(it.accountId));
      return {
        accountId: it.accountId || "",
        accountName: acc?.name || "",
        accountCode: acc?.code || "",
        description: it.description || "",
        debit: Number(it.amount || 0),
        credit: 0,
      };
    });

    // Add tax component lines if tax code is selected
    const taxLines = [];
    if (rvForm.taxCodeId && rvTaxComponentsByCode[String(rvForm.taxCodeId)]) {
      const comps = rvTaxComponentsByCode[String(rvForm.taxCodeId)] || [];
      const totalAmount = rvForm.items.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0,
      );
      comps.forEach((comp) => {
        if (comp.account_id) {
          const rate = Number(comp.rate_percent || 0);
          const taxAmount = (totalAmount * rate) / 100;
          taxLines.push({
            accountId: String(comp.account_id),
            accountName: comp.account_name || "",
            accountCode: comp.account_code || "",
            description: description || `Tax - ${comp.component_name || ""}`,
            debit: 0,
            credit: taxAmount,
          });
        }
      });
    }

    // Add customer sales account line if account matches a customer
    const customerAccountLines = [];
    if (accountId) {
      const acc = accounts.find((a) => String(a.id) === String(accountId));
      const accountCode = acc?.code || "";
      const customer = payees.find(
        (p) => p.type === "CUSTOMER" && String(p.code) === String(accountCode),
      );
      if (customer) {
        // Find customer data to get sales_account_id
        api
          .get(`/sales/customers/${customer.id}`)
          .then((res) => {
            const custData = res.data?.item || res.data || {};
            const salesAccountId = custData.sales_account_id;
            if (salesAccountId) {
              const salesAcc = accounts.find(
                (a) => String(a.id) === String(salesAccountId),
              );
              // Calculate net amount (total - tax)
              const totalAmount = rvForm.items.reduce(
                (sum, it) => sum + Number(it.amount || 0),
                0,
              );
              let taxAmount = 0;
              if (
                rvForm.taxCodeId &&
                rvTaxComponentsByCode[String(rvForm.taxCodeId)]
              ) {
                const comps =
                  rvTaxComponentsByCode[String(rvForm.taxCodeId)] || [];
                taxAmount = comps.reduce(
                  (sum, c) =>
                    sum + (totalAmount * Number(c.rate_percent || 0)) / 100,
                  0,
                );
              }
              const netAmount = totalAmount - taxAmount;

              // Add or update the customer sales account line
              setLines((prev) => {
                const existingIdx = prev.findIndex(
                  (l) => String(l.accountId) === String(salesAccountId),
                );
                if (existingIdx >= 0) {
                  return prev.map((l, i) =>
                    i === existingIdx
                      ? {
                          ...l,
                          debit: 0,
                          credit: netAmount,
                          description: description || l.description,
                        }
                      : l,
                  );
                }
                return [
                  ...prev,
                  {
                    accountId: String(salesAccountId),
                    accountName: salesAcc?.name || "",
                    accountCode: salesAcc?.code || "",
                    description: description || "",
                    debit: 0,
                    credit: netAmount,
                  },
                ];
              });
            }
          })
          .catch(() => {});
      }
    }

    // Combine all lines
    const allLines = [...baseLines, ...taxLines];
    if (allLines.length > 0) {
      setLines(allLines);
    }
  }

  // Auto-populate posting lines when RV tax code changes
  function autoPopulateRvTaxLines() {
    if (!isRV || !rvForm.taxCodeId) return;

    const comps = rvTaxComponentsByCode[String(rvForm.taxCodeId)] || [];
    if (!comps.length) return;

    const totalAmount = rvForm.items.reduce(
      (sum, it) => sum + Number(it.amount || 0),
      0,
    );
    const firstDescription = rvForm.items[0]?.description || "";

    // Build tax lines
    const taxLines = comps
      .filter((comp) => comp.account_id)
      .map((comp) => {
        const rate = Number(comp.rate_percent || 0);
        const taxAmount = (totalAmount * rate) / 100;
        return {
          accountId: String(comp.account_id),
          accountName: comp.account_name || "",
          accountCode: comp.account_code || "",
          description: firstDescription || `Tax - ${comp.component_name || ""}`,
          debit: 0,
          credit: taxAmount,
        };
      });

    // Update lines - remove old tax lines and add new ones
    setLines((prev) => {
      // Keep non-tax lines (lines that don't match any tax component account)
      const taxAccountIds = new Set(comps.map((c) => String(c.account_id)));
      const baseLines = prev.filter(
        (l) => !taxAccountIds.has(String(l.accountId)),
      );
      return [...baseLines, ...taxLines];
    });
  }

  function addRvItem() {
    if (readOnly) return;
    updateRvForm({
      items: [
        ...rvForm.items,
        {
          description: "",
          accountId: "",
          amount: "",
          referenceNo: "",
          currencyCode: "",
          exchangeRate: "1",
        },
      ],
    });
  }
  function removeRvItem(idx) {
    if (readOnly) return;
    if (rvForm.items.length <= 1) return;
    updateRvForm({
      items: rvForm.items.filter((_, i) => i !== idx),
    });
  }
  function numberToWords(amount) {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const dollars = Math.floor(amount || 0);
    const cents = Math.round(((amount || 0) - dollars) * 100);
    function convertToWords(num) {
      if (num === 0) return "";
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100)
        return (
          tens[Math.floor(num / 10)] +
          (num % 10 !== 0 ? " " + ones[num % 10] : "")
        );
      if (num < 1000)
        return (
          ones[Math.floor(num / 100)] +
          " Hundred" +
          (num % 100 !== 0 ? " " + convertToWords(num % 100) : "")
        );
      if (num < 1000000)
        return (
          convertToWords(Math.floor(num / 1000)) +
          " Thousand" +
          (num % 1000 !== 0 ? " " + convertToWords(num % 1000) : "")
        );
      return (
        convertToWords(Math.floor(num / 1000000)) +
        " Million" +
        (num % 1000000 !== 0 ? " " + convertToWords(num % 1000000) : "")
      );
    }
    let result = convertToWords(dollars) + " Cedi" + (dollars !== 1 ? "s" : "");
    if (cents > 0) {
      result +=
        " and " + convertToWords(cents) + " Pesewa" + (cents !== 1 ? "s" : "");
    }
    return result;
  }

  function numberToWordsBasic(amount) {
    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const dollars = Math.floor(amount || 0);
    const cents = Math.round(((amount || 0) - dollars) * 100);
    function convertToWords(num) {
      if (num === 0) return "Zero";
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100)
        return (
          tens[Math.floor(num / 10)] +
          (num % 10 !== 0 ? " " + ones[num % 10] : "")
        );
      if (num < 1000)
        return (
          ones[Math.floor(num / 100)] +
          " Hundred" +
          (num % 100 !== 0 ? " " + convertToWords(num % 100) : "")
        );
      if (num < 1000000)
        return (
          convertToWords(Math.floor(num / 1000)) +
          " Thousand" +
          (num % 1000 !== 0 ? " " + convertToWords(num % 1000) : "")
        );
      return (
        convertToWords(Math.floor(num / 1000000)) +
        " Million" +
        (num % 1000000 !== 0 ? " " + convertToWords(num % 1000000) : "")
      );
    }
    const intWords = convertToWords(dollars);
    const centsPart = String(cents).padStart(2, "0");
    return cents > 0 ? `${intWords} and ${centsPart}/100` : `${intWords}`;
  }

  // RV-derived values placed before RV render to avoid TDZ
  const rvIsBankLike = useMemo(
    () =>
      ["Cheque", "Bank Transfer", "Credit Card"].includes(
        rvForm.paymentMethod || "",
      ),
    [rvForm.paymentMethod],
  );

  const depositAccountCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    return acc?.currency_code || acc?.currency || "";
  }, [accounts, rvForm.depositAccountId]);
  const rvPayeeCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.payerAccountId || ""),
    );
    return acc?.currency_code || acc?.currency || "";
  }, [accounts, rvForm.payerAccountId]);
  const rvPayeeCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.payerAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, rvForm.payerAccountId]);
  const rvDepositCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, rvForm.depositAccountId]);
  const baseCurrencyCode = String(
    baseCurrency?.code || baseCurrency?.currency_code || "",
  ).toUpperCase();
  function getAccountCurrencyCode(accountId) {
    const acc = accounts.find((a) => String(a.id) === String(accountId || ""));
    return String(acc?.currency_code || acc?.currency || "").toUpperCase();
  }
  function getRvItemCurrencyCode(item) {
    return String(
      item?.currencyCode || getAccountCurrencyCode(item?.accountId) || "",
    ).toUpperCase();
  }
  function getRvItemExchangeRateValue(item, idx) {
    const itemCurrencyCode = getRvItemCurrencyCode(item);
    if (!itemCurrencyCode || itemCurrencyCode === baseCurrencyCode) return "1";
    return String(item?.exchangeRate || rvItemExchangeRates[idx] || "");
  }
  async function resolveExchangeRateForCurrency(currencyCode) {
    const fromCode = String(currencyCode || "").toUpperCase();
    if (!fromCode || !baseCurrencyCode || fromCode === baseCurrencyCode) {
      return "1";
    }
    try {
      const rate = await getExchangeRate(fromCode, baseCurrencyCode);
      console.info("[RV exchange debug] external lookup", {
        fromCode,
        baseCurrencyCode,
        rate,
      });
      return rate ? String(rate) : "";
    } catch (err) {
      console.warn("[RV exchange debug] external lookup failed", {
        fromCode,
        baseCurrencyCode,
        error: err?.message || err,
      });
      toast.warn(
        `Exchange rate debug: failed to resolve ${fromCode}/${baseCurrencyCode}. Check console for source details.`,
      );
      return "";
    }
  }
  const rvSummaryCurrencyCode = useMemo(() => {
    const items = Array.isArray(rvForm.items) ? rvForm.items : [];
    return (
      items.map((it) => getRvItemCurrencyCode(it)).find(Boolean) ||
      baseCurrencyCode ||
      ""
    );
  }, [rvForm.items, baseCurrencyCode, accounts]);
  const rvVoucherCurrencyId = useMemo(() => {
    const code = rvSummaryCurrencyCode;
    const cur = currencies.find(
      (c) =>
        String(c.code || c.currency_code || "").toUpperCase() ===
        String(code || "").toUpperCase(),
    );
    return cur?.id || null;
  }, [currencies, rvSummaryCurrencyCode]);
  const rvVoucherExchangeRate = useMemo(() => {
    const firstItem = (Array.isArray(rvForm.items) ? rvForm.items : []).find(
      (it) => getRvItemCurrencyCode(it),
    );
    return String(
      getRvItemExchangeRateValue(firstItem || {}, 0) || rvExchangeRate || "1",
    );
  }, [rvForm.items, rvItemExchangeRates, rvExchangeRate, baseCurrencyCode]);
  const rvTotalInBaseCurrency = useMemo(() => {
    if (!isRV) return 0;
    return (Array.isArray(rvForm.items) ? rvForm.items : []).reduce(
      (sum, it, idx) =>
        sum +
        Number(it.amount || 0) *
          Number(getRvItemExchangeRateValue(it, idx) || 1),
      0,
    );
  }, [isRV, rvForm.items, rvItemExchangeRates, baseCurrencyCode, accounts]);
  const cvToCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, cvForm.toAccountId]);
  const cvFromCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, cvForm.fromAccountId]);
  const cvFromCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, cvForm.fromAccountId]);
  const cvToCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, cvForm.toAccountId]);

  // Search options for Received From (RV) and Paid To (PAYV) - using accounts
  const accountSearchOptions = useMemo(() => {
    return (Array.isArray(accounts) ? accounts : []).map((a) => ({
      value: String(a.id),
      label: String(a.name || ""),
      code: String(a.code || ""),
    }));
  }, [accounts]);

  const receivedFromSearchResults = useMemo(() => {
    const q = String(receivedFromSearch || "").trim();
    if (!q) return [];
    return filterAndSort(accountSearchOptions, {
      query: q,
      getKeys: (o) => [o.label, o.code],
    }).slice(0, 10);
  }, [receivedFromSearch, accountSearchOptions]);

  const paidToSearchResults = useMemo(() => {
    const q = String(paidToSearch || "").trim();
    if (!q) return [];
    return filterAndSort(accountSearchOptions, {
      query: q,
      getKeys: (o) => [o.label, o.code],
    }).slice(0, 10);
  }, [paidToSearch, accountSearchOptions]);

  const cvSelectableAccounts = useMemo(() => {
    const allowed = new Set(["BANK ACCOUNTS", "CASH AND CASH EQUIVALENTS"]);
    return (accounts || []).filter((a) =>
      allowed.has(
        String(a.group_name || "")
          .trim()
          .toUpperCase(),
      ),
    );
  }, [accounts]);
  const cvHasBankAccount = useMemo(() => {
    const fromAcc = accounts.find(
      (a) => String(a.id) === String(cvForm.fromAccountId || ""),
    );
    const toAcc = accounts.find(
      (a) => String(a.id) === String(cvForm.toAccountId || ""),
    );
    const fromGc = String(fromAcc?.group_code || "").toUpperCase();
    const fromGn = String(fromAcc?.group_name || "").toUpperCase();
    const toGc = String(toAcc?.group_code || "").toUpperCase();
    const toGn = String(toAcc?.group_name || "").toUpperCase();
    return (
      fromGc === "AST_BANK" ||
      fromGn === "BANK ACCOUNTS" ||
      toGc === "AST_BANK" ||
      toGn === "BANK ACCOUNTS"
    );
  }, [accounts, cvForm.fromAccountId, cvForm.toAccountId]);
  const rvAmountWord = useMemo(() => {
    const id = rvDepositCurrencyId;
    let cur = currencies.find((c) => String(c.id) === String(id));
    if (!cur && depositAccountCurrencyCode) {
      cur = currencies.find(
        (c) => String(c.code) === String(depositAccountCurrencyCode),
      );
    }
    return cur ? String(cur.name || "") : "";
  }, [currencies, rvDepositCurrencyId, depositAccountCurrencyCode]);
  const isChequeLike = useMemo(
    () =>
      ["Cheque", "Bank Transfer", "Credit Card"].includes(
        pvForm.paymentMethod || "",
      ),
    [pvForm.paymentMethod],
  );
  const paymentAccountCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, pvForm.paymentAccountId]);
  const effectivePaymentCurrencyCode = String(
    pvCurrencyCodeOverride || paymentAccountCurrencyCode || "",
  );
  const payeeCurrencyCode = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.payToAccountId || ""),
    );
    return acc?.currency_code || "";
  }, [accounts, pvForm.payToAccountId]);
  const payeeCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.payToAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, pvForm.payToAccountId]);
  const paymentAccountCurrencyId = useMemo(() => {
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    return acc?.currency_id || null;
  }, [accounts, pvForm.paymentAccountId]);
  const pvAmountWord = useMemo(() => {
    const id = paymentAccountCurrencyId;
    const cur = currencies.find((c) => String(c.id) === String(id));
    return cur
      ? String(cur.name || cur.code || "")
      : String(effectivePaymentCurrencyCode || "");
  }, [currencies, paymentAccountCurrencyId, effectivePaymentCurrencyCode]);
  const pvVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    return vt?.name || "Payment Voucher";
  }, [voucherTypes, voucherTypeCode]);
  const rvVoucherTypeName = useMemo(() => {
    const vt = voucherTypes.find(
      (x) =>
        String(x.code).toUpperCase() === String(voucherTypeCode).toUpperCase(),
    );
    return vt?.name || "Receive Voucher";
  }, [voucherTypes, voucherTypeCode]);
  useEffect(() => {
    if (!isCV) return;
    const fromCode = cvFromCurrencyCode || "";
    const toCode = cvToCurrencyCode || "";
    if (!fromCode || !toCode) {
      setCvExchangeRate("");
      return;
    }
    if (fromCode === toCode) {
      setCvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setCvExchangeRate(rate ? String(rate) : "");
      } catch {
        setCvExchangeRate("");
      }
    })();
  }, [
    isCV,
    cvFromCurrencyCode,
    cvToCurrencyCode,
    voucherDate,
    getExchangeRate,
  ]);

  useEffect(() => {
    if (!isRV) return;
    const fromCode = depositAccountCurrencyCode || "";
    const toCode = baseCurrency?.code || "";
    if (!fromCode || !toCode) {
      setRvExchangeRate("1");
      return;
    }
    if (fromCode === toCode) {
      setRvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setRvExchangeRate(rate ? String(rate) : "1");
      } catch {
        setRvExchangeRate("1");
      }
    })();
  }, [isRV, depositAccountCurrencyCode, baseCurrency, voucherDate, getExchangeRate]);

  useEffect(() => {
    if (!isPAYV) return;
    const fromCode = paymentAccountCurrencyCode || "";
    const toCode = baseCurrency?.code || "";
    if (!fromCode || !toCode) {
      setPvExchangeRate("1");
      return;
    }
    if (fromCode === toCode) {
      setPvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setPvExchangeRate(rate ? String(rate) : "1");
      } catch {
        setPvExchangeRate("1");
      }
    })();
  }, [isPAYV, paymentAccountCurrencyCode, baseCurrency, voucherDate, getExchangeRate]);

  // PV UI
  function updatePv(patch) {
    if (readOnly) return;
    setPvForm((prev) => ({ ...prev, ...patch }));
  }
  function updatePvItem(idx, patch) {
    if (readOnly) return;
    const nextItems = pvForm.items.map((it, i) =>
      i === idx ? { ...it, ...patch } : it,
    );
    const changed = nextItems[idx];
    updatePv({ items: nextItems });
    // Auto-populate posting lines when account, description, or amount changes
    if (
      patch.accountId !== undefined ||
      patch.description !== undefined ||
      patch.amount !== undefined
    ) {
      setTimeout(async () => await autoPopulatePvPostingLines(idx, patch), 0);
    }
  }

  // Auto-populate posting lines for Payment Voucher based on payment details
  async function autoPopulatePvPostingLines(changedIdx, changedPatch) {
    console.log("DEBUG autoPopulatePvPostingLines called:", {
      isPAYV,
      changedIdx,
      changedPatch,
      paymentType,
    });
    if (!isPAYV) {
      console.log("DEBUG: Not PAYV, returning");
      return;
    }

    // Get the changed item details
    const currentItem = pvForm.items[changedIdx] || {};
    const updatedItem = { ...currentItem, ...changedPatch };
    const accountId = updatedItem.accountId || currentItem.accountId || "";
    const description =
      updatedItem.description || currentItem.description || "";
    const amount = Number(updatedItem.amount || currentItem.amount || 0);
    const itemCurrency =
      updatedItem.currencyCode ||
      currentItem.currencyCode ||
      effectivePaymentCurrencyCode ||
      "USD";

    console.log("DEBUG: Item details:", {
      accountId,
      description,
      amount,
      itemCurrency,
    });

    // Calculate total amount from all items
    const totalAmount = pvForm.items.reduce(
      (sum, it) => sum + Number(it.amount || 0),
      0,
    );

    console.log("DEBUG: Total amount:", totalAmount, "Items:", pvForm.items);

    // Get the first item's description for tax components
    const firstDescription = pvForm.items[0]?.description || description || "";

    // Build new posting lines array
    const newLines = [];
    console.log("DEBUG: Starting to build lines");

    // 1. Add the selected account from Payment Details to Posting Lines (CREDIT side)
    // Duplicate account data, description, and amount into credit field
    console.log("DEBUG: Checking accountId:", accountId);
    if (accountId) {
      const acc = accounts.find((a) => String(a.id) === String(accountId));
      console.log("DEBUG: Found account:", acc);
      newLines.push({
        accountId: String(accountId),
        accountName: acc?.name || "",
        description: firstDescription || "",
        currencyCode: itemCurrency,
        debit: 0,
        credit: totalAmount,
      });
      console.log("DEBUG: Added credit line for account:", accountId);
    }

    // 2. Calculate and add tax component lines (DEBIT side)
    let totalTaxAmount = 0;
    console.log(
      "DEBUG: Checking tax code:",
      pvForm.taxCodeId,
      "Components:",
      pvTaxComponentsByCode,
    );
    if (pvForm.taxCodeId && pvTaxComponentsByCode[String(pvForm.taxCodeId)]) {
      const comps = pvTaxComponentsByCode[String(pvForm.taxCodeId)] || [];
      console.log("DEBUG: Tax components found:", comps.length);
      comps.forEach((comp) => {
        const rate = Number(comp.rate_percent || 0);
        const compTaxAmount = Math.round(totalAmount * rate) / 100;
        totalTaxAmount += compTaxAmount;
        console.log(
          "DEBUG: Adding tax component:",
          comp.component_name,
          "amount:",
          compTaxAmount,
        );
        if (comp.account_id) {
          newLines.push({
            accountId: String(comp.account_id),
            accountName: comp.account_name || "",
            description:
              firstDescription || `Tax - ${comp.component_name || ""}`,
            currencyCode: itemCurrency,
            debit: compTaxAmount,
            credit: 0,
          });
        }
      });
    }

    // 3. Look up pur_suppliers table for purchase/expense account and add to posting lines (DEBIT side)
    // Net amount = Total - Tax
    const netAmount = totalAmount - totalTaxAmount;
    if (accountId && netAmount > 0) {
      try {
        // Get account code from selected account
        const selectedAcc = accounts.find(
          (a) => String(a.id) === String(accountId),
        );
        const accountCode = selectedAcc?.code || "";

        // Find supplier by account code
        const supplier = suppliers.find(
          (s) =>
            String(s.account_code || s.code || s.supplier_code || "").trim() ===
            String(accountCode).trim(),
        );

        if (supplier?.purchase_account_id || supplier?.expense_account_id) {
          const purchaseAccountId =
            supplier.purchase_account_id || supplier.expense_account_id;
          const purchaseAcc = accounts.find(
            (a) => String(a.id) === String(purchaseAccountId),
          );
          newLines.push({
            accountId: String(purchaseAccountId),
            accountName: purchaseAcc?.name || supplier.supplier_name || "",
            description: firstDescription || "",
            currencyCode: itemCurrency,
            debit: netAmount,
            credit: 0,
          });
        }
      } catch {
        // Silent fail - if no matching supplier found, skip this line
      }
    }

    // Set all posting lines
    console.log(
      "DEBUG: Final newLines count:",
      newLines.length,
      "Lines:",
      newLines,
    );
    if (newLines.length > 0) {
      setLines(newLines);
      console.log("DEBUG: Lines set successfully");
    } else {
      console.log("DEBUG: No lines to set");
    }
  }

  // Auto-populate posting lines when PAYV tax code changes
  async function autoPopulatePvTaxLines() {
    if (!isPAYV) return;

    // Trigger full rebuild of posting lines with tax recalculation
    // Always trigger, even with 0 items - tax components will be calculated based on current total
    await autoPopulatePvPostingLines(0, {});
  }

  function addPvItem() {
    if (readOnly) return;
    updatePv({
      items: [
        ...pvForm.items,
        { description: "", accountId: "", amount: "", exchangeRate: "1" },
      ],
    });
  }
  function removePvItem(idx) {
    if (readOnly) return;
    if (pvForm.items.length <= 1) return;
    updatePv({
      items: pvForm.items.filter((_, i) => i !== idx),
    });
  }
  useEffect(() => {
    if (!isPAYV) return;
    setPvCurrencyCodeOverride(paymentAccountCurrencyCode || "");
  }, [isPAYV, paymentAccountCurrencyCode]);

  // Allow tax code to persist regardless of tax included setting for RV

  // Allow tax code to persist regardless of tax included setting

  useEffect(() => {
    if (!isPAYV) return;
    const acc = accounts.find(
      (a) => String(a.id) === String(pvForm.paymentAccountId || ""),
    );
    if (!acc) return;
    const gc = String(acc.group_code || "").toUpperCase();
    const gn = String(acc.group_name || "").toUpperCase();
    const wantsBank = isChequeLike;
    const ok = wantsBank
      ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
      : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    if (!ok) updatePv({ paymentAccountId: "" });
  }, [isPAYV, isChequeLike, accounts, pvForm.paymentAccountId]);
  useEffect(() => {
    if (!isRV) return;
    const acc = accounts.find(
      (a) => String(a.id) === String(rvForm.depositAccountId || ""),
    );
    if (!acc) return;
    const gc = String(acc.group_code || "").toUpperCase();
    const gn = String(acc.group_name || "").toUpperCase();
    const wantsBank = rvIsBankLike;
    const ok = wantsBank
      ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
      : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    if (!ok) updateRvForm({ depositAccountId: "" });
  }, [isRV, rvIsBankLike, accounts, rvForm.depositAccountId]);
  useEffect(() => {
    if (!isPAYV) return;
    const fromCode = payeeCurrencyCode || "";
    const toCode = paymentAccountCurrencyCode || "";
    if (!fromCode || !toCode) {
      setPvExchangeRate("");
      return;
    }
    if (fromCode === toCode) {
      setPvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setPvExchangeRate(rate ? String(rate) : "");
      } catch {
        setPvExchangeRate("");
      }
    })();
  }, [
    isPAYV,
    payeeCurrencyCode,
    paymentAccountCurrencyCode,
    voucherDate,
    getExchangeRate,
  ]);
  useEffect(() => {
    if (!isRV) return;
    const fromCode = rvPayeeCurrencyCode || "";
    const toCode = depositAccountCurrencyCode || "";
    if (!fromCode || !toCode) {
      setRvExchangeRate("1");
      return;
    }
    if (fromCode === toCode) {
      setRvExchangeRate("1");
      return;
    }
    (async () => {
      try {
        const rate = await getExchangeRate(fromCode, toCode);
        setRvExchangeRate(rate ? String(rate) : "1");
      } catch {
        setRvExchangeRate("1");
      }
    })();
  }, [
    isRV,
    rvPayeeCurrencyCode,
    depositAccountCurrencyCode,
    voucherDate,
    getExchangeRate,
  ]);

  // Fetch exchange rate from external API based on currency field
  useEffect(() => {
    if (!isPAYV) return;
    const currencyCode = effectivePaymentCurrencyCode || "";
    const baseCurrencyCode = baseCurrency?.code || "";

    // If currency is same as base currency, exchange rate = 1
    if (currencyCode && baseCurrencyCode && currencyCode === baseCurrencyCode) {
      setPvExchangeRate("1");
      return;
    }

    if (!currencyCode || !baseCurrencyCode) {
      setPvExchangeRate("1");
      return;
    }

    (async () => {
      try {
        const rate = await getExchangeRate(currencyCode, baseCurrencyCode);
        if (rate) {
          setPvExchangeRate(String(rate));
        } else {
          setPvExchangeRate("");
        }
      } catch {
        setPvExchangeRate("");
      }
    })();
  }, [isPAYV, effectivePaymentCurrencyCode, baseCurrency, getExchangeRate]);

  useEffect(() => {
    if (!isRV) return;
    const baseCode = String(
      baseCurrency?.code || baseCurrency?.currency_code || "",
    ).toUpperCase();
    const items = Array.isArray(rvForm.items) ? rvForm.items : [];
    if (!items.length || !baseCode) {
      setRvItemExchangeRates({});
      return;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        items.map(async (it, idx) => {
          const fromCode = getRvItemCurrencyCode(it);
          if (!fromCode || fromCode === baseCode) return [idx, "1"];
          try {
            const rate = await resolveExchangeRateForCurrency(fromCode);
            return [idx, rate ? String(rate) : ""];
          } catch {
            return [idx, ""];
          }
        }),
      );
      if (cancelled) return;
      setRvItemExchangeRates(Object.fromEntries(pairs));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isRV,
    rvForm.items,
    accounts,
    baseCurrency,
    getExchangeRate,
    currencies,
    voucherDate,
  ]);
  useEffect(() => {
    if (!isRV) return;
    if (!rvForm.payerAccountId) {
      setCustomerInvoices([]);
      return;
    }
    loadInvoicesForCustomer(rvForm.payerAccountId);
  }, [isRV, rvForm.payerAccountId]);

  function updateCv(patch) {
    if (readOnly) return;
    setCvForm((prev) => ({ ...prev, ...patch }));
  }
  function updateCvItem(idx, patch) {
    if (readOnly) return;
    updateCv({
      items: cvForm.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it,
      ),
    });
  }
  function addCvItem() {
    if (readOnly) return;
    updateCv({
      items: [...cvForm.items, { description: "", amount: "" }],
    });
  }
  function removeCvItem(idx) {
    if (readOnly) return;
    if (cvForm.items.length <= 1) return;
    updateCv({
      items: cvForm.items.filter((_, i) => i !== idx),
    });
  }
  if (isJV || isCN || isDN || isSV || isPAYV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">
                  Create a new voucher (double-entry enforced)
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Back
                </button>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                 ) : (
                  <></>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPAYV || isRV) && !isJV && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={generalVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                {!isJV && (
                  <div>
                    <label className="label">Voucher No</label>
                    <input
                      className="input"
                      value={
                        voucherNoPreview ||
                        (isJV
                          ? "JV-000001"
                          : isCN
                            ? "CN-000001"
                            : isDN
                              ? "DN-000001"
                              : "")
                      }
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className={`input md:w-64 ${disabledClass}`}
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {(isPAYV || isRV || isCV) && (
                  <div className="md:col-span-3">
                    <label className="label font-bold text-brand">
                      Narration *
                    </label>
                    <input
                      className={`input border-2 border-brand/20 focus:border-brand ${disabledClass}`}
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="Professional narration for this transaction"
                      required
                      disabled={readOnly}
                    />
                  </div>
                )}
              </div>

              {showPayToLov && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg w-full max-w-xl shadow-lg">
                    <div className="flex justify-between items-center px-4 py-3 border-b">
                      <div className="font-semibold text-brand">
                        Select Paid To
                      </div>
                      <button
                        type="button"
                        className="text-slate-600 hover:text-slate-800 text-xl font-bold"
                        onClick={() => setShowPayToLov(false)}
                      >
                        &times;
                      </button>
                    </div>
                    <div className="p-4">
                      <label className="label">Search</label>
                      <input
                        className="input w-full"
                        placeholder="Type name or code"
                        value={payToSearch}
                        onChange={(e) => setPayToSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="mt-3 max-h-64 overflow-y-auto border rounded">
                        {payeeOptions.length === 0 ? (
                          <div className="p-3 text-center text-slate-500">
                            No matches
                          </div>
                        ) : (
                          payeeOptions
                            .sort((a, b) =>
                              String(a.name).localeCompare(String(b.name)),
                            )
                            .map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 border-b last:border-b-0"
                                onClick={() => {
                                  const accountId = String(a.id);
                                  const name = String(a.name || "");
                                  const items =
                                    pvForm.items.length === 0
                                      ? [
                                          {
                                            description: "",
                                            accountId,
                                            amount: 0,
                                          },
                                        ]
                                      : pvForm.items.map((it, i) =>
                                          i === 0 ? { ...it, accountId } : it,
                                        );
                                  updatePv({
                                    payTo: name,
                                    payToAccountId: accountId,
                                    items,
                                  });
                                  setShowPayToLov(false);
                                  setPayToSearch("");
                                }}
                              >
                                <div className="font-medium">{a.name}</div>
                                <div className="text-xs text-slate-500">
                                  {a.code}
                                </div>
                              </button>
                            ))
                        )}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setShowPayToLov(false);
                            setPayToSearch("");
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                {readOnly &&
                  (isSV || isPAYV) &&
                  (voucherHeaderAmounts.totalDebit > 0 ||
                    voucherHeaderAmounts.totalCredit > 0) && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Voucher Summary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded p-3 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Total Debit
                          </div>
                          <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">
                            GH₵{" "}
                            {voucherHeaderAmounts.totalDebit.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded p-3 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Total Credit
                          </div>
                          <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">
                            GH₵{" "}
                            {voucherHeaderAmounts.totalCredit.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded p-3 border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Balanced Amount
                          </div>
                          <div className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1">
                            GH₵{" "}
                            {voucherHeaderAmounts.balancedAmount.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                {isCN || isDN ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="label">Exchange Rate</label>
                      <input
                        className="input"
                        value={dncnExchangeRate || ""}
                        readOnly
                      />
                    </div>
                  </div>
                ) : null}
                {/* Hide Posting Lines for PAYV Direct Payment - auto-generated on backend */}
                {!(isPAYV && paymentType === "DIRECT") && (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Posting Lines
                      </div>
                      <button
                        type="button"
                        className="btn-success"
                        onClick={addLine}
                        disabled={readOnly}
                      >
                        + Add Line
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Description</th>
                            {isCN || isDN ? (
                              <th className="text-right w-32">Currency</th>
                            ) : null}
                            <th
                              className="text-right"
                              style={{ minWidth: "300px" }}
                            >
                              Debit
                            </th>
                            <th
                              className="text-right"
                              style={{ minWidth: "300px" }}
                            >
                              Credit
                            </th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l, idx) => {
                            const accFromList = accounts.find(
                              (a) => String(a.id) === String(l.accountId || ""),
                            );
                            const displayName =
                              l.accountName || accFromList?.name || "";
                            const displayCode =
                              l.accountCode || accFromList?.code || "";
                            const accountLabel =
                              isSV || isPAYV
                                ? displayName
                                : displayCode
                                  ? `${displayCode} - ${displayName}`
                                  : displayName;
                            const isReadOnlySVorPV = readOnly && (isSV || isPAYV);
                            return (
                              <tr key={idx}>
                                <td>
                                  {isReadOnlySVorPV ? (
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      {accountLabel || "-"}
                                    </span>
                                  ) : (
                                    <select
                                      className="input"
                                      value={l.accountId}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          accountId: e.target.value,
                                        })
                                      }
                                      required
                                      disabled={readOnly}
                                    >
                                      <option value="">Select account</option>
                                      {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {isSV || isPAYV
                                            ? a.name
                                            : `${a.code} - ${a.name}`}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td>
                                  {isReadOnlySVorPV ? (
                                    <span className="text-slate-600 dark:text-slate-400">
                                      {l.description || "-"}
                                    </span>
                                  ) : (
                                    <input
                                      className="input"
                                      value={l.description}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Line memo"
                                      disabled={readOnly}
                                    />
                                  )}
                                </td>
                                {isCN || isDN ? (
                                  <td className="text-right">
                                    {(() => {
                                      const acc = accounts.find(
                                        (a) =>
                                          String(a.id) ===
                                          String(l.accountId || ""),
                                      );
                                      return acc?.currency_code || "";
                                    })()}
                                  </td>
                                ) : null}
                                <td
                                  className={
                                    isReadOnlySVorPV
                                      ? "text-right font-mono"
                                      : ""
                                  }
                                >
                                  {isReadOnlySVorPV ? (
                                    <span
                                      className={
                                        Number(l.debit || 0) > 0
                                          ? "font-semibold text-slate-800 dark:text-slate-200"
                                          : "text-slate-400"
                                      }
                                    >
                                      {Number(l.debit || 0) > 0
                                        ? `GH₵ ${Number(l.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : "-"}
                                    </span>
                                  ) : (
                                    <input
                                      className="input text-right"
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={l.debit || ""}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          debit: e.target.value,
                                          credit: 0,
                                        })
                                      }
                                      onFocus={() => {
                                        const v = String(l.debit ?? "");
                                        if (v === "0") {
                                          updateLine(idx, { debit: "" });
                                        }
                                      }}
                                      disabled={readOnly}
                                    />
                                  )}
                                </td>
                                <td
                                  className={
                                    isReadOnlySVorPV
                                      ? "text-right font-mono"
                                      : ""
                                  }
                                >
                                  {isReadOnlySVorPV ? (
                                    <span
                                      className={
                                        Number(l.credit || 0) > 0
                                          ? "font-semibold text-slate-800 dark:text-slate-200"
                                          : "text-slate-400"
                                      }
                                    >
                                      {Number(l.credit || 0) > 0
                                        ? `GH₵ ${Number(l.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : "-"}
                                    </span>
                                  ) : (
                                    <input
                                      className="input text-right"
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={l.credit || ""}
                                      onChange={(e) =>
                                        updateLine(idx, {
                                          credit: e.target.value,
                                          debit: 0,
                                        })
                                      }
                                      onFocus={() => {
                                        const v = String(l.credit ?? "");
                                        if (v === "0") {
                                          updateLine(idx, { credit: "" });
                                        }
                                      }}
                                      disabled={readOnly}
                                    />
                                  )}
                                </td>
                                <td>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                                      onClick={() => removeLine(idx)}
                                      disabled={readOnly}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <div className="w-72 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Total Debit</span>
                          <span>{`GH₵ ${totals.debit.toFixed(2)}`}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Total Credit</span>
                          <span>{`GH₵ ${totals.credit.toFixed(2)}`}</span>
                        </div>
                        <div
                          className={`flex justify-between text-sm font-semibold ${
                            balanced
                              ? "text-green-700 dark:text-green-300"
                              : "text-red-700 dark:text-red-300"
                          }`}
                        >
                          <span>Status</span>
                          <span>{balanced ? "Balanced" : "Not Balanced"}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => window.history.back()} className="btn-success">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    (!(isPAYV && paymentType === "DIRECT") && !balanced)
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Receipt Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                  className="text-white hover:text-slate-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">
                  Document No:{" "}
                  <span className="font-semibold">
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
                >
                  {submittingForward ? "Forwarding..." : "Forward"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  if (isRV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Record incoming payments</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Back
                </button>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                ) : (
                  <></>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card mb-4">
            <div className="card-body">
              <div className="flex justify-center">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${paymentType === "AGAINST_BILL" ? "bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}
                    onClick={() => setPaymentType("AGAINST_BILL")}
                    disabled={readOnly}
                  >
                    Receipt Against Invoice
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${paymentType === "DIRECT" ? "bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}
                    onClick={() => setPaymentType("DIRECT")}
                    disabled={readOnly}
                  >
                    Direct Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPAYV || isRV) && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={rvVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input md:w-64"
                    value={voucherNoPreview || "RV-000001"}
                    disabled
                  />
                </div>
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className={`input ${disabledClass}`}
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {!(isPAYV || isRV) && (
                  <div>
                    <label className="label">Fiscal Year *</label>
                    <select
                      className={`input ${disabledClass}`}
                      value={fiscalYearId}
                      onChange={(e) => setFiscalYearId(e.target.value)}
                      required
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:w-64">
                  <label className="label">Received From</label>
                  <div className="relative">
                    <input
                      className={`input ${disabledClass}`}
                      placeholder="Type to search accounts"
                      value={receivedFromSearch || rvForm.receivedFrom || ""}
                      onChange={(e) => {
                        setReceivedFromSearch(e.target.value);
                        if (!e.target.value) {
                          updateRvForm({
                            receivedFrom: "",
                            receivedFromCode: "",
                            payerAccountId: "",
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          receivedFromSearchResults.length
                        ) {
                          const selected = receivedFromSearchResults[0];
                          const acc = accounts.find(
                            (a) => String(a.id) === selected.value,
                          );
                          if (acc) {
                            setReceivedFromSearch("");
                            updateRvForm({
                              receivedFrom: String(acc.name || ""),
                              receivedFromCode: String(acc.code || ""),
                              payerAccountId: String(acc.id || ""),
                              items:
                                rvForm.items.length === 0 ||
                                (rvForm.items.length === 1 &&
                                  !rvForm.items[0].accountId)
                                  ? [
                                      {
                                        description: "",
                                        accountId: acc.id,
                                        amount: "",
                                        referenceNo: "",
                                        currencyCode: getAccountCurrencyCode(
                                          acc.id,
                                        ),
                                        exchangeRate: "1",
                                      },
                                    ]
                                  : [
                                      ...rvForm.items,
                                      {
                                        description: "",
                                        accountId: acc.id,
                                        amount: "",
                                        referenceNo: "",
                                        currencyCode: getAccountCurrencyCode(
                                          acc.id,
                                        ),
                                        exchangeRate: "1",
                                      },
                                    ],
                            });
                          }
                        }
                      }}
                      disabled={readOnly}
                    />
                    {receivedFromSearch &&
                      receivedFromSearchResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                          {receivedFromSearchResults.map((o) => (
                            <button
                              type="button"
                              key={o.value}
                              className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                              onClick={() => {
                                const acc = accounts.find(
                                  (a) => String(a.id) === o.value,
                                );
                                if (acc) {
                                  setReceivedFromSearch("");
                                  updateRvForm({
                                    receivedFrom: String(acc.name || ""),
                                    receivedFromCode: String(acc.code || ""),
                                    payerAccountId: String(acc.id || ""),
                                    items:
                                      rvForm.items.length === 0 ||
                                      (rvForm.items.length === 1 &&
                                        !rvForm.items[0].accountId)
                                        ? [
                                            {
                                              description: "",
                                              accountId: acc.id,
                                              amount: "",
                                              referenceNo: "",
                                              currencyCode:
                                                getAccountCurrencyCode(acc.id),
                                              exchangeRate: "1",
                                            },
                                          ]
                                        : [
                                            ...rvForm.items,
                                            {
                                              description: "",
                                              accountId: acc.id,
                                              amount: "",
                                              referenceNo: "",
                                              currencyCode:
                                                getAccountCurrencyCode(acc.id),
                                              exchangeRate: "1",
                                            },
                                          ],
                                  });
                                }
                              }}
                            >
                              {o.label} {o.code ? `(${o.code})` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                  {rvForm.receivedFrom && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Selected:{" "}
                      <span className="font-medium">{rvForm.receivedFrom}</span>
                    </div>
                  )}
                </div>
                <div className="md:w-64">
                  <label className="label">Payment Method</label>
                  <select
                    className={`input md:w-64 ${disabledClass}`}
                    value={rvForm.paymentMethod}
                    onChange={(e) =>
                      updateRvForm({ paymentMethod: e.target.value })
                    }
                    disabled={readOnly}
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                    <option>Mobile Money</option>
                  </select>
                </div>
                {rvIsBankLike ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className={`input ${disabledClass}`}
                          value={rvForm.reference}
                          onChange={(e) =>
                            updateRvForm({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className={`input ${disabledClass}`}
                          type="date"
                          value={rvForm.chequeDate || ""}
                          onChange={(e) =>
                            updateRvForm({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:w-64">
                  <div className="flex justify-between items-center">
                    <label className="label">Deposit Account *</label>
                    <span className="text-xs text-slate-500">
                      {depositAccountCurrencyCode || ""}
                    </span>
                  </div>
                  <select
                    className={`input md:w-64 ${disabledClass}`}
                    value={rvForm.depositAccountId}
                    onChange={(e) => {
                      const accountId = e.target.value;
                      const acc = accounts.find(
                        (a) => String(a.id) === String(accountId),
                      );
                      updateRvForm({
                        depositAccountId: accountId,
                        currencyId: acc?.currency_id || null,
                      });
                    }}
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {accounts
                      .filter((a) => {
                        const gc = String(a.group_code || "").toUpperCase();
                        const gn = String(a.group_name || "").toUpperCase();
                        return rvIsBankLike
                          ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
                          : gc === "AST_CASH" ||
                              gn === "CASH AND CASH EQUIVALENTS";
                      })
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label">Balance</label>
                  <input
                    className="input bg-slate-50 dark:bg-slate-800"
                    value={
                      rvForm.depositAccountId
                        ? accountBalances[String(rvForm.depositAccountId)] !==
                          undefined
                          ? Number(
                              accountBalances[String(rvForm.depositAccountId)],
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "Loading..."
                        : "-"
                    }
                    disabled
                  />
                </div>
                {paymentType === "AGAINST_BILL" ? (
                  <div className="md:w-64">
                    <label className="label">Outstanding Invoices</label>
                    <select
                      className={`input md:w-64 ${disabledClass}`}
                      value={selectedInvoiceRefs[0] || ""}
                      onChange={(e) => {
                        const selectedRef = String(e.target.value || "");
                        const chosenList = customerInvoices.filter(
                          (inv) => String(inv.invoice_no) === selectedRef,
                        );
                        setSelectedInvoiceRefs(
                          selectedRef ? [selectedRef] : [],
                        );
                        const items =
                          chosenList.length > 0
                            ? chosenList.map((inv) => ({
                                description: "",
                                accountId: rvForm.payerAccountId || "",
                                amount: Number(inv.balance_amount || 0),
                                referenceNo: String(inv.invoice_no),
                                currencyCode: getAccountCurrencyCode(
                                  rvForm.payerAccountId,
                                ),
                                exchangeRate: "1",
                              }))
                            : [
                                {
                                  description: "",
                                  accountId: rvForm.payerAccountId || "",
                                  amount: 0,
                                  referenceNo: "",
                                  currencyCode: getAccountCurrencyCode(
                                    rvForm.payerAccountId,
                                  ),
                                  exchangeRate: "1",
                                },
                              ];
                        const firstTaxCodeId =
                          chosenList.length > 0
                            ? chosenList[0].tax_code_id || null
                            : null;
                        updateRvForm({
                          items,
                          ...(firstTaxCodeId
                            ? { taxCodeId: String(firstTaxCodeId) }
                            : {}),
                        });
                      }}
                      disabled={readOnly}
                    >
                      <option value="">Select invoice</option>
                      {customerInvoices.map((inv) => (
                        <option key={inv.id} value={inv.invoice_no}>
                          {inv.invoice_no} - Outstanding{" "}
                          {Number(inv.balance_amount || 0).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                          {inv.payment_status
                            ? ` (${String(inv.payment_status).replace(/_/g, " ")})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="md:w-64">
                  <label className="label">Currency</label>
                  <input
                    className="input md:w-64 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                    value={depositAccountCurrencyCode || ""}
                    readOnly
                  />
                </div>
                <div className="md:w-64">
                  <label className="label">Exchange Rate</label>
                  <input
                    className="input md:w-64 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                    value={rvExchangeRate || ""}
                    readOnly
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                {isCN || isDN ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="label">Exchange Rate</label>
                      <input
                        className="input"
                        value={dncnExchangeRate || ""}
                        readOnly
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Payment Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th className="w-[24rem]">Description</th>
                        <th className="w-[32rem]">Account</th>
                        <th className="text-right w-32">Currency</th>
                        <th className="text-right w-24">Exch. Rate</th>
                        <th className="text-right w-[16rem]">Amount</th>
                        <th className="w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={7}>
                            No items.{" "}
                            <button
                              type="button"
                              className="text-brand hover:text-brand-700 font-medium"
                              onClick={() => addRvItem()}
                            >
                              Add first item
                            </button>
                          </td>
                        </tr>
                      ) : (
                        rvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={`input ${disabledClass}`}
                                value={it.description || ""}
                                onChange={(e) =>
                                  updateRvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                required
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <select
                                  className={`input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold ${disabledClass} flex-1`}
                                  value={it.accountId}
                                  onChange={async (e) => {
                                    const accountId = e.target.value;
                                    const accountCurrency =
                                      getAccountCurrencyCode(accountId);
                                    const exchangeRate =
                                      await resolveExchangeRateForCurrency(
                                        accountCurrency,
                                      );
                                    updateRvItem(idx, {
                                      accountId,
                                      currencyCode: accountCurrency,
                                      exchangeRate,
                                    });
                                    if (idx === 0) {
                                      const acc = accounts.find(
                                        (a) =>
                                          String(a.id) === String(accountId),
                                      );
                                      const code = acc?.code
                                        ? String(acc.code)
                                        : "";
                                      const entry = payees.find(
                                        (p) => String(p.code) === String(code),
                                      );
                                      const name = entry?.name || "";
                                      updateRvForm({
                                        receivedFrom: name,
                                        receivedFromCode: code,
                                        payerAccountId: String(accountId || ""),
                                      });
                                      setSelectedInvoiceRefs([]);
                                    }
                                  }}
                                  required
                                  disabled={readOnly}
                                >
                                  <option value="">Select account</option>
                                  {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                                {it.accountId && (
                                  <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {getAccountCurrencyCode(it.accountId)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-right">
                              <select
                                className={`input text-right ${disabledClass}`}
                                value={getRvItemCurrencyCode(it)}
                                onChange={async (e) => {
                                  const currencyCode = String(
                                    e.target.value || "",
                                  ).toUpperCase();
                                  const exchangeRate =
                                    await resolveExchangeRateForCurrency(
                                      currencyCode,
                                    );
                                  updateRvItem(idx, {
                                    currencyCode,
                                    exchangeRate,
                                  });
                                }}
                                disabled={readOnly}
                              >
                                <option value="">Select currency</option>
                                {currencies.map((c) => {
                                  const code = String(
                                    c.code || c.currency_code || "",
                                  ).toUpperCase();
                                  return (
                                    <option key={c.id || code} value={code}>
                                      {code}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td className="text-right">
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="any"
                                value={getRvItemExchangeRateValue(it, idx)}
                                onChange={(e) =>
                                  updateRvItem(idx, {
                                    exchangeRate: String(e.target.value || ""),
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="any"
                                value={it.amount || ""}
                                onChange={(e) =>
                                  updateRvItem(idx, {
                                    amount: e.target.value,
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updateRvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <div className="flex gap-2">
                                {!readOnly && (
                                  <>
                                    <button
                                      type="button"
                                      className="text-green-600 hover:text-green-700 p-1"
                                      onClick={() => addRvItem()}
                                      title="Add item"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v8" />
                                        <path d="M8 12h8" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-700 p-1"
                                      onClick={() => removeRvItem(idx)}
                                      title="Remove item"
                                      disabled={rvForm.items.length <= 1}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M8 12h8" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {paymentType === "DIRECT" ? (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rvIsTaxIncluded}
                            onChange={(e) => {
                              const checked = Boolean(e.target.checked);
                              setRvIsTaxIncluded(checked);
                              if (!checked) updateRvForm({ taxCodeId: "" });
                            }}
                            disabled={readOnly}
                          />
                          <span>Is Tax Included</span>
                        </label>
                        {rvIsTaxIncluded ? (
                          <select
                            className={`input ${disabledClass}`}
                            value={rvForm.taxCodeId || ""}
                            onChange={(e) =>
                              updateRvForm({ taxCodeId: e.target.value })
                            }
                            disabled={readOnly}
                          >
                            <option value="">Select tax code</option>
                            {taxCodes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name || t.tax_name || t.code}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">
                        Total Amount {rvSummaryCurrencyCode || baseCurrencyCode}
                      </span>
                      <span className="font-bold">
                        {Number(totals.grand || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">
                        Total Amount in {baseCurrencyCode || "GHS"}
                      </span>
                      <span className="font-bold">
                        {Number(rvTotalInBaseCurrency || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {paymentType === "DIRECT" ? (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Posting Lines
                    </div>
                    <button
                      type="button"
                      className="text-green-600 hover:text-green-700 p-1"
                      onClick={addLine}
                      title="Add Line"
                      disabled={readOnly}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8" />
                        <path d="M8 12h8" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Description</th>
                          <th className="text-right">Debit</th>
                          <th className="text-right">Credit</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                className="input"
                                value={l.accountId}
                                onChange={(e) =>
                                  updateLine(idx, { accountId: e.target.value })
                                }
                                required
                                disabled={readOnly}
                              >
                                <option value="">Select account</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                value={l.description}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Line memo"
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="any"
                                value={l.debit || ""}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    debit: String(e.target.value || "").replace(
                                      /^0+(?=\d)/,
                                      "",
                                    ),
                                    credit: 0,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="any"
                                value={l.credit || ""}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    credit: String(
                                      e.target.value || "",
                                    ).replace(/^0+(?=\d)/, ""),
                                    debit: 0,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              {!readOnly && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-700 p-1"
                                  onClick={() => removeLine(idx)}
                                  title="Remove Line"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M8 12h8" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="w-72 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Total Debit</span>
                        <span>{`GH₵ ${totals.debit.toFixed(2)}`}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Credit</span>
                        <span>{`GH₵ ${totals.credit.toFixed(2)}`}</span>
                      </div>
                      <div
                        className={`flex justify-between text-sm font-semibold ${balanced ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
                      >
                        <span>Status</span>
                        <span>{balanced ? "Balanced" : "Not Balanced"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className="input h-24"
                  value={rvForm.notes}
                  onChange={(e) => updateRvForm({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !rvForm.depositAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Contra Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                  className="text-white hover:text-slate-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">
                  Document No:{" "}
                  <span className="font-semibold">
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
                >
                  {submittingForward ? "Forwarding..." : "Forward"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  if (isPAYV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Record outgoing payments</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Back
                </button>
                {voucherStatus === "APPROVED" ? (
                  <span className="px-2 py-1 rounded bg-green-500 text-white text-sm font-medium">
                    Approved
                  </span>
                ) : (
                  <></>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card mb-4">
            <div className="card-body">
              <div className="flex justify-center">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${paymentType === "AGAINST_BILL" ? "bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}
                    onClick={() => {
                      setPaymentType("AGAINST_BILL");
                      // Load outstanding bills when switching to this mode
                      if (pvForm.payToAccountId) {
                        loadOutstandingBillsForSupplier(pvForm.payToAccountId);
                      }
                    }}
                    disabled={readOnly}
                  >
                    Payment Against Bill
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${paymentType === "DIRECT" ? "bg-white dark:bg-slate-700 shadow text-brand-600 dark:text-brand-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"}`}
                    onClick={() => {
                      setPaymentType("DIRECT");
                      setOutstandingBills([]);
                      setSelectedBillId("");
                      setSelectedBillDetails(null);
                    }}
                    disabled={readOnly}
                  >
                    Direct Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {!(isPAYV || isRV) && (
                  <div>
                    <label className="label">Voucher Type</label>
                    <input
                      className="input"
                      value={pvVoucherTypeName}
                      disabled
                    />
                  </div>
                )}
                <div>
                  <label className="label">Voucher No</label>
                  <input
                    className="input md:w-64"
                    value={voucherNoPreview || "PV-000000"}
                    disabled
                  />
                </div>
                <div className="md:w-64">
                  <label className="label">Voucher Date *</label>
                  <input
                    className="input md:w-64"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                {(isDN || isCN) && (
                  <div className="md:col-span-3">
                    <label className="label font-bold text-brand">
                      Description *
                    </label>
                    <input
                      className={`input border-2 border-brand/20 focus:border-brand ${disabledClass}`}
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="Mandatory description for all transactions"
                      required
                      disabled={readOnly}
                    />
                  </div>
                )}
                {!(isPAYV || isRV) && (
                  <div>
                    <label className="label">Fiscal Year *</label>
                    <select
                      className="input"
                      value={fiscalYearId}
                      onChange={(e) => setFiscalYearId(e.target.value)}
                      required
                      disabled={readOnly}
                    >
                      <option value="">Select</option>
                      {fiscalYears.map((fy) => (
                        <option key={fy.id} value={fy.id}>
                          {fy.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:w-64">
                  <label className="label">Paid To</label>
                  <div className="relative">
                    <input
                      className={`input md:w-64 ${disabledClass}`}
                      placeholder="Type to search accounts"
                      value={paidToSearch || pvForm.payTo || ""}
                      onChange={(e) => {
                        setPaidToSearch(e.target.value);
                        if (!e.target.value) {
                          updatePv({
                            payTo: "",
                            payToCode: "",
                            payToAccountId: "",
                          });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && paidToSearchResults.length) {
                          const selected = paidToSearchResults[0];
                          const acc = accounts.find(
                            (a) => String(a.id) === selected.value,
                          );
                          if (acc) {
                            const accountCurrency =
                              acc?.currency_code || acc?.currency || "";
                            setPaidToSearch("");
                            updatePv({
                              payTo: String(acc.name || ""),
                              payToCode: String(acc.code || ""),
                              payToAccountId: String(acc.id || ""),
                              items:
                                pvForm.items.length === 0 ||
                                (pvForm.items.length === 1 &&
                                  !pvForm.items[0].accountId)
                                  ? [
                                      {
                                        description: "",
                                        accountId: acc.id,
                                        amount: 0,
                                        currencyCode: accountCurrency,
                                      },
                                    ]
                                  : [
                                      ...pvForm.items,
                                      {
                                        description: "",
                                        accountId: acc.id,
                                        amount: 0,
                                        currencyCode: accountCurrency,
                                      },
                                    ],
                            });
                          }
                        }
                      }}
                      disabled={readOnly}
                    />
                    {paidToSearch && paidToSearchResults.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {paidToSearchResults.map((o) => (
                          <button
                            type="button"
                            key={o.value}
                            className="block w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                            onClick={() => {
                              const acc = accounts.find(
                                (a) => String(a.id) === o.value,
                              );
                              if (acc) {
                                const accountCurrency =
                                  acc?.currency_code || acc?.currency || "";
                                setPaidToSearch("");
                                updatePv({
                                  payTo: String(acc.name || ""),
                                  payToCode: String(acc.code || ""),
                                  payToAccountId: String(acc.id || ""),
                                  items:
                                    pvForm.items.length === 0 ||
                                    (pvForm.items.length === 1 &&
                                      !pvForm.items[0].accountId)
                                      ? [
                                          {
                                            description: "",
                                            accountId: acc.id,
                                            amount: 0,
                                            currencyCode: accountCurrency,
                                          },
                                        ]
                                      : [
                                          ...pvForm.items,
                                          {
                                            description: "",
                                            accountId: acc.id,
                                            amount: 0,
                                            currencyCode: accountCurrency,
                                          },
                                        ],
                                });
                              }
                            }}
                          >
                            {o.label} {o.code ? `(${o.code})` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {pvForm.payTo && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Selected:{" "}
                      <span className="font-medium">{pvForm.payTo}</span>
                    </div>
                  )}
                </div>
                <div className="md:w-64">
                  <label className="label">Payment Method</label>
                  <select
                    className={`input md:w-64 ${disabledClass}`}
                    value={pvForm.paymentMethod}
                    onChange={(e) =>
                      updatePv({ paymentMethod: e.target.value })
                    }
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                    <option>Mobile Money</option>
                  </select>
                </div>
                {isChequeLike ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className={`input md:w-64 ${disabledClass}`}
                          value={pvForm.reference}
                          onChange={(e) =>
                            updatePv({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className={`input md:w-64 ${disabledClass}`}
                          type="date"
                          value={pvForm.chequeDate || ""}
                          onChange={(e) =>
                            updatePv({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:w-64">
                    <label className="label">Payment Account *</label>
                    <select
                      className={`input md:w-64 ${disabledClass}`}
                      value={pvForm.paymentAccountId}
                      onChange={(e) => {
                        const accountId = e.target.value;
                        const acc = accounts.find(
                          (a) => String(a.id) === String(accountId),
                        );
                        updatePv({
                          paymentAccountId: accountId,
                          currencyId: acc?.currency_id || null,
                        });
                      }}
                      required
                    >
                      <option value="">Select account</option>
                      {accounts
                        .filter((a) => {
                          const gc = String(a.group_code || "").toUpperCase();
                          const gn = String(a.group_name || "").toUpperCase();
                          return isChequeLike
                            ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
                            : gc === "AST_CASH" ||
                                gn === "CASH AND CASH EQUIVALENTS";
                        })
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="md:w-64">
                    <label className="label">Balance</label>
                    <input
                      className="input md:w-64 bg-slate-50 dark:bg-slate-800 text-right"
                      value={
                        pvForm.paymentAccountId
                          ? accountBalances[String(pvForm.paymentAccountId)] !==
                              undefined &&
                            accountBalances[String(pvForm.paymentAccountId)] !==
                              null
                            ? Number(
                                accountBalances[
                                  String(pvForm.paymentAccountId)
                                ],
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"
                          : "-"
                      }
                      disabled
                    />
                  </div>
                  <div className="md:w-32">
                    <label className="label">Currency</label>
                    <input
                      className={`input md:w-32 ${disabledClass}`}
                      value={effectivePaymentCurrencyCode}
                      onChange={(e) =>
                        setPvCurrencyCodeOverride(e.target.value)
                      }
                      disabled={readOnly}
                    />
                  </div>
                  <div className="md:w-32">
                    <label className="label">Exch Rate</label>
                    <input
                      className={`input md:w-32 ${disabledClass}`}
                      value={pvExchangeRate || ""}
                      onChange={(e) => setPvExchangeRate(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>

              {isPAYV && paymentType === "AGAINST_BILL" && (
                <div className="space-y-3 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:w-96">
                      <label className="label">Outstanding Bills</label>
                      <select
                        className={`input md:w-96 ${disabledClass}`}
                        value={selectedBillId}
                        onChange={(e) => {
                          const billId = e.target.value;
                          setSelectedBillId(billId);
                          const bill = outstandingBills.find(
                            (b) => String(b.id) === String(billId),
                          );
                          setSelectedBillDetails(bill || null);
                          // Auto-populate amount if bill is selected
                          if (bill && bill.net_amount) {
                            updatePv({
                              items: [
                                {
                                  description: `Payment for Bill ${bill.bill_no}`,
                                  accountId: pvForm.payToAccountId || "",
                                  amount: Number(
                                    bill.balance_amount || bill.net_amount || 0,
                                  ),
                                  exchangeRate: "1",
                                  currencyCode: effectivePaymentCurrencyCode,
                                },
                              ],
                            });
                          }
                        }}
                        disabled={
                          readOnly ||
                          loadingBills ||
                          outstandingBills.length === 0
                        }
                      >
                        <option value="">
                          {loadingBills
                            ? "Loading bills..."
                            : outstandingBills.length === 0
                              ? "No outstanding bills"
                              : "Select outstanding bill"}
                        </option>
                        {outstandingBills.map((bill) => (
                          <option key={bill.id} value={bill.id}>
                            {bill.bill_no} - {bill.net_amount?.toLocaleString()}{" "}
                            ({bill.payment_status})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedBillDetails && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded p-3 text-sm">
                        <div className="font-medium">Bill Details</div>
                        <div>
                          Total:{" "}
                          {selectedBillDetails.net_amount?.toLocaleString()}
                        </div>
                        <div>
                          Balance:{" "}
                          {selectedBillDetails.balance_amount?.toLocaleString() ||
                            selectedBillDetails.net_amount?.toLocaleString()}
                        </div>
                        <div>Status: {selectedBillDetails.payment_status}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Payment Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th className="w-[72rem]">Description</th>
                        <th className="w-[64rem]">Account</th>
                        <th className="text-right w-32">Currency</th>
                        <th className="text-right w-16">Exchange Rate</th>
                        <th className="text-right w-[40rem]">Amount</th>
                        <th className="w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={7}>
                            No items
                          </td>
                        </tr>
                      ) : (
                        pvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={`input ${disabledClass}`}
                                value={it.description || ""}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                required
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <select
                                  className={`input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold ${disabledClass} flex-1`}
                                  value={it.accountId}
                                  onChange={(e) => {
                                    const selectedAccountId = e.target.value;
                                    const selectedAcc = accounts.find(
                                      (a) =>
                                        String(a.id) ===
                                        String(selectedAccountId),
                                    );
                                    const accountCurrency =
                                      selectedAcc?.currency_code ||
                                      selectedAcc?.currency ||
                                      "";
                                    updatePvItem(idx, {
                                      accountId: selectedAccountId,
                                      currencyCode: accountCurrency,
                                    });
                                  }}
                                  required
                                  disabled={readOnly}
                                >
                                  <option value="">Select account</option>
                                  {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                                {it.accountId && (
                                  <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {accounts.find(
                                      (a) =>
                                        String(a.id) === String(it.accountId),
                                    )?.currency_code || ""}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <select
                                className={`input text-right ${disabledClass}`}
                                value={
                                  it.currencyCode ||
                                  effectivePaymentCurrencyCode ||
                                  "USD"
                                }
                                onChange={async (e) => {
                                  const selectedCurrency = e.target.value;
                                  const baseCurrencyCode =
                                    baseCurrency?.code || "GHS";

                                  // If different from base currency, fetch exchange rate
                                  let exchangeRate = "1";
                                  if (
                                    selectedCurrency &&
                                    selectedCurrency !== baseCurrencyCode
                                  ) {
                                    try {
                                      const rate = await getExchangeRate(
                                        selectedCurrency,
                                        baseCurrencyCode,
                                      );
                                      if (rate) {
                                        exchangeRate = String(rate);
                                      }
                                    } catch (err) {
                                      console.warn(
                                        "Failed to fetch exchange rate:",
                                        err,
                                      );
                                    }
                                  }

                                  updatePvItem(idx, {
                                    currencyCode: selectedCurrency,
                                    exchangeRate: exchangeRate,
                                  });
                                }}
                                disabled={readOnly}
                              >
                                {currencies.map((c) => (
                                  <option key={c.id} value={c.code}>
                                    {c.code}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="any"
                                value={it.exchangeRate || pvExchangeRate || "1"}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    exchangeRate: String(e.target.value || ""),
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className={`input text-right ${disabledClass}`}
                                type="number"
                                min="0"
                                step="any"
                                value={it.amount || ""}
                                onChange={(e) =>
                                  updatePvItem(idx, {
                                    amount: Number(e.target.value || 0),
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updatePvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <div className="flex gap-2">
                                {!readOnly && (
                                  <>
                                    <button
                                      type="button"
                                      className="text-green-600 hover:text-green-700 p-1"
                                      onClick={() => addPvItem()}
                                      title="Add item"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v8" />
                                        <path d="M8 12h8" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-700 p-1"
                                      onClick={() => removePvItem(idx)}
                                      title="Remove item"
                                      disabled={pvForm.items.length <= 1}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M8 12h8" />
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {paymentType === "DIRECT" ? (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pvIsTaxIncluded}
                            onChange={(e) => {
                              const checked = Boolean(e.target.checked);
                              setPvIsTaxIncluded(checked);
                              if (!checked) updatePv({ taxCodeId: "" });
                            }}
                            disabled={readOnly}
                          />
                          <span>Is Tax Included</span>
                        </label>
                        {pvIsTaxIncluded ? (
                          <select
                            className={`input ${disabledClass}`}
                            value={pvForm.taxCodeId || ""}
                            onChange={(e) =>
                              updatePv({ taxCodeId: e.target.value })
                            }
                            disabled={readOnly}
                          >
                            <option value="">Select tax code</option>
                            {taxCodes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name || t.tax_name || t.code}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">
                        TOTAL AMOUNT {effectivePaymentCurrencyCode || "USD"}
                      </span>
                      <span className="font-bold">
                        {Number(totals.grand || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {Number(pvExchangeRate || 1) !== 1 && (
                      <div className="flex justify-between">
                        <span className="font-semibold">
                          AMOUNT in {baseCurrency?.code || "USD"}
                        </span>
                        <span className="font-bold">
                          {Number(pvAmountInBase || 0).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {paymentType === "DIRECT" ? (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      Posting Lines
                    </div>
                    <button
                      type="button"
                      className="text-green-600 hover:text-green-700 p-1"
                      onClick={addLine}
                      title="Add Line"
                      disabled={readOnly}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8" />
                        <path d="M8 12h8" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th className="w-64">Account</th>
                          <th>Description</th>
                          <th className="text-right w-32">Currency</th>
                          <th className="text-right w-40">Debit</th>
                          <th className="text-right w-40">Credit</th>
                          <th className="w-20" />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                className="input"
                                value={l.accountId}
                                onChange={(e) =>
                                  updateLine(idx, { accountId: e.target.value })
                                }
                                required
                                disabled={readOnly}
                              >
                                <option value="">Select account</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                value={l.description}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Line memo"
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <select
                                className="input text-right"
                                value={
                                  l.currencyCode ||
                                  effectivePaymentCurrencyCode ||
                                  "USD"
                                }
                                onChange={(e) =>
                                  updateLine(idx, {
                                    currencyCode: e.target.value,
                                  })
                                }
                                disabled={readOnly}
                              >
                                {currencies.map((c) => (
                                  <option key={c.id} value={c.code}>
                                    {c.code}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="any"
                                value={l.debit || ""}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    debit: String(e.target.value || "").replace(
                                      /^0+(?=\d)/,
                                      "",
                                    ),
                                    credit: 0,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="any"
                                value={l.credit || ""}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    credit: String(
                                      e.target.value || "",
                                    ).replace(/^0+(?=\d)/, ""),
                                    debit: 0,
                                  })
                                }
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              {!readOnly && (
                                <button
                                  type="button"
                                  className="text-red-600 hover:text-red-700 p-1"
                                  onClick={() => removeLine(idx)}
                                  title="Remove Line"
                                  disabled={lines.length <= 1}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M8 12h8" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="w-72 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Total Debit</span>
                        <span>{`${effectivePaymentCurrencyCode || baseCurrency?.code || "GH₵"} ${totals.debit.toFixed(2)}`}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Credit</span>
                        <span>{`${effectivePaymentCurrencyCode || baseCurrency?.code || "GH₵"} ${totals.credit.toFixed(2)}`}</span>
                      </div>
                      <div
                        className={`flex justify-between text-sm font-semibold ${balanced ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
                      >
                        <span>Status</span>
                        <span>{balanced ? "Balanced" : "Not Balanced"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className={`input h-24 ${disabledClass}`}
                  value={pvForm.notes}
                  onChange={(e) => updatePv({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !pvForm.paymentAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Payment Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                  className="text-white hover:text-slate-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">
                  Document No:{" "}
                  <span className="font-semibold">
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
                >
                  {submittingForward ? "Forwarding..." : "Forward"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  if (isCV) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex justify-between items-center text-white">
              <div>
                <h1 className="text-2xl font-bold dark:text-brand-300">
                  {title}
                </h1>
                <p className="text-sm mt-1">Transfer funds between accounts</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Back
                </button>
               </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Voucher Date *</label>
                  <input
                    className="input"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    required
                    disabled={readOnly}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description *</label>
                  <input
                    className={`input ${disabledClass}`}
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Mandatory description for all lines"
                    required
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">From Account *</label>
                  <select
                    className="input"
                    value={cvForm.fromAccountId}
                    onChange={(e) =>
                      updateCv({ fromAccountId: e.target.value })
                    }
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {cvSelectableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <label className="label">Currency</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={cvFromCurrencyCode || ""}
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <label className="label">To Account *</label>
                  <select
                    className="input"
                    value={cvForm.toAccountId}
                    onChange={(e) => updateCv({ toAccountId: e.target.value })}
                    required
                    disabled={readOnly}
                  >
                    <option value="">Select account</option>
                    {cvSelectableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <label className="label">Currency</label>
                    <input
                      className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                      value={cvToCurrencyCode || ""}
                      readOnly
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Transfer Method</label>
                  <select
                    className="input"
                    value={cvForm.transferMethod}
                    onChange={(e) =>
                      updateCv({ transferMethod: e.target.value })
                    }
                    disabled={readOnly}
                  >
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Bank Transfer</option>
                  </select>
                </div>
                {cvHasBankAccount ? (
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Reference / Cheque No</label>
                        <input
                          className="input"
                          value={cvForm.reference}
                          onChange={(e) =>
                            updateCv({ reference: e.target.value })
                          }
                          placeholder="Reference Number or Cheque Number"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Date</label>
                        <input
                          className="input"
                          type="date"
                          value={cvForm.chequeDate || ""}
                          onChange={(e) =>
                            updateCv({ chequeDate: e.target.value })
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="label">Reference / Instrument No</label>
                    <input
                      className="input"
                      value={cvForm.reference}
                      onChange={(e) => updateCv({ reference: e.target.value })}
                      placeholder="Reference Number"
                      disabled={readOnly}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Exchange Rate</label>
                  <input
                    className="input bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
                    value={cvExchangeRate || ""}
                    readOnly
                  />
                </div>
                <div>
                  <label className="label">Tax Code</label>
                  <select
                    className="input"
                    value={cvForm.taxCodeId}
                    onChange={(e) => updateCv({ taxCodeId: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">None</option>
                    {taxCodes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Transfer Details
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>Description</th>
                        <th className="text-right w-40">Amount to Transfer</th>
                        <th className="w-24 hidden" />
                      </tr>
                    </thead>
                    <tbody>
                      {cvForm.items.length === 0 ? (
                        <tr>
                          <td className="text-center p-2" colSpan={4}>
                            No items
                          </td>
                        </tr>
                      ) : (
                        cvForm.items.map((it, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className="input"
                                value={it.description || ""}
                                onChange={(e) =>
                                  updateCvItem(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                                required
                                disabled={readOnly}
                              />
                            </td>
                            <td>
                              <input
                                className="input text-right"
                                type="number"
                                min="0"
                                step="any"
                                value={it.amount}
                                onChange={(e) =>
                                  updateCvItem(idx, {
                                    amount: Number(e.target.value || 0),
                                  })
                                }
                                onFocus={() => {
                                  if (Number(it.amount || 0) === 0) {
                                    updateCvItem(idx, { amount: "" });
                                  }
                                }}
                                disabled={readOnly}
                              />
                            </td>
                            <td className="hidden" />
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {Number(totals.subtotal || 0).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <span>
                          Tax (
                          {Number(
                            taxCodes.find(
                              (t) => String(t.id) === String(cvForm.taxCodeId),
                            )?.rate_percent || 0,
                          )}
                          %)
                        </span>
                      </div>
                      <span className="font-semibold">
                        {Number(totals.tax || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">TOTAL AMOUNT</span>
                      <span className="font-bold">
                        {Number(totals.grand || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Amount in Words</label>
                      <textarea
                        className="input h-20"
                        value={numberToWords(Number(totals.grand || 0))}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  className="input h-24"
                  value={cvForm.notes}
                  onChange={(e) => updateCv({ notes: e.target.value })}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button onClick={() => window.history.back()} className="btn-success">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-success"
                  disabled={
                    loading ||
                    readOnly ||
                    !balanced ||
                    !cvForm.fromAccountId ||
                    !cvForm.toAccountId ||
                    Number(totals.grand || 0) <= 0
                  }
                >
                  {loading ? "Saving..." : "Save Voucher"}
                </button>
              </div>
            </div>
          </div>
        </form>
        {showForwardModal ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
                <div className="font-semibold">
                  Forward Contra Voucher for Approval
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                  className="text-white hover:text-slate-200 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm text-slate-700">
                  Document No:{" "}
                  <span className="font-semibold">
                    {voucherNoPreview || "-"}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? candidateWorkflow.workflow_name
                      : "Auto"}
                  </span>
                </div>
                <div className="text-sm text-red-600">{wfError || ""}</div>
                <div>
                  {wfLoading ? (
                    <div className="text-slate-600">Loading workflows...</div>
                  ) : firstApprover &&
                    Array.isArray(firstApprover.approvers) ? (
                    <div>
                      <label className="label">Assign To</label>
                      <select
                        className="input"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(e.target.value || null)
                        }
                      >
                        <option value="">Select approver</option>
                        {firstApprover.approvers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  onClick={() => {
                    setShowForwardModal(false);
                    setCandidateWorkflow(null);
                    setFirstApprover(null);
                    setWfError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                  onClick={async () => {
                    if (!isEdit) return;
                    setSubmittingForward(true);
                    setWfError("");
                    try {
                      const res = await api.post(
                        `/finance/vouchers/${id}/submit`,
                        {
                          amount:
                            totals?.grand === "" || totals?.grand == null
                              ? null
                              : Number(totals?.grand || 0),
                          workflow_id: candidateWorkflow
                            ? candidateWorkflow.id
                            : null,
                          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
                      );
                      const newStatus = res?.data?.status || "PENDING_APPROVAL";
                      setVoucherStatus(newStatus);
                      setShowForwardModal(false);
                    } catch (e) {
                      setWfError(
                        e?.response?.data?.message ||
                          "Failed to forward for approval",
                      );
                    } finally {
                      setSubmittingForward(false);
                    }
                  }}
                  disabled={submittingForward || !isEdit}
                >
                  {submittingForward ? "Forwarding..." : "Forward"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="text-red-600 font-medium">
        Unsupported voucher type: {String(voucherTypeCode || "UNKNOWN")}
      </div>
    </div>
  );
}
