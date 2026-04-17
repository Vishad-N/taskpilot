import app from "../src/index.js";
import connectDb from "../src/db.js";

export default async function handler(req, res) {
  try {
    await connectDb();
  } catch (error) {
    console.error("DB FAILED:", error);
    return res.status(500).json({
      error: "Database connection failed",
      detail: error.message
    });
  }

  return app(req, res);
}
