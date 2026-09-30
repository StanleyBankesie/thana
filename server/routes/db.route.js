/**
 * @fileoverview Database configuration routes.
 * Exposes an endpoint to retrieve the current database configuration.
 */
import express from "express";
import { dbConfig } from "../controllers/db.controller.js";
const router = express.Router();

// GET /db/config - Retrieve the current database configuration
router.get("/db/config", dbConfig);
export default router;
