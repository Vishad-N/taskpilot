import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import connectDb from "./db.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import superAdminRoutes from "./routes/superadmin.js";
import organizationRoutes from "./routes/organization.js";
import projectRoutes from "./routes/projects.js";
import commentRoutes from "./routes/comments.js";
import activityRoutes from "./routes/activity.js";
import dashboardRoutes from "./routes/dashboard.js";
import userRoutes from "./routes/users.js";
import notificationRoutes from "./routes/notification.js";
import dailyUpdateRoutes from "./routes/dailyUpdates.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import reportRoutes from "./routes/reports.js";
import { initCronJobs } from "./utils/cronJobs.js";
import { initSocket } from "./services/socketHandler.js";
import http from "http";

const PORT = process.env.PORT || 8000;

const app = express();
app.set("trust proxy", 1);

const server = http.createServer(app);
initSocket(server);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// Connect to DB on every request (cached internally by connectDb)
app.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    next(error);
  }
});

// Rate limiter applied BEFORE routes so all endpoints are protected
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please wait a moment and try again."
  }
});

app.use(limiter);

app.use("/projects", projectRoutes);
app.use("/tasks", taskRoutes);
app.use("/organization", organizationRoutes);
app.use("/superadmin", superAdminRoutes);
app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/comments", commentRoutes);
app.use("/users", userRoutes);
app.use("/notifications", notificationRoutes);
app.use("/activity", activityRoutes);
app.use("/daily-updates", dailyUpdateRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/reports", reportRoutes);
app.get("/", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled server error:", error);
  res.status(500).json({
    message: error.message || "Internal server error"
  });
});

server.listen(PORT, () => {
  console.log(`TaskPilot backend running on http://localhost:${PORT}`);
  initCronJobs();
});

export default app;
