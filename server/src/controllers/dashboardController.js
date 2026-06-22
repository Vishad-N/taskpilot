import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { resolveActiveOrganizationId } from "../utils/organizationScope.js";

export const getDashboardStats = async (req, res) => {
  try {
    const orgId = await resolveActiveOrganizationId(req);
    const role = req.user.role;

    // SUPERADMIN DASHBOARD
    if (role === "superadmin") {
      const organizationFilter = orgId ? { organizationId: orgId } : {};
      const [organization, totalUsers, totalProjects, totalTasks] = await Promise.all([
        orgId ? Organization.findById(orgId).select("_id name") : Promise.resolve(null),
        orgId
          ? User.countDocuments({
              $or: [
                { organizationId: orgId },
                { allowedOrganizations: orgId }
              ]
            })
          : User.countDocuments(),
        Project.countDocuments(organizationFilter),
        Task.countDocuments(organizationFilter)
      ]);

      return res.json({
        role: "superadmin",
        organization,
        totalUsers,
        totalProjects,
        totalTasks
      });
    }


    // ADMIN DASHBOARD
    if (role === "admin") {
      const organization = orgId
        ? await Organization.findById(orgId).select("_id name")
        : null;

      const totalProjects = await Project.countDocuments({
        organizationId: orgId
      });

      const totalTasks = await Task.countDocuments({
        organizationId: orgId
      });

      const completedTasks = await Task.countDocuments({
        organizationId: orgId,
        status: "completed"
      });

      const pendingTasks = await Task.countDocuments({
        organizationId: orgId,
        status: "pending"
      });

      return res.json({
        role: "admin",
        organization,
        totalProjects,
        totalTasks,
        completedTasks,
        pendingTasks
      });
    }


    // TEAM DASHBOARD
    if (role === "team") {
      const organization = orgId
        ? await Organization.findById(orgId).select("_id name")
        : null;

      const myTasks = await Task.countDocuments({
        assignedTo: req.user._id,
        organizationId: orgId
      });

      const completed = await Task.countDocuments({
        assignedTo: req.user._id,
        organizationId: orgId,
        status: "completed"
      });

      const inProgress = await Task.countDocuments({
        assignedTo: req.user._id,
        organizationId: orgId,
        status: "inprogress"
      });

      return res.json({
        role: "team",
        organization,
        myTasks,
        completed,
        inProgress
      });
    }


    // CLIENT DASHBOARD
    if (role === "client") {
      const organization = orgId
        ? await Organization.findById(orgId).select("_id name")
        : null;

      const baseProjectFilter = {
        organizationId: orgId,
        clientVisible: true
      };

      const baseTaskFilter = {
        organizationId: orgId,
        clientVisible: true
      };

      if (req.user.projectIds && req.user.projectIds.length > 0) {
        baseProjectFilter._id = { $in: req.user.projectIds };
        baseTaskFilter.projectId = { $in: req.user.projectIds };
      }

      const totalProjects = await Project.countDocuments(baseProjectFilter);

      const completedTasks = await Task.countDocuments({
        ...baseTaskFilter,
        status: "completed"
      });

      const inProgressTasks = await Task.countDocuments({
        ...baseTaskFilter,
        status: "inprogress"
      });

      const pendingTasks = await Task.countDocuments({
        ...baseTaskFilter,
        status: "pending"
      });

      return res.json({
        role: "client",
        organization,
        totalProjects,
        completedTasks,
        inProgressTasks,
        pendingTasks
      });
    }

  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
