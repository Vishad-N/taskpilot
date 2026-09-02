import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

// S3 Client configuration for Cloudflare R2
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

/**
 * Generate a pre-signed URL for uploading a file (PutObject).
 * 
 * @param {string} key The object key (path/filename in bucket)
 * @param {string} contentType The MIME type of the file
 * @param {number} expiresIn URL expiration time in seconds
 * @returns {Promise<string>} The pre-signed URL
 */
export const generateUploadUrl = async (key, contentType, expiresIn = 3600) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
};

/**
 * Generate a pre-signed URL for downloading/viewing a file (GetObject).
 * 
 * @param {string} key The object key
 * @param {number} expiresIn URL expiration time in seconds
 * @returns {Promise<string>} The pre-signed URL
 */
export const generateDownloadUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
};
