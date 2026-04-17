import express from "express";
import { getActivityFeed } from "../controllers/activityController.js";
import { getProjectActivity } from "../controllers/activityController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/feed",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  getActivityFeed
);

router.get(
  "/project/:projectId",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getProjectActivity
);

export default router;