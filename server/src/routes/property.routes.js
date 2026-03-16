import { Router } from "express";
import {
  approveProperty,
  createProperty,
  getGasComparison,
  getPropertyByChainId,
  getProperties,
  getTimeline,
  transferProperty,
  verifyProperty
} from "../controllers/property.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole("admin", "officer", "buyer", "auditor"), getProperties);
router.get("/gas/compare", requireRole("admin", "officer", "buyer", "auditor"), getGasComparison);
router.post("/register", requireRole("admin", "officer"), createProperty);
router.get("/:chainId", requireRole("admin", "officer", "buyer", "auditor"), getPropertyByChainId);
router.get("/:chainId/timeline", requireRole("admin", "officer", "buyer", "auditor"), getTimeline);
router.post("/:chainId/transfer", requireRole("admin", "officer"), transferProperty);
router.post("/:chainId/verify", requireRole("admin", "officer"), verifyProperty);
router.post("/:chainId/approvals/:level", requireRole("tehsildar", "sdm", "collector", "admin"), approveProperty);

export default router;
