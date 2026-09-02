import { generateUploadUrl, generateDownloadUrl } from "../utils/r2.js";
import crypto from "crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const getUploadUrl = async (req, res) => {
  try {
    const { filename, fileType, size } = req.body;

    if (!filename || !fileType || !size) {
      return res.status(400).json({ message: "Filename, fileType, and size are required." });
    }

    if (size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File exceeds the 50MB limit." });
    }

    // Generate a unique object key to prevent overwriting
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const extension = filename.split(".").pop();
    const key = `uploads/${uniqueId}.${extension}`;

    const uploadUrl = await generateUploadUrl(key, fileType);

    res.status(200).json({
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
};

export const getDownloadUrl = async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ message: "Object key is required." });
    }

    const downloadUrl = await generateDownloadUrl(key);

    res.status(200).json({ downloadUrl });
  } catch (error) {
    console.error("Error generating download URL:", error);
    res.status(500).json({ message: "Failed to generate download URL" });
  }
};
