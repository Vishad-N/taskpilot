import express from "express";
import {
  createProject,
  getOrganizationProjects,
  getProjectById,
  updateProject,
  deleteProject
} from "../controllers/projectController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();


router.post(
  "/create",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  createProject
);


router.get(
  "/org-projects",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getOrganizationProjects
);

router.get(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getProjectById
);

router.patch(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  updateProject
);

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  deleteProject
);


export default router;
