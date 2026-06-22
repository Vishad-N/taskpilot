import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import ActivityLog from "../models/ActivityLog.js";
import Notification from "../models/Notification.js";
import {
  requireActiveOrganizationId
} from "../utils/organizationScope.js";


// Create Project
export const createProject = async (req, res) => {
  try {

    const {
      name,
      description,
      teamMembers,
      priority,
      dueDate,
      clientVisible,
      organizationId
    } = req.body;

    const orgId = organizationId || await requireActiveOrganizationId(req);

    if (!orgId) {
      return res.status(400).json({
        message:
          "organizationId is required. SuperAdmin must provide organizationId (or have one assigned)."
      });
    }

    const project = await Project.create({
      name,
      description,
      teamMembers,
      priority,
      dueDate,
      clientVisible,
      ownerId: req.user._id,
      organizationId: orgId
    });

    res.status(201).json({
      message: "Project created successfully",
      project
    });

  } catch (error) {
    console.error("Error creating project:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
};


// Get Organization Projects
export const getOrganizationProjects = async (req, res) => {
  try {

    const orgId = await requireActiveOrganizationId(req);

    const query = {
      organizationId: orgId
    };

    // Clients can only see clientVisible projects
    if (req.user.role === "client") {
      query.clientVisible = true;
      if (req.user.projectIds && req.user.projectIds.length > 0) {
        query._id = { $in: req.user.projectIds };
      }
    }

    const projects = await Project.find(query).populate(
      "teamMembers",
      "name email role"
    );

    res.json({
      projects
    });

  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const orgId = await requireActiveOrganizationId(req);

    const project = await Project.findOne({
      _id: req.params.id,
      organizationId: orgId
    }).populate("teamMembers", "name email role");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Clients can only view clientVisible projects
    if (req.user.role === "client" && !project.clientVisible) {
      return res.status(403).json({ message: "Not allowed" });
    }

    res.json({ project });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const orgId = await requireActiveOrganizationId(req);
    const project = await Project.findOne({
      _id: req.params.id,
      organizationId: orgId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const {
      name,
      description,
      priority,
      dueDate,
      clientVisible,
      status
    } = req.body;

    const before = {
      name: project.name,
      description: project.description,
      priority: project.priority,
      status: project.status,
      dueDate: project.dueDate,
      clientVisible: project.clientVisible
    };

    if (typeof name === "string" && name.trim()) project.name = name.trim();
    if (typeof description === "string") project.description = description;
    if (typeof priority === "string") project.priority = priority;
    if (typeof status === "string") project.status = status;
    if (typeof clientVisible === "boolean") project.clientVisible = clientVisible;
    if (dueDate !== undefined) project.dueDate = dueDate || undefined;

    await project.save();

    await ActivityLog.create({
      userId: req.user._id,
      action: `edited project "${project.name}"`,
      entityType: "project",
      entityId: project._id,
      organizationId: orgId,
      projectId: project._id,
      changes: {
        before,
        after: {
          name: project.name,
          description: project.description,
          priority: project.priority,
          status: project.status,
          dueDate: project.dueDate,
          clientVisible: project.clientVisible
        }
      }
    });

    res.json({
      message: "Project updated successfully",
      project
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const orgId = await requireActiveOrganizationId(req);
    const project = await Project.findOne({
      _id: req.params.id,
      organizationId: orgId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const tasks = await Task.find({
      projectId: project._id,
      organizationId: orgId
    }).select("_id");

    const taskIds = tasks.map((task) => task._id);

    await Comment.deleteMany({ taskId: { $in: taskIds } });
    await Notification.deleteMany({
      organizationId: orgId,
      $or: [
        { entityType: "project", entityId: project._id },
        { entityType: "task", entityId: { $in: taskIds } }
      ]
    });
    await Task.deleteMany({
      projectId: project._id,
      organizationId: orgId
    });
    await ActivityLog.create({
      userId: req.user._id,
      action: `deleted project "${project.name}"`,
      entityType: "project",
      entityId: project._id,
      organizationId: orgId,
      projectId: project._id,
      changes: {
        deletedProjectName: project.name,
        deletedTaskCount: taskIds.length
      }
    });
    await Project.deleteOne({ _id: project._id });

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
