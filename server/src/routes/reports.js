import express from "express";
import { exportTaskReport } from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/tasks/export",
  protect,
  allowRoles("admin", "superadmin"),
  exportTaskReport
);

export default router;
