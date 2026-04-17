import express from "express";
import { createOrganization, listOrganizations } from "../controllers/orgController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post(
  "/create",
  authMiddleware,
  allowRoles("superadmin"),
  createOrganization
);

router.get(
  "/",
  authMiddleware,
  allowRoles("superadmin"),
  listOrganizations
);

export default router;