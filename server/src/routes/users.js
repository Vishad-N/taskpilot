import express from "express";

import {
  getPendingUsers,
  approveUser,
  getTeamUsers,
  createUserBySuperAdmin,
  getAssignableUsers,
  getAllUsers,
  deleteTeamUser,
  resetUserPassword,
  updateUserBySuperAdmin
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

/*
====================================
SUPERADMIN ROUTES
====================================
*/

// Get all pending users
router.get(
  "/pending",
  authMiddleware,
  allowRoles("superadmin"),
  getPendingUsers
);

// Approve user + assign role/org
router.patch(
  "/approve",
  authMiddleware,
  allowRoles("superadmin"),
  approveUser
);

// Create user directly (approved) + assign org
router.post(
  "/create",
  authMiddleware,
  allowRoles("superadmin"),
  createUserBySuperAdmin
);

router.get(
  "/all",
  authMiddleware,
  allowRoles("superadmin"),
  getAllUsers
);

router.patch(
  "/:id/password",
  authMiddleware,
  allowRoles("superadmin"),
  resetUserPassword
);

router.patch(
  "/:id",
  authMiddleware,
  allowRoles("superadmin"),
  updateUserBySuperAdmin
);


/*
====================================
ADMIN / SUPERADMIN ROUTES
====================================
*/

// Get all team members (for task assignment)
router.get(
  "/team",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  getTeamUsers
);

router.get(
  "/assignable",
  authMiddleware,
  allowRoles("admin", "superadmin", "team"),
  getAssignableUsers
);

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  deleteTeamUser
);


export default router;
