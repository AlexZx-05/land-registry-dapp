import { Router } from "express";
import { getParcelBySurvey, searchParcel } from "../controllers/parcel.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/search", requireRole("admin", "officer", "buyer", "auditor"), searchParcel);
router.get("/:surveyNumber", requireRole("admin", "officer", "buyer", "auditor"), getParcelBySurvey);

export default router;
