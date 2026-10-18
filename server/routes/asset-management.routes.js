import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as ac from "../controllers/asset-management.controller.js";

const router = express.Router();
const auth = [requireAuth, requireCompanyScope, requireBranchScope];

// ===== ASSET STATISTICS & KPIS =====
router.get("/stats", ...auth, ac.getAssetStats);

// ===== ASSET CATEGORIES =====
router.get("/categories", ...auth, ac.listCategories);
router.post("/categories", ...auth, ac.createCategory);
router.put("/categories/:id", ...auth, ac.updateCategory);

// ===== ASSET REGISTER =====
router.get("/", ...auth, ac.listAssets);
router.get("/list", ...auth, ac.listAssets);
router.get("/:id", ...auth, ac.getAssetById);
router.post("/", ...auth, ac.createAsset);
router.put("/:id", ...auth, ac.updateAsset);
router.delete("/:id", ...auth, ac.deleteAsset);

// ===== DEPRECIATION ENGINE =====
router.get("/depreciation/preview", ...auth, ac.calculateDepreciationPreview);
router.post("/depreciation/post", ...auth, ac.postDepreciationRun);
router.get("/depreciation/runs", ...auth, ac.listDepreciationRuns);

// ===== ASSET TRANSFERS =====
router.get("/transfers/list", ...auth, ac.listAssetTransfers);
router.post("/transfers", ...auth, ac.createAssetTransfer);

// ===== ASSET DISPOSALS =====
router.get("/disposals/list", ...auth, ac.listAssetDisposals);
router.post("/disposals", ...auth, ac.createAssetDisposal);

// ===== ASSET REVALUATION & IMPAIRMENT =====
router.get("/revaluations", ...auth, ac.listAssetRevaluations);
router.post("/revaluations", ...auth, ac.createAssetRevaluation);

// ===== MANUFACTURERS / BRANDS =====
router.get("/manufacturers", ...auth, ac.listManufacturers);
router.post("/manufacturers", ...auth, ac.createManufacturer);
router.put("/manufacturers/:id", ...auth, ac.updateManufacturer);
router.delete("/manufacturers/:id", ...auth, ac.deleteManufacturer);

// ===== PROPERTIES / FACILITY SITES =====
router.get("/properties", ...auth, ac.listProperties);
router.post("/properties", ...auth, ac.createProperty);
router.put("/properties/:id", ...auth, ac.updateProperty);
router.delete("/properties/:id", ...auth, ac.deleteProperty);

// ===== ASSET TAG NOMENCLATURE & SETUP =====
router.get("/setup/nomenclature", ...auth, ac.getTagNomenclature);
router.post("/setup/nomenclature", ...auth, ac.saveTagNomenclature);
router.get("/setup/next-tag", ...auth, ac.generateNextTag);

// ===== FIXED ASSET SCHEDULE & AUDIT REPORTS =====
router.get("/reports/schedule", ...auth, ac.getFixedAssetScheduleReport);

export default router;
