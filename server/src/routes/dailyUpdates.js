import express from "express";
import {
  createDailyUpdate,
  getTaskDailyUpdates,
  getProjectDailyUpdates,
  getOrganizationDailyUpdates,
  deleteDailyUpdate
} from "../controllers/dailyUpdateController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  createDailyUpdate
);

router.get(
  "/organization",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getOrganizationDailyUpdates
);

router.get(
  "/task/:taskId",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getTaskDailyUpdates
);

router.get(
  "/project/:projectId",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getProjectDailyUpdates
);

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  deleteDailyUpdate
);

export default router;
