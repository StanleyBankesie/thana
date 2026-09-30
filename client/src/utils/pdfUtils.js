/**
 * @fileoverview Utility functions for generating, rendering, and printing PDFs.
 * Combines html2canvas and jsPDF for client-side PDF generation from HTML strings.
 */

/**
 * Checks if a rendered canvas page is effectively blank (mostly white).
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element to inspect.
 * @returns {boolean} True if the canvas is blank, false otherwise.
 */
function isPageBlank(canvas) {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const step = Math.max(1, Math.floor((canvas.width * canvas.height) / 2000));
  for (let i = 0; i < data.length; i += step * 4) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
}

/**
 * Waits for all images within a given DOM element to fully load.
 * @param {HTMLElement} el - The DOM element to search for images.
 * @returns {Promise<void>} A promise that resolves when all images are loaded or an error occurs.
 */
export async function waitForImagesIn(el) {
  const imgs = Array.from(el?.querySelectorAll?.("img") || []);
  if (!imgs.length) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

/**
 * Renders an HTML string into a downloadable PDF document.
 * Injects the HTML into a hidden iframe, converts it to a canvas, and saves via jsPDF.
 * 
 * @param {string} html - The raw HTML content to render.
 * @param {string} filename - The name of the output PDF file.
 */
export async function renderHtmlToPdf(html, filename = "document.pdf") {
  const { toast } = await import("react-toastify");
  const html2canvas = (await import("html2canvas")).default;
  const { default: jsPDF } = await import("jspdf");
  const toastId = toast.loading("Generating PDF, please wait...");

  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "10000px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) throw new Error("Could not create render context");

    doc.open();
    doc.write(html);
    doc.close();

    await waitForImagesIn(doc.body);

    const bodyEl = doc.body;
    bodyEl.style.height = "auto";

    const canvas = await html2canvas(bodyEl, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const pageH = (pdfH * canvas.width) / pdfW;
    let srcY = 0;
    let pg = 0;
    while (srcY < canvas.height) {
      const h = Math.min(canvas.height - srcY, pageH);
      const pc = document.createElement("canvas");
      pc.width = canvas.width;
      pc.height = h;
      pc.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      if (!isPageBlank(pc)) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, (h * pdfW) / canvas.width);
        pg++;
      }
      srcY += h;
    }

    if (pg === 0) pdf.addPage();
    pdf.save(filename);
    document.body.removeChild(iframe);

      toast.update(toastId, {
        render: "PDF downloaded successfully!",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.update(toastId, {
        render: err?.message || "Failed to generate PDF",
        type: "error",
        isLoading: false,
        autoClose: 4000,
      });
      throw err;
    }
  }

  export async function getHtmlToPdfBase64(html) {
    const html2canvas = (await import("html2canvas")).default;
    const { default: jsPDF } = await import("jspdf");
    
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "10000px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) throw new Error("Could not create render context");

    doc.open();
    doc.write(html);
    doc.close();

    await waitForImagesIn(doc.body);

    const bodyEl = doc.body;
    bodyEl.style.height = "auto";

    const canvas = await html2canvas(bodyEl, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const pageH = (pdfH * canvas.width) / pdfW;
    let srcY = 0;
    let pg = 0;
    while (srcY < canvas.height) {
      const h = Math.min(canvas.height - srcY, pageH);
      const pc = document.createElement("canvas");
      pc.width = canvas.width;
      pc.height = h;
      pc.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      if (!isPageBlank(pc)) {
        if (pg > 0) pdf.addPage();
        pdf.addImage(pc.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pdfW, (h * pdfW) / canvas.width);
        pg++;
      }
      srcY += h;
    }

    if (pg === 0) pdf.addPage();
    const base64Str = pdf.output("datauristring");
    document.body.removeChild(iframe);
    return base64Str;
  }
  
  /**
   * Renders the HTML template for a document by making a request to the server.
 * @param {Object} api - The axios/api instance.
 * @param {string} docType - The type of document to render.
 * @param {string|number} id - The ID of the document.
 * @param {string} [featureName] - Optional feature name.
 * @param {Function} [fetchDataFn] - Optional function to fetch payload data before rendering.
 * @returns {Promise<string>} The rendered HTML string.
 */
export async function renderDocumentHtml(api, docType, id, featureName, fetchDataFn) {
  let payload_data = null;
  if (typeof fetchDataFn === "function") {
    try {
      payload_data = await fetchDataFn();
    } catch (e) {
      console.warn("Failed to fetch full data payload before rendering:", e);
    }
  }

  const payload = { format: "html" };
  if (featureName) payload.feature_name = featureName;
  if (payload_data) payload.payload_data = payload_data;

  const resp = await api.post(
    `/documents/${docType}/${id}/render`,
    payload,
    { headers: { "Content-Type": "application/json" } },
  );
  return typeof resp.data === "string" ? resp.data : String(resp.data || "");
}

/**
 * Prints a document by rendering its HTML and opening a print dialog in a hidden iframe.
 * @param {Object} api - The axios/api instance.
 * @param {string} docType - The type of document to print.
 * @param {string|number} id - The ID of the document.
 * @param {Object} [toast] - Toast notification instance.
 * @param {string} [featureName] - Optional feature name.
 * @param {Function} [fetchDataFn] - Optional function to fetch payload data.
 */
export async function printDocument(api, docType, id, toast, featureName, fetchDataFn) {
  try {
    const html = await renderDocumentHtml(api, docType, id, featureName, fetchDataFn);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    const patchCss = `<style>@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
    doc.write(patchCss + html);
    doc.close();
    const win = iframe.contentWindow || window;
    const doPrint = () => {
      win.focus();
      try { win.print(); } catch {}
      setTimeout(() => { document.body.removeChild(iframe); }, 100);
    };
    setTimeout(doPrint, 200);
  } catch (err) {
    if (toast) {
      toast.error(err?.response?.data?.message || "Failed to print document");
    }
  }
}

/**
 * Downloads a document as a PDF by rendering its HTML and converting it to PDF.
 * @param {Object} api - The axios/api instance.
 * @param {string} docType - The type of document.
 * @param {string|number} id - The ID of the document.
 * @param {string} filename - The filename for the downloaded PDF.
 * @param {Object} [toast] - Toast notification instance.
 * @param {string} [featureName] - Optional feature name.
 * @param {Function} [fetchDataFn] - Optional function to fetch payload data.
 */
export async function downloadDocumentPdf(api, docType, id, filename, toast, featureName, fetchDataFn) {
  try {
    const html = await renderDocumentHtml(api, docType, id, featureName, fetchDataFn);
    await renderHtmlToPdf(html, filename);
  } catch (err) {
    console.error("PDF Download Error:", err);
    if (toast) {
      toast.error(err?.response?.data?.message || `Failed to download ${filename}`);
    }
  }
}

import stannessLogo from "../assets/logo_stanness.png";

let cachedReportHeader = null;
let cacheHeaderTime = 0;

/**
 * Fetches the active Report Header Template, Company info, and Base Currency.
 * @param {object} api - Axios API client instance
 * @returns {Promise<object>} Resolved header information
 */
export async function fetchReportHeader(api) {
  const now = Date.now();
  if (cachedReportHeader && now - cacheHeaderTime < 30000) {
    return cachedReportHeader;
  }

  let tpl = null;
  let co = null;
  let logoDataUrl = null;
  let currCode = "GHS";
  let currSymbol = "₵";

  if (api) {
    try {
      const [tplRes, cRes, curRes] = await Promise.allSettled([
        api.get("/templates/general-template"),
        api.get("/admin/companies/current"),
        api.get("/finance/currencies"),
      ]);

      if (tplRes.status === "fulfilled") {
        const list = Array.isArray(tplRes.value.data?.items)
          ? tplRes.value.data.items
          : Array.isArray(tplRes.value.data)
          ? tplRes.value.data
          : [];
        tpl = list.find((t) => t.is_default) || list[0] || null;
      }

      if (cRes.status === "fulfilled" && cRes.value.data?.item) {
        co = cRes.value.data.item;
        try {
          const logoRes = await api.get(`/admin/companies/${co.id}/logo`, {
            responseType: "blob",
          });
          const reader = new FileReader();
          logoDataUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(logoRes.data);
          });
        } catch {}
      }

      if (curRes.status === "fulfilled") {
        const list = Array.isArray(curRes.value.data?.items)
          ? curRes.value.data.items
          : Array.isArray(curRes.value.data)
          ? curRes.value.data
          : [];
        const base =
          list.find((c) => c.is_base || c.is_default || c.code === "GHS") ||
          list[0];
        if (base) {
          currCode = base.code || "GHS";
          currSymbol = base.symbol || "₵";
        }
      }
    } catch {}
  }

  const companyName = tpl?.header_name?.trim() || co?.name || "Seriana Mart";
  const companyAddress =
    tpl?.header_address?.trim() ||
    [co?.address, co?.city, co?.country].filter(Boolean).join(", ");
  const companyPhone =
    tpl?.header_phone?.trim() || co?.telephone || co?.phone || "";
  const companyEmail = tpl?.header_email?.trim() || co?.email || "";
  const logoUrl = tpl?.header_logo_url?.trim() || logoDataUrl || stannessLogo;
  const currPrefix = currCode === "GHS" ? "GH " : `${currCode} `;

  cachedReportHeader = {
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    logoUrl,
    currCode,
    currSymbol,
    currPrefix,
  };
  cacheHeaderTime = now;

  return cachedReportHeader;
}

/**
 * Draws the standardized Report Header at the top of a jsPDF document.
 * @param {jsPDF} doc - jsPDF instance
 * @param {object} headerInfo - Resolved header info from fetchReportHeader
 * @param {object} options - Report options (title, subtitle, extraMetadata, kpis)
 * @returns {number} The vertical position (y) where subsequent table/content can start
 */
export function applyPdfHeader(doc, headerInfo, options = {}) {
  const pageW = doc.internal.pageSize.getWidth() || 210;
  const margin = options.margin || 14;
  let y = options.startY || 14;

  const {
    companyName = "Seriana Mart",
    companyAddress = "",
    companyPhone = "",
    companyEmail = "",
    logoUrl = stannessLogo,
    currCode = "GHS",
  } = headerInfo || {};

  const {
    title = "REPORT",
    subtitle = "",
    extraMetadata = "",
    kpis = [],
  } = options;

  // 1. Top Left: Logo Image
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, "PNG", margin, y - 2, 44, 16, undefined, "FAST");
    } catch (err) {
      console.error("PDF Logo draw error:", err);
    }
  }

  // Top Right: Company Information
  let rightY = y + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName, pageW - margin, rightY, { align: "right" });
  rightY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (companyAddress) {
    doc.text(companyAddress, pageW - margin, rightY, { align: "right" });
    rightY += 4.5;
  }
  if (companyPhone) {
    doc.text(`Contact No: ${companyPhone}`, pageW - margin, rightY, {
      align: "right",
    });
    rightY += 4.5;
  }
  if (companyEmail) {
    doc.text(`Email: ${companyEmail}`, pageW - margin, rightY, {
      align: "right",
    });
    rightY += 4.5;
  }

  y = Math.max(y + 18, rightY + 1);

  // Solid Black Divider Line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // 2. Document Title & Metadata Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, pageW - margin * 2, 14, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), margin + 4, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);

  if (subtitle) {
    doc.text(subtitle, margin + 4, y + 10.5);
  }

  const defaultMeta = `Currency: ${currCode}   |   Generated: ${new Date().toLocaleDateString()}`;
  doc.text(extraMetadata || defaultMeta, pageW - margin - 4, y + 10.5, {
    align: "right",
  });
  y += 18;

  // 3. Optional KPI Summary Cards
  if (kpis && kpis.length > 0) {
    const cardGap = 4;
    const cardW =
      (pageW - margin * 2 - cardGap * (kpis.length - 1)) / kpis.length;

    kpis.forEach((k, idx) => {
      const kX = margin + idx * (cardW + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.rect(kX, y, cardW, 12, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(kX, y, cardW, 12, "S");

      // Left Accent bar
      const accentColor = k.color || [16, 185, 129];
      doc.setFillColor(...accentColor);
      doc.rect(kX, y, 1.5, 12, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(k.label || "", kX + 4, y + 4.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(k.value || ""), kX + 4, y + 9.5);
    });
    y += 17;
  }

  return y;
}

/**
 * Applies footer pagination to every page of a jsPDF document.
 * @param {jsPDF} doc - jsPDF instance
 */
export function applyPdfFooter(doc) {
  const totalPages = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth() || 210;
  const pageH = doc.internal.pageSize.getHeight() || 297;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Generated from Seriana Mart ERP  |  Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }
}

/**
 * Builds top metadata rows for Excel export matching the Report Header Template.
 * @param {object} headerInfo - Resolved header info
 * @param {object} options - Title, period, branch, etc.
 * @returns {Array<object>} Array of header rows for XLSX.utils.json_to_sheet
 */
export function buildExcelHeaderRows(headerInfo, options = {}) {
  const {
    companyName = "Seriana Mart",
    companyAddress = "",
    companyPhone = "",
    companyEmail = "",
    currCode = "GHS",
    currSymbol = "₵",
  } = headerInfo || {};

  const {
    title = "REPORT",
    period = "",
    branchName = "All Assigned Branches",
  } = options;

  const contactParts = [];
  if (companyPhone) contactParts.push(`Contact No: ${companyPhone}`);
  if (companyEmail) contactParts.push(`Email: ${companyEmail}`);

  const rows = [
    { Section: companyName, Type: "", Level: "", Code: "", Name: "", Amount: "" },
  ];

  if (companyAddress) {
    rows.push({
      Section: companyAddress,
      Type: "",
      Level: "",
      Code: "",
      Name: "",
      Amount: "",
    });
  }

  if (contactParts.length) {
    rows.push({
      Section: contactParts.join("  |  "),
      Type: "",
      Level: "",
      Code: "",
      Name: "",
      Amount: "",
    });
  }

  rows.push(
    {
      Section: title.toUpperCase(),
      Type: "",
      Level: "",
      Code: "",
      Name: "",
      Amount: "",
    },
    {
      Section: `Currency: ${currCode} (${currSymbol}) | ${period ? `Period: ${period} | ` : ""}Branch: ${branchName} | Generated: ${new Date().toLocaleString()}`,
      Type: "",
      Level: "",
      Code: "",
      Name: "",
      Amount: "",
    },
    { Section: "", Type: "", Level: "", Code: "", Name: "", Amount: "" }
  );

  return rows;
}

