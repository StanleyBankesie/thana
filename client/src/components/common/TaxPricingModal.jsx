import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client.js';
import { Check } from 'lucide-react';

/**
 * TaxPricingModal (Mini SweetAlert - Stage 2)
 * - Required only when INCLUSIVE is selected.
 * - Displays ONLY active Tax Codes (NOT individual sub-components).
 * - Removed search bar and category tabs per user request.
 * - Appears "just on top of the tax field" (anchored above/on the tax field).
 * - Compact 50% size (260px width) matching the Tax Mode alert.
 * - Does NOT deactivate the background (no dark backdrop overlay).
 */
export default function TaxPricingModal({
  open,
  onClose,
  taxMode = 'INCLUSIVE',
  price = 0,
  selectedComponent = null,
  onSelectComponent,
  form = '',
  pageId = null,
  taxCodes: propTaxCodes = null,
}) {
  const [taxCodes, setTaxCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);
  const [coords, setCoords] = useState(null);

  // Load only Tax Codes from /finance/tax-codes filtered by page
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setLoading(true);

    if (Array.isArray(propTaxCodes) && propTaxCodes.length > 0) {
      setTaxCodes(
        propTaxCodes.filter(
          (t) => t.is_active !== 0 && t.is_active !== false && String(t.is_active) !== 'false'
        )
      );
      setLoading(false);
      return;
    }

    // Determine pageId / form from props or window.location.pathname
    let resolvedForm = form;
    let resolvedPageId = pageId;
    if (!resolvedForm && !resolvedPageId && typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/project-management/project-invoices') || p.includes('/project-invoices')) {
        resolvedForm = 'PROJECT_INVOICE';
        resolvedPageId = 26;
      } else if (p.includes('/facilities/servicebilling') || p.includes('/facilities')) {
        resolvedForm = 'FACILITIES_SERVICE_BILLING';
        resolvedPageId = 25;
      } else if (p.includes('/assets') || p.includes('/asset-management')) {
        resolvedForm = 'ASSET_INVOICE';
        resolvedPageId = 24;
      } else if (p.includes('/sales/invoices')) {
        resolvedForm = 'INVOICE';
        resolvedPageId = 2;
      } else if (p.includes('/service-management/service-invoices')) {
        resolvedForm = 'SERVICE_INVOICE';
        resolvedPageId = 27;
      } else if (p.includes('/service-management/service-bills')) {
        resolvedForm = 'SERVICE_BILL';
        resolvedPageId = 8;
      } else if (p.includes('/transport/billing')) {
        resolvedForm = 'TRANSPORT_BILLING';
        resolvedPageId = 28;
      } else if (p.includes('/purchase/purchase-bills')) {
        resolvedForm = 'PURCHASE_BILL_LOCAL';
        resolvedPageId = 3;
      } else if (p.includes('/maintenance/maintenance-bills')) {
        resolvedForm = 'MAINTENANCE_BILL';
        resolvedPageId = 7;
      } else if (p.includes('/fuel-bills') || p.includes('/transportation-bills')) {
        resolvedForm = 'SERVICE_BILL';
        resolvedPageId = 8;
      }
    }

    const queryParams = { active: 1 };
    if (resolvedForm) queryParams.form = resolvedForm;
    if (resolvedPageId) queryParams.pageId = resolvedPageId;

    api
      .get('/finance/tax-codes', { params: queryParams })
      .then((res) => {
        if (!isMounted) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        // Filter only active tax codes AND ensure tax code is applicable to this page
        const activeCodes = items.filter((t) => {
          const isActive =
            t.is_active !== 0 && t.is_active !== false && String(t.is_active) !== 'false';
          if (!isActive) return false;

          // When a VAT code is not selected for a page in tax codes page in finance, do not show that tax in that page
          if (resolvedPageId && t.valid_pages !== undefined && t.valid_pages !== null) {
            const pages = String(t.valid_pages)
              .split(',')
              .map((s) => s.trim());
            const hasPageId = pages.includes(String(resolvedPageId));
            const hasFormCode = resolvedForm && pages.includes(String(resolvedForm));
            if (!hasPageId && !hasFormCode) {
              return false;
            }
          }
          return true;
        });
        setTaxCodes(activeCodes);
      })
      .catch((err) => {
        console.error('Failed to load tax codes', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, form, pageId, propTaxCodes]);

  // Calculate position: "just on top of the tax field"
  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const calcPos = () => {
      const anchor =
        document.querySelector('[data-tax-anchor="true"]') ||
        document.querySelector('[title*="tax component" i]') ||
        document.querySelector('[title*="select tax" i]');

      const modalWidth = 260; // 50% size mini sweet alert
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        let left = rect.left;
        if (left + modalWidth > window.innerWidth - 12) {
          left = window.innerWidth - modalWidth - 12;
        }
        if (left < 12) left = 12;

        // "just on top of the tax field"
        if (rect.top >= 150) {
          setCoords({
            placement: 'top',
            bottom: window.innerHeight - rect.top + 6,
            left,
          });
        } else {
          // If close to the top of screen, position directly below the tax field
          setCoords({
            placement: 'bottom',
            top: rect.bottom + 6,
            left,
          });
        }
      } else {
        // Fallback: top-center
        setCoords({
          placement: 'bottom',
          top: 130,
          left: Math.max(12, (window.innerWidth - modalWidth) / 2),
        });
      }
    };

    calcPos();
    window.addEventListener('resize', calcPos);
    window.addEventListener('scroll', calcPos, true);

    return () => {
      window.removeEventListener('resize', calcPos);
      window.removeEventListener('scroll', calcPos, true);
    };
  }, [open]);

  // Outside click listener — does NOT deactivate background
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        const anchor = document.querySelector('[data-tax-anchor="true"]');
        if (anchor && anchor.contains(e.target)) return;
        if (onClose) onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const numPrice = Number(price || 0);

  const positionStyle = coords
    ? coords.placement === 'top'
      ? { bottom: `${coords.bottom}px`, left: `${coords.left}px` }
      : { top: `${coords.top}px`, left: `${coords.left}px` }
    : { top: '150px', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      ref={modalRef}
      className="fixed z-[9999] w-[260px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 text-left transform"
      style={{
        ...positionStyle,
        animation: 'swalPopIn 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes swalPopIn {
          0% { transform: scale(0.7); opacity: 0; }
          45% { transform: scale(1.05); opacity: 0.85; }
          80% { transform: scale(0.96); opacity: 0.95; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 text-center tracking-tight mb-2">
        Select Tax Code
      </h3>

      {/* Tax Codes List - displayed in cards without scroll bar */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center py-3 text-[10px] text-slate-400">Loading tax codes...</div>
        ) : taxCodes.length === 0 ? (
          <div className="text-center py-3 text-[10px] text-slate-400">No active tax codes found.</div>
        ) : (
          taxCodes.map((tc) => {
            const rate = Number(tc.rate_percent || 0);
            const isSelected =
              selectedComponent &&
              (String(selectedComponent.id) === String(tc.id) ||
                String(selectedComponent.taxCodeId) === String(tc.id) ||
                String(selectedComponent.name) === String(tc.name) ||
                String(selectedComponent.code) === String(tc.code));

            return (
              <div
                key={tc.id}
                onClick={() => {
                  if (onSelectComponent) {
                    onSelectComponent({
                      id: tc.id,
                      taxCodeId: tc.id,
                      originalId: tc.id,
                      name: tc.name || tc.code,
                      code: tc.code,
                      rate: rate,
                      tax_mode: taxMode || 'EXCLUSIVE',
                    });
                  }
                  if (onClose) onClose();
                }}
                className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 ring-1 ring-brand-500/40'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-brand-400 hover:bg-brand-50/30'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate pr-2">
                  {tc.name || tc.code}
                </span>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 px-2 py-0.5 rounded-md">
                    {rate}%
                  </span>
                  {isSelected && <Check size={12} className="text-brand-600 dark:text-brand-400" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dismiss link */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-center">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-slate-400 hover:text-slate-600 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * TaxModeRadioSelector
 * Stage 1:
 * - Pops up below the price field as a Mini SweetAlert (50% size, 260px width, rounded-2xl).
 * - Does NOT deactivate the background (no dark backdrop overlay).
 * - When EXCLUSIVE is selected:
 *   - Does NOT display the tax sweet alert!
 *   - Closes the popup and records exclusive mode.
 * - When INCLUSIVE is selected:
 *   - Users are required to select a tax code!
 *   - Closes the popup and fires onOpenTaxModal() which opens Stage 2 right on top of the Tax field!
 */
export function TaxModeRadioSelector({
  price,
  taxMode = 'EXCLUSIVE',
  onModeChange,
  onOpenTaxModal,
  selectedTaxLabel = '',
  className = '',
  autoPrompt = false,
  openAlert = false,
  onCloseAlert = null,
  anchorSelector = '',
  name: groupName = 'invoice_tax_mode_radio',
}) {
  const [showModeAlert, setShowModeAlert] = useState(false);
  const currentMode = String(taxMode || 'EXCLUSIVE').toUpperCase();
  const numPrice = Number(price || 0);

  const containerRef = useRef(null);
  const alertRef = useRef(null);
  const prevPriceRef = useRef(null);
  const hasPromptedRef = useRef(false);
  const [coords, setCoords] = useState(null);

  // Sync external openAlert prop
  useEffect(() => {
    if (openAlert) {
      setShowModeAlert(true);
    }
  }, [openAlert]);

  const closeAlert = () => {
    setShowModeAlert(false);
    if (onCloseAlert) onCloseAlert();
  };

  // Optional autoPrompt when price enters
  useEffect(() => {
    if (autoPrompt && numPrice > 0) {
      const prev = Number(prevPriceRef.current || 0);
      if (prev <= 0 && !hasPromptedRef.current) {
        const timer = setTimeout(() => {
          setShowModeAlert(true);
          hasPromptedRef.current = true;
        }, 200);
        return () => clearTimeout(timer);
      }
    }
    prevPriceRef.current = price;
  }, [price, numPrice, autoPrompt]);

  // Calculate position: below anchorSelector or container
  useEffect(() => {
    if (!showModeAlert) {
      setCoords(null);
      return;
    }

    const calcPos = () => {
      const anchor =
        (anchorSelector ? document.querySelector(anchorSelector) : null) ||
        containerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const modalWidth = 260; // 50% size mini sweet alert
      let left = rect.left;
      if (left + modalWidth > window.innerWidth - 12) {
        left = window.innerWidth - modalWidth - 12;
      }
      if (left < 12) left = 12;

      setCoords({
        top: rect.bottom + 6,
        left,
      });
    };

    calcPos();
    window.addEventListener('resize', calcPos);
    window.addEventListener('scroll', calcPos, true);

    return () => {
      window.removeEventListener('resize', calcPos);
      window.removeEventListener('scroll', calcPos, true);
    };
  }, [showModeAlert, anchorSelector]);

  // Outside click listener — does NOT deactivate background
  useEffect(() => {
    if (!showModeAlert) return;
    const handleClickOutside = (e) => {
      if (alertRef.current && !alertRef.current.contains(e.target)) {
        if (containerRef.current && containerRef.current.contains(e.target)) return;
        closeAlert();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModeAlert]);

  const handleSelectMode = (newMode, fromAlert = false) => {
    if (onModeChange) onModeChange(newMode);
    closeAlert();
    if (fromAlert) {
      setTimeout(() => {
        if (onOpenTaxModal) onOpenTaxModal();
      }, 200);
    }
  };

  return (
    <div ref={containerRef} className={`space-y-1 relative ${className}`}>
      <style>{`
        @keyframes swalPopIn {
          0% { transform: scale(0.7); opacity: 0; }
          45% { transform: scale(1.05); opacity: 0.85; }
          80% { transform: scale(0.96); opacity: 0.95; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ── Stage 1: Mini SweetAlert for Tax Mode (Icon removed per user request) ── */}
      {showModeAlert && coords && (
        <div
          ref={alertRef}
          className="fixed z-[9999] w-[260px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 text-center transform text-left"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            animation: 'swalPopIn 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 text-center tracking-tight mb-1">
            Select Tax Mode
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mb-2.5 leading-tight">
            Choose tax calculation mode for invoice items:
          </p>

          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {/* Inclusive Button */}
            <button
              type="button"
              onClick={() => handleSelectMode('INCLUSIVE', true)}
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                currentMode === 'INCLUSIVE'
                  ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 ring-1 ring-purple-600/30'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-purple-300'
              }`}
            >
              <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                Inclusive
              </div>
              <span className="text-[9px] text-slate-400 block leading-tight mt-0.5">
                Tax in price
              </span>
            </button>

            {/* Exclusive Button */}
            <button
              type="button"
              onClick={() => handleSelectMode('EXCLUSIVE', true)}
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                currentMode === 'EXCLUSIVE'
                  ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 ring-1 ring-blue-600/30'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-blue-300'
              }`}
            >
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                Exclusive
              </div>
              <span className="text-[9px] text-slate-400 block leading-tight mt-0.5">
                Tax added to price
              </span>
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={closeAlert}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium underline"
            >
              Skip / Decide Later
            </button>
          </div>
        </div>
      )}

      {/* ── Inline State (Invoice-based tax mode selector) ── */}
      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-2 py-1 rounded-lg text-[10px] transition-all">
        <span
          className="font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap cursor-pointer hover:underline"
          onClick={() => setShowModeAlert(true)}
          title="Click to change tax mode in popup"
        >
          Tax Mode:
        </span>
        <label className="flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-200 font-medium">
          <input
            type="radio"
            name={groupName}
            value="INCLUSIVE"
            checked={currentMode === 'INCLUSIVE'}
            onChange={() => handleSelectMode('INCLUSIVE', false)}
            className="text-brand-600 focus:ring-brand-500 h-3 w-3"
          />
          Inclusive
        </label>
        <label className="flex items-center gap-1 cursor-pointer text-slate-700 dark:text-slate-200 font-medium">
          <input
            type="radio"
            name={groupName}
            value="EXCLUSIVE"
            checked={currentMode === 'EXCLUSIVE'}
            onChange={() => handleSelectMode('EXCLUSIVE', false)}
            className="text-brand-600 focus:ring-brand-500 h-3 w-3"
          />
          Exclusive
        </label>
      </div>

      {selectedTaxLabel ? (
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span className="truncate">
            Tax: <strong className="text-slate-700 dark:text-slate-200">{selectedTaxLabel}</strong>
          </span>
          <button
            type="button"
            onClick={onOpenTaxModal}
            className="text-brand-600 hover:text-brand-700 underline font-medium ml-1 shrink-0"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span className="truncate text-slate-400">No tax code selected</span>
          <button
            type="button"
            onClick={onOpenTaxModal}
            className="text-brand-600 hover:text-brand-700 underline font-medium ml-1 shrink-0"
          >
            Select Tax
          </button>
        </div>
      )}
    </div>
  );
}
