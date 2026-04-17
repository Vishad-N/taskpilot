import express from "express";
import { getPendingUsers, approveUser } from "../controllers/superAdminController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/pending-users",
  authMiddleware,
  allowRoles("superadmin"),
  getPendingUsers
);

router.patch(
  "/approve-user",
  authMiddleware,
  allowRoles("superadmin"),
  approveUser
);

export default router;