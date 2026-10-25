/**
 * Utility functions for calculating line item totals with Inclusive vs Exclusive tax modes.
 */

export function calculateLineTax({
  qty = 1,
  price = 0,
  discountPercent = 0,
  taxRate = 0,
  taxMode = 'EXCLUSIVE', // 'INCLUSIVE' | 'EXCLUSIVE'
}) {
  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  const disc = Number(discountPercent) || 0;
  const rate = Number(taxRate) || 0;
  const isInclusive = String(taxMode || '').toUpperCase() === 'INCLUSIVE';

  // Gross before discount
  const gross = q * p;
  // Discount amount
  const discountAmount = gross * (disc / 100);
  // Net base after discount
  const discountedGross = Math.max(0, gross - discountAmount);

  let netPrice = p * (1 - disc / 100);
  let netAmount = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  if (rate <= 0) {
    netAmount = discountedGross;
    taxAmount = 0;
    totalAmount = discountedGross;
  } else if (isInclusive) {
    // Price includes tax: Total = discountedGross
    totalAmount = discountedGross;
    netAmount = totalAmount / (1 + rate / 100);
    taxAmount = totalAmount - netAmount;
    netPrice = q > 0 ? netAmount / q : 0;
  } else {
    // Price excludes tax: Tax is added on top
    netAmount = discountedGross;
    taxAmount = netAmount * (rate / 100);
    totalAmount = netAmount + taxAmount;
  }

  return {
    gross: Math.round(gross * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    netPrice: Math.round(netPrice * 10000) / 10000,
    netAmount: Math.round(netAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    taxRate: rate,
    taxMode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
    isInclusive,
  };
}

export function formatTaxComponentLabel(component, taxMode = '') {
  if (!component) return '';
  const name = component.component_name || component.name || component.label || 'Tax';
  const rate = component.rate_percent !== undefined ? component.rate_percent : component.rate;
  const modeTag = taxMode ? ` [${String(taxMode).toUpperCase() === 'INCLUSIVE' ? 'Incl' : 'Excl'}]` : '';
  const rateStr = rate !== undefined && rate !== null ? ` (${Number(rate)}%)` : '';
  return `${name}${rateStr}${modeTag}`;
}
