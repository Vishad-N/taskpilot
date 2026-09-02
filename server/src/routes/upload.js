import express from "express";
import { getUploadUrl, getDownloadUrl } from "../controllers/uploadController.js";
import authMiddleware from "../middleware/authMiddleware.js"; 

const router = express.Router();

router.post("/presigned-url", authMiddleware, getUploadUrl);
router.get("/download-url", authMiddleware, getDownloadUrl);

export default router;
