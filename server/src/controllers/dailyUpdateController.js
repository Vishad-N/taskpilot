import DailyUpdate from "../models/DailyUpdate.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import ActivityLog from "../models/ActivityLog.js";

const getTodayKey = (timezoneOffsetMinutes = 0) => {
  const now = new Date();
  const local = new Date(now.getTime() - timezoneOffsetMinutes * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

export const createDailyUpdate = async (req, res) => {
  try {
    const { content, taskId, projectId, timezoneOffsetMinutes } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "content is required" });
    }

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (taskId) {
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
    }

    const date = getTodayKey(Number(timezoneOffsetMinutes) || 0);

    const update = await DailyUpdate.create({
      content: String(content).trim(),
      taskId: taskId || null,
      projectId,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      date
    });

    await ActivityLog.create({
      userId: req.user._id,
      action: "daily_update_posted",
      entityType: "task",
      entityId: taskId || projectId,
      organizationId: req.user.organizationId,
      projectId,
      changes: { date }
    });

    const populated = await DailyUpdate.findById(update._id)
      .populate("userId", "name email role");

    res.status(201).json({ update: populated });
  } catch (error) {
    res.status(500).json({ message: "Failed to create daily update", error: error.message });
  }
};

export const getTaskDailyUpdates = async (req, res) => {
  try {
    const { taskId } = req.params;

    const updates = await DailyUpdate.find({ taskId })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    res.json({ updates });
  } catch (error) {
    res.status(500).json({ message: "Failed to get daily updates", error: error.message });
  }
};

export const getProjectDailyUpdates = async (req, res) => {
  try {
    const { projectId } = req.params;

    const updates = await DailyUpdate.find({ projectId })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    res.json({ updates });
  } catch (error) {
    res.status(500).json({ message: "Failed to get daily updates", error: error.message });
  }
};

export const getOrganizationDailyUpdates = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const limit = parseInt(req.query.limit) || 20;

    const updates = await DailyUpdate.find({ organizationId })
      .populate("userId", "name email role")
      .populate("projectId", "name")
      .populate("taskId", "title")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ updates });
  } catch (error) {
    res.status(500).json({ message: "Failed to get organization daily updates", error: error.message });
  }
};

export const deleteDailyUpdate = async (req, res) => {
  try {
    const update = await DailyUpdate.findById(req.params.id);

    if (!update) {
      return res.status(404).json({ message: "Daily update not found" });
    }

    const isOwner = String(update.userId) === String(req.user._id);
    const isAdminOrSuperadmin = req.user.role === "admin" || req.user.role === "superadmin";

    if (!isOwner && !isAdminOrSuperadmin) {
      return res.status(403).json({ message: "Not authorized to delete this update" });
    }

    await update.deleteOne();
    res.json({ message: "Daily update deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete daily update", error: error.message });
  }
};
