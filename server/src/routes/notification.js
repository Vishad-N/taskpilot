import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.patch("/mark-all-read", authMiddleware, markAllAsRead);
router.patch("/:id", authMiddleware, markAsRead);

export default router;
