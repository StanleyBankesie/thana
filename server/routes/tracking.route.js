import express from "express";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  getLiveTracking,
  getTrackingDashboard,
  postLocation,
  getTripHistory,
  startTracking,
  pauseTracking,
  resumeTracking,
  endTracking
} from "../controllers/tracking.controller.js";

const router = express.Router();

router.get("/live", requireAuth, requireCompanyScope, getLiveTracking);
router.get("/dashboard", requireAuth, requireCompanyScope, getTrackingDashboard);
router.post("/location", requireAuth, requireCompanyScope, postLocation);
router.get("/history/:trip_id", requireAuth, requireCompanyScope, getTripHistory);
router.post("/start", requireAuth, requireCompanyScope, startTracking);
router.post("/pause", requireAuth, requireCompanyScope, pauseTracking);
router.post("/resume", requireAuth, requireCompanyScope, resumeTracking);
router.post("/end", requireAuth, requireCompanyScope, endTracking);

export default router;
