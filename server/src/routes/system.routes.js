import { Router } from "express";
import { getSystemPreflight } from "../controllers/system.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/preflight",
  requireAuth,
  requireRole("admin", "officer", "auditor"),
  getSystemPreflight
);

export default router;
