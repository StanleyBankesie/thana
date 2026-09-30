/**
 * @fileoverview Health check routes.
 * Provides endpoints to verify the health status of the API and database.
 */
import express from "express";
import {
  getDbHealthDetails,
  getHealth,
} from "../controllers/get.health.controller.js";
const router = express.Router();

router.get("/health", getHealth);
router.get("/health/db", getDbHealthDetails);
export default router;
