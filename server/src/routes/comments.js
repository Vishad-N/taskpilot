import express from "express";
import {
  addComment,
  getTaskComments
} from "../controllers/commentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();


router.post(
  "/add",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  addComment
);


router.get(
  "/task/:taskId",
  authMiddleware,
  allowRoles("superadmin", "admin", "team", "client"),
  getTaskComments
);

export default router;