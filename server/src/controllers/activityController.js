import ActivityLog from "../models/ActivityLog.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

export const getActivityFeed = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const [data, totalRecords] = await Promise.all([
      ActivityLog.find({ organizationId })
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments({ organizationId })
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      data,
      page,
      limit,
      totalRecords,
      totalPages
    });

  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getProjectActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    const organizationId = await requireActiveOrganizationId(req);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const [data, totalRecords] = await Promise.all([
      ActivityLog.find({ organizationId, projectId })
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments({ organizationId, projectId })
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      data,
      page,
      limit,
      totalRecords,
      totalPages
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
