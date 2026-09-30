/**
 * @fileoverview uomConversion.js (Server)
 * Multi-UOM & Packaging Auto-Conversion engine.
 * Converts base unit quantities (e.g. PCS) into breakdown of packaging units (e.g. Boxes, Cartons + Loose Pcs)
 * and calculates volume/bulk equivalents.
 */

export function formatPackagingBreakdown(totalQty, baseUom = "PCS", conversions = []) {
  const qty = Number(totalQty) || 0;
  const activeConvs = Array.isArray(conversions)
    ? conversions.filter((c) => Number(c.is_active ?? 1) && Number(c.conversion_factor) > 1)
    : [];

  if (activeConvs.length === 0) {
    return {
      primaryText: `${qty} ${baseUom}`,
      breakdownText: "",
      boxes: 0,
      remainingPcs: qty,
      factor: 1,
      packUom: baseUom
    };
  }

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
    primaryText: `${qty} ${baseUom}`,
    breakdownText,
    boxes,
    remainingPcs,
    factor,
    packUom
  };
}

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
