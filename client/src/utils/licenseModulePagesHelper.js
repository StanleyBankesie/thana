import Swal from "sweetalert2";
import { MODULES_REGISTRY } from "../data/modulesRegistry.js";
import { ALL_MODULE_SECTIONS } from "../data/userAssignedSections.js";

/**
 * Returns structured sections and pages for a given module code.
 */
export function getModuleSectionsAndPages(moduleKey) {
  const mk = String(moduleKey || "").toLowerCase().trim();
  const moduleInfo = MODULES_REGISTRY[mk] || {};
  const allFeatures = (moduleInfo.features || []).filter((f) => !f.isExclusive);

  const sections = ALL_MODULE_SECTIONS.filter(
    (s) => String(s.moduleKey || "").toLowerCase() === mk,
  );

  const featureMap = new Map();
  allFeatures.forEach((f) => featureMap.set(f.key, f));

  const resultSections = [];
  const coveredKeys = new Set();

  for (const s of sections) {
    const sectionFeatures = [];
    for (const fKey of s.features || []) {
      if (coveredKeys.has(fKey)) continue;
      const feat = featureMap.get(fKey) || {
        key: fKey,
        label: fKey
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
      };
      sectionFeatures.push(feat);
      coveredKeys.add(fKey);
    }
    if (sectionFeatures.length > 0) {
      resultSections.push({
        title: s.title || "General",
        icon: s.icon || "📁",
        features: sectionFeatures,
      });
    }
  }

  // Any remaining registered features not assigned to explicit sections
  const remainingFeatures = allFeatures.filter((f) => !coveredKeys.has(f.key));
  if (remainingFeatures.length > 0) {
    resultSections.push({
      title: resultSections.length > 0 ? "Additional Pages" : "Module Pages",
      icon: "⚙️",
      features: remainingFeatures,
    });
  }

  return resultSections;
}

/**
 * Shows a SweetAlert2 popup displaying sections and pages with checkboxes for a module.
 * Auto-populates checkboxes, allows Select All / Deselect All, and searches.
 */
export async function showModulePagesSweetAlert({
  modCode,
  modName,
  currentlySelectedPages = [],
  allPagesDefault = true,
}) {
  const mk = String(modCode || "").toLowerCase().trim();
  const sections = getModuleSectionsAndPages(mk);
  const totalPages = sections.reduce((sum, s) => sum + s.features.length, 0);

  if (totalPages === 0) {
    return { isConfirmed: true, selectedKeys: [] };
  }

  const selectedSet = new Set(
    currentlySelectedPages && currentlySelectedPages.length > 0
      ? currentlySelectedPages
      : allPagesDefault
        ? sections.flatMap((s) => s.features.map((f) => f.key))
        : [],
  );

  let html = `
    <div style="text-align: left; font-family: inherit;">
      <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
        <input 
          id="swal-page-search" 
          type="text" 
          placeholder="Search section or page..." 
          style="flex: 1; min-width: 200px; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none;"
        />
        <div style="display: flex; gap: 6px;">
          <button type="button" id="swal-select-all-btn" style="padding: 5px 10px; font-size: 12px; font-weight: 600; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer;">
            Select All
          </button>
          <button type="button" id="swal-deselect-all-btn" style="padding: 5px 10px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
            Deselect All
          </button>
        </div>
      </div>
      <div id="swal-sections-container" style="max-height: 55vh; overflow-y: auto; padding-right: 6px;">
  `;

  sections.forEach((sec, secIdx) => {
    const secFeatures = sec.features;
    const allSecChecked = secFeatures.every((f) => selectedSet.has(f.key));

    html += `
      <div class="swal-section-block" data-section-idx="${secIdx}" style="margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
          <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer; margin: 0;">
            <input 
              type="checkbox" 
              class="swal-section-checkbox" 
              data-section-idx="${secIdx}"
              ${allSecChecked ? "checked" : ""}
              style="cursor: pointer; width: 15px; height: 15px;"
            />
            <span>${sec.icon} ${sec.title}</span>
          </label>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">
            <span class="swal-section-count" data-section-idx="${secIdx}">
              ${secFeatures.filter((f) => selectedSet.has(f.key)).length}
            </span>/${secFeatures.length} pages
          </span>
        </div>
        <div style="padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px;">
    `;

    secFeatures.forEach((feat) => {
      const isChecked = selectedSet.has(feat.key);
      html += `
        <label class="swal-page-item" data-page-key="${feat.key}" style="display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: #334155; cursor: pointer; padding: 4px 6px; border-radius: 4px; background: #f8fafc; border: 1px solid #f1f5f9; margin: 0;">
          <input 
            type="checkbox" 
            class="swal-page-checkbox" 
            data-section-idx="${secIdx}" 
            value="${feat.key}" 
            ${isChecked ? "checked" : ""}
            style="cursor: pointer; margin-top: 2px; width: 14px; height: 14px;"
          />
          <span class="swal-page-label" style="line-height: 1.3;">${feat.label}</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #64748b; text-align: right;">
        Total selected: <strong id="swal-total-selected-count">${selectedSet.size}</strong> of ${totalPages} pages
      </div>
    </div>
  `;

  const result = await Swal.fire({
    title: `<span style="font-size: 18px; font-weight: 700; color: #0f172a;">${modName || mk.toUpperCase()} &mdash; Licensed Sections & Pages</span>`,
    html,
    width: "780px",
    showCancelButton: true,
    confirmButtonText: "Confirm & Apply",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#0284c7",
    cancelButtonColor: "#64748b",
    didOpen: (popup) => {
      const searchInput = popup.querySelector("#swal-page-search");
      const selectAllBtn = popup.querySelector("#swal-select-all-btn");
      const deselectAllBtn = popup.querySelector("#swal-deselect-all-btn");
      const totalCountEl = popup.querySelector("#swal-total-selected-count");

      const updateCounts = () => {
        const allPageCbs = Array.from(popup.querySelectorAll(".swal-page-checkbox"));
        const checkedCount = allPageCbs.filter((cb) => cb.checked).length;
        if (totalCountEl) totalCountEl.textContent = String(checkedCount);

        sections.forEach((_, sIdx) => {
          const secCbs = Array.from(popup.querySelectorAll(`.swal-page-checkbox[data-section-idx="${sIdx}"]`));
          const secChecked = secCbs.filter((cb) => cb.checked).length;
          const countBadge = popup.querySelector(`.swal-section-count[data-section-idx="${sIdx}"]`);
          if (countBadge) countBadge.textContent = String(secChecked);

          const secCheckbox = popup.querySelector(`.swal-section-checkbox[data-section-idx="${sIdx}"]`);
          if (secCheckbox) {
            secCheckbox.checked = secChecked > 0 && secChecked === secCbs.length;
            secCheckbox.indeterminate = secChecked > 0 && secChecked < secCbs.length;
          }
        });
      };

      popup.querySelectorAll(".swal-page-checkbox").forEach((cb) => {
        cb.addEventListener("change", updateCounts);
      });

      popup.querySelectorAll(".swal-section-checkbox").forEach((secCb) => {
        secCb.addEventListener("change", (e) => {
          const sIdx = e.target.getAttribute("data-section-idx");
          const checked = e.target.checked;
          popup.querySelectorAll(`.swal-page-checkbox[data-section-idx="${sIdx}"]`).forEach((cb) => {
            cb.checked = checked;
          });
          updateCounts();
        });
      });

      selectAllBtn?.addEventListener("click", () => {
        popup.querySelectorAll(".swal-page-checkbox").forEach((cb) => (cb.checked = true));
        popup.querySelectorAll(".swal-section-checkbox").forEach((cb) => {
          cb.checked = true;
          cb.indeterminate = false;
        });
        updateCounts();
      });

      deselectAllBtn?.addEventListener("click", () => {
        popup.querySelectorAll(".swal-page-checkbox").forEach((cb) => (cb.checked = false));
        popup.querySelectorAll(".swal-section-checkbox").forEach((cb) => {
          cb.checked = false;
          cb.indeterminate = false;
        });
        updateCounts();
      });

      searchInput?.addEventListener("input", (e) => {
        const q = String(e.target.value || "").toLowerCase().trim();
        sections.forEach((sec, sIdx) => {
          const block = popup.querySelector(`.swal-section-block[data-section-idx="${sIdx}"]`);
          if (!block) return;
          let anyMatch = false;
          const secTitleMatch = sec.title.toLowerCase().includes(q);

          block.querySelectorAll(".swal-page-item").forEach((item) => {
            const labelText = (item.querySelector(".swal-page-label")?.textContent || "").toLowerCase();
            const keyText = (item.getAttribute("data-page-key") || "").toLowerCase();
            const matches = !q || secTitleMatch || labelText.includes(q) || keyText.includes(q);
            item.style.display = matches ? "flex" : "none";
            if (matches) anyMatch = true;
          });

          block.style.display = anyMatch ? "block" : "none";
        });
      });

      updateCounts();
    },
    preConfirm: () => {
      const checkedBoxes = Array.from(document.querySelectorAll(".swal-page-checkbox:checked"));
      return checkedBoxes.map((cb) => cb.value);
    },
  });

  return {
    isConfirmed: Boolean(result.isConfirmed),
    selectedKeys: result.isConfirmed ? result.value || [] : [],
  };
}
