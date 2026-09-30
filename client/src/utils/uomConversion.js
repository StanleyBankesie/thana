/**
 * @fileoverview uomConversion.js
 * Multi-UOM & Packaging Auto-Conversion engine.
 * Converts base unit quantities (e.g. PCS) into breakdown of packaging units (e.g. Boxes, Cartons + Loose Pcs)
 * and calculates volume/bulk equivalents.
 */

/**
 * Format base quantity into friendly packaging units (e.g. "4 Boxes + 13 Pcs (93 Pcs total)")
 * @param {number|string} totalQty - Total quantity in base unit
 * @param {string} baseUom - Base UOM (e.g. "PCS")
 * @param {Array} conversions - Array of { from_uom, to_uom, conversion_factor }
 * @returns {{ primaryText: string, breakdownText: string, boxes: number, remainingPcs: number, factor: number, packUom: string }}
 */
export function formatPackagingBreakdown(totalQty, baseUom = "PCS", conversions = []) {
  const qty = Number(totalQty) || 0;
  const activeConvs = Array.isArray(conversions)
    ? conversions.filter((c) => Number(c.is_active ?? 1) && Number(c.conversion_factor) > 1)
    : [];

  if (activeConvs.length === 0) {
    return {
      primaryText: `${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${baseUom}`,
      breakdownText: "",
      boxes: 0,
      remainingPcs: qty,
      factor: 1,
      packUom: baseUom
    };
  }

  // Sort descending by conversion factor
  const sorted = [...activeConvs].sort((a, b) => Number(b.conversion_factor) - Number(a.conversion_factor));
  const primaryConv = sorted[0];
  const factor = Number(primaryConv.conversion_factor);
  const packUom = primaryConv.from_uom || "BOX";

  const boxes = Math.floor(qty / factor);
  const remainingPcs = qty % factor;

  let breakdownText = "";
  if (boxes > 0 && remainingPcs > 0) {
    breakdownText = `${boxes} ${packUom} + ${remainingPcs} ${baseUom}`;
  } else if (boxes > 0) {
    breakdownText = `${boxes} ${packUom}`;
  } else {
    breakdownText = `${remainingPcs} ${baseUom}`;
  }

  return {
    primaryText: `${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${baseUom}`,
    breakdownText,
    boxes,
    remainingPcs,
    factor,
    packUom
  };
}

/**
 * Auto-calculates packaging quantity given a factor
 */
export function calculatePackBreakdown(qty, factor, packUom = "BOX", baseUom = "PCS") {
  const numQty = Number(qty) || 0;
  const numFactor = Number(factor) || 1;
  if (numFactor <= 1) {
    return { boxes: 0, remainingPcs: numQty, text: `${numQty} ${baseUom}` };
  }
  const boxes = Math.floor(numQty / numFactor);
  const remainingPcs = numQty % numFactor;
  let text = "";
  if (boxes > 0 && remainingPcs > 0) {
    text = `${boxes} ${packUom} + ${remainingPcs} ${baseUom}`;
  } else if (boxes > 0) {
    text = `${boxes} ${packUom}`;
  } else {
    text = `${remainingPcs} ${baseUom}`;
  }
  return { boxes, remainingPcs, text };
}
