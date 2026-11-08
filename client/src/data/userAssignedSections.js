/**
 * @fileoverview Module Sections Registry and helper for sidebar navigation.
 * Maps all modules and their functional sections with their navigation targets,
 * icons, and feature keys.
 */

export const ALL_MODULE_SECTIONS = [

  // --- ADMINISTRATION ---
  {
    moduleKey: "administration",
    modulePath: "/administration",
    title: "Audit & Logs",
    icon: "📜",
    path: "/administration/reports/system-log-book",
    features: ["system-log-book", "user-login-activity"],
  },

  // --- SYSTEM CONFIGURATION ---
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "System Configuration",
    icon: "🏢",
    path: "/system-configuration",
    features: ["company", "branches", "settings"],
  },
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "Access & Security",
    icon: "🛡️",
    path: "/system-configuration/security",
    features: ["admin-permissions", "backup"],
  },
  {
    moduleKey: "system-configuration",
    modulePath: "/system-configuration",
    title: "Licensing & Billing",
    icon: "🔑",
    path: "/system-configuration/licensing",
    features: ["license-management", "payment-packages"],
  },
];

/**
 * Filter sections assigned to the user based on permissions.
 * Only displays sections the user is entitled to based on their assigned role features.
 * NB: Super Admin (user ID = 1) is exempt and retains all sections.
 */
/**
 * Filter sections assigned to the user based on permissions.
 * Checks the pages and features assigned to the user first before showing sections in the side menu.
 * Strictly scopes permissions to the target module to prevent cross-module bleed (e.g. POS vs Purchase).
 * NB: Super Admin (user ID = 1) is exempt and retains all sections.
 */
export function getAssignedSectionsForUser(perm, user) {
  if (!perm) return [];

  const uid = Number(user?.id || user?.sub || 0);

  // Super Admin (User ID = 1) gets all sections
  if (uid === 1) {
    return ALL_MODULE_SECTIONS;
  }

  const {
    modules,
    roleFeatures,
    permissions,
    permByFeatureKey,
    canViewModule,
  } = perm;

  // Build a map of moduleKey (lowercase) -> Set of allowed featureKeys (lowercase)
  // Strictly module-scoped so permissions in POS do not grant access to Purchase/Procurement and vice-versa.
  const userAllowedFeaturesByModule = new Map();

  const addAllowed = (modKey, featKey) => {
    const m = String(modKey || "").trim().toLowerCase();
    const f = String(featKey || "").trim().toLowerCase();
    if (!m || !f) return;
    if (!userAllowedFeaturesByModule.has(m)) {
      userAllowedFeaturesByModule.set(m, new Set());
    }
    const set = userAllowedFeaturesByModule.get(m);
    set.add(f);
    if (!f.includes(":")) {
      set.add(`${m}:${f}`);
    } else {
      const parts = f.split(":");
      if (parts[1]) set.add(parts[1]);
    }
  };

  // 1. Gather from roleFeatures (e.g. "pos:invoices", "sales:quotations", "administration:users")
  const rawRoleFeatures = roleFeatures instanceof Set
    ? Array.from(roleFeatures)
    : Array.isArray(roleFeatures)
      ? roleFeatures
      : [];

  for (const rf of rawRoleFeatures) {
    if (!rf) continue;
    const str = String(rf).trim().toLowerCase();
    if (str.includes(":")) {
      const [m, k] = str.split(":");
      addAllowed(m, k);
    }
  }

  // 2. Gather from permissions array
  if (Array.isArray(permissions)) {
    for (const p of permissions) {
      if (!p) continue;
      const canView =
        p.can_view === true ||
        p.can_view === 1 ||
        p.can_view === "1" ||
        p.view === true ||
        p.view === 1;

      if (canView) {
        const pMk = String(p.module_key || "").trim().toLowerCase();
        const pFk = String(p.feature_key || "").trim().toLowerCase();
        if (pFk.includes(":")) {
          const [m, k] = pFk.split(":");
          addAllowed(m || pMk, k);
        } else if (pMk && pFk) {
          addAllowed(pMk, pFk);
        }
      }
    }
  }

  // 3. Gather from permByFeatureKey map if available
  if (permByFeatureKey instanceof Map) {
    for (const [k, val] of permByFeatureKey.entries()) {
      if (val && (val.can_view === true || val.can_view === 1 || val.view === true || val.view === 1)) {
        const strK = String(k || "").trim().toLowerCase();
        if (strK.includes(":")) {
          const [m, feat] = strK.split(":");
          addAllowed(m, feat);
        } else if (val.module_key) {
          addAllowed(val.module_key, strK);
        }
      }
    }
  }

  return ALL_MODULE_SECTIONS.filter((section) => {
    const mk = String(section.moduleKey || "").trim().toLowerCase();

    // 1. System configuration check (restricted to user 1 & 2)
    if (mk === "system-configuration") {
      if (uid !== 1 && uid !== 2) return false;
    }

    // 2. Module Level Check:
    // User must have this module assigned
    if (modules instanceof Set && modules.size > 0) {
      if (!modules.has("*") && !modules.has(mk)) {
        return false;
      }
    } else if (Array.isArray(modules) && modules.length > 0) {
      if (!modules.includes("*") && !modules.includes(mk)) {
        return false;
      }
    }

    if (typeof canViewModule === "function") {
      if (!canViewModule(mk)) return false;
    }

    // 3. Check pages/features assigned to user in THIS SPECIFIC MODULE
    const moduleAllowedFeatures = userAllowedFeaturesByModule.get(mk);
    if (!moduleAllowedFeatures || moduleAllowedFeatures.size === 0) {
      return false;
    }

    // 4. Section Feature Level Check:
    // User must have at least one assigned page/feature in this section
    const sectionFeatures = Array.isArray(section.features) ? section.features : [];
    let hasAssignedPage = false;

    for (const rawFeat of sectionFeatures) {
      const feat = String(rawFeat || "").trim().toLowerCase();
      if (!feat) continue;

      // Purchase Upload strictly requires Admin Permissions in System Admin
      if (feat === "purchase-upload" || feat === "upload") {
        if (uid !== 1) {
          const hasAdminPerm =
            (Array.isArray(permissions) &&
              permissions.some(
                (p) =>
                  (p.is_exclusive || p.isExclusive) &&
                  (p.feature_key === "purchase:purchase-upload" ||
                    p.feature_key === "purchase-upload")
              )) ||
            (perm?.exceptionalPerms instanceof Set &&
              (perm.exceptionalPerms.has("purchase:purchase-upload") ||
                perm.exceptionalPerms.has("purchase-upload")));
          if (!hasAdminPerm) continue;
        }
      }

      const fullKey = `${mk}:${feat}`;
      const cleanFullKey = fullKey.replace(/[^a-z0-9:]/g, "");
      const cleanFeat = feat.replace(/[^a-z0-9]/g, "");

      // Direct match
      if (
        moduleAllowedFeatures.has(feat) ||
        moduleAllowedFeatures.has(fullKey)
      ) {
        hasAssignedPage = true;
        break;
      }

      // Normalized match within this module's allowed features
      for (const allowedF of moduleAllowedFeatures) {
        const cleanAllowed = allowedF.replace(/[^a-z0-9:]/g, "");
        if (cleanAllowed === cleanFullKey || cleanAllowed === cleanFeat) {
          hasAssignedPage = true;
          break;
        }
      }
      if (hasAssignedPage) break;
    }

    return hasAssignedPage;
  });
}
