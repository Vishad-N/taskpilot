import express from "express";
import {
  clockIn,
  clockOut,
  getMyAttendance,
  getAllAttendance,
  updateAttendance,
  requestCorrection,
  getCorrectionRequests,
  updateCorrectionRequest,
  getAnalytics,
  exportAttendance
} from "../controllers/attendanceController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Common: Team, Admin, Superadmin
router.post(
  "/clock-in",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  clockIn
);

router.post(
  "/clock-out",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  clockOut
);

router.get(
  "/my",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getMyAttendance
);

router.post(
  "/request-correction",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  requestCorrection
);

// Admin & Superadmin only
router.get(
  "/export",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  exportAttendance
);

router.get(
  "/all",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  getAllAttendance
);

router.get(
  "/analytics",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  getAnalytics
);

router.get(
  "/correction-requests",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  getCorrectionRequests
);

router.put(
  "/correction-requests/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  updateCorrectionRequest
);

router.put(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  updateAttendance
);

export default router;
