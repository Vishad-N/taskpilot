import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  updateMe
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);          // No auth needed – always clear the cookie
router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateMe);

export default router;
