import ActivityLog from "../models/ActivityLog.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

export const getActivityFeed = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const logs = await ActivityLog.find({
      organizationId
    })
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      logs
    });

  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = await requireActiveOrganizationId(req);

    const logs = await ActivityLog.find({
      organizationId,
      projectId
    })
      .populate("userId", "name")
      .sort({ createdAt: -1 });
    res.json({ logs });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
