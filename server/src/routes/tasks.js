import express from "express";
import {
  createTask,
  getMyTasks,
  updateTaskStatus,
  getTaskById,
  updateTask,
  deleteTask,
  startTaskWorkSession,
  pauseTaskWorkSession,
  stopTaskWorkSession,
  getTaskWorkSummary,
  getCurrentWorkSession,
  pauseCurrentWorkSession,
  searchTasks
} from "../controllers/taskController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { getOrganizationTasks } from "../controllers/taskController.js";
import { getProjectTasks } from "../controllers/taskController.js";
import { getClientTasks } from "../controllers/taskController.js";

const router = express.Router();


router.post(
  "/create",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  createTask
);


router.get(
  "/my-tasks",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getMyTasks
);


router.patch(
  "/update-status/:id",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  updateTaskStatus
);


router.get(
  "/org-tasks",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getOrganizationTasks
);

router.get(
  "/search",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  searchTasks
);

router.get(
  "/project/:projectId",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getProjectTasks
);

router.get(
  "/client-view",
  authMiddleware,
  allowRoles("client"),
  getClientTasks
);

router.get(
  "/work/current",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getCurrentWorkSession
);

router.post(
  "/work/pause-active",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  pauseCurrentWorkSession
);

router.post(
  "/:id/work/start",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  startTaskWorkSession
);

router.post(
  "/:id/work/pause",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  pauseTaskWorkSession
);

router.post(
  "/:id/work/stop",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  stopTaskWorkSession
);

router.get(
  "/:id/work-summary",
  authMiddleware,
  allowRoles("superadmin", "admin", "team"),
  getTaskWorkSummary
);

router.get(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getTaskById
);

router.patch(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  updateTask
);

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  deleteTask
);

export default router;
