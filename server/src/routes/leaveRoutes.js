import express from "express";
import {
  initializeLeaveTypes,
  getLeaveTypes,
  getMyLeaveBalances,
  getUserLeaveBalances,
  getAllLeaveBalances,
  applyLeave,
  cancelLeave,
  getMyLeaveRequests,
  getAllLeaveRequests,
  reviewLeaveRequest,
  getLeaveAnalytics,
  updateLeaveType,
  updateLeaveBalance,
  createLeaveType,
  deleteLeaveType
} from "../controllers/leaveController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Require auth for all leave routes
router.use(authMiddleware);

// Initialization
router.post("/initialize-types", allowRoles("superadmin", "admin"), initializeLeaveTypes);

// Leave Types
router.get("/types", getLeaveTypes);
router.post("/types", allowRoles("superadmin", "admin"), createLeaveType);
router.put("/types/:id", allowRoles("superadmin", "admin"), updateLeaveType);
router.delete("/types/:id", allowRoles("superadmin", "admin"), deleteLeaveType);

// Balances
router.get("/my-balances", getMyLeaveBalances);
router.get("/balances/:userId", allowRoles("superadmin", "admin"), getUserLeaveBalances);
router.get("/all-balances", allowRoles("superadmin", "admin"), getAllLeaveBalances);
router.put("/balances/:id", allowRoles("superadmin", "admin"), updateLeaveBalance);

// Requests
router.post("/apply", applyLeave);
router.patch("/:id/cancel", cancelLeave);
router.get("/my-requests", getMyLeaveRequests);

// Admin review
router.get("/all-requests", allowRoles("superadmin", "admin"), getAllLeaveRequests);
router.patch("/:id/review", allowRoles("superadmin", "admin"), reviewLeaveRequest);

// Analytics
router.get("/analytics", allowRoles("superadmin", "admin"), getLeaveAnalytics);

export default router;
