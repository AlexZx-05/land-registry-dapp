import { Router } from "express";
import {
  listPendingApprovals,
  login,
  logout,
  me,
  refresh,
  reviewAccountApproval,
  signup
} from "../controllers/auth.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.get("/pending-approvals", requireAuth, requireRole("admin"), listPendingApprovals);
router.post("/pending-approvals/:userId/review", requireAuth, requireRole("admin"), reviewAccountApproval);

export default router;
