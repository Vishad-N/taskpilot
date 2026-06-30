import User from "../models/User.js";
import bcrypt from "bcryptjs";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import Organization from "../models/Organization.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

const USER_EDITABLE_ROLES = ["superadmin", "admin", "team", "client"];

const normalizeOrganizationAccess = (organizationId, allowedOrganizations = []) => {
  const primaryOrganizationId = organizationId ? String(organizationId) : "";

  return [...new Set((allowedOrganizations || []).map((value) => String(value)).filter(Boolean))]
    .filter((value) => value !== primaryOrganizationId);
};

const validateOrganizations = async (organizationIds = []) => {
  if (!organizationIds.length) {
    return;
  }

  const organizations = await Organization.find({
    _id: { $in: organizationIds }
  }).select("_id");

  if (organizations.length !== organizationIds.length) {
    const error = new Error("One or more organizations are invalid");
    error.status = 400;
    throw error;
  }
};


// Get all pending users
export const getPendingUsers = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const query = { status: "pending" };

    const [data, totalRecords] = await Promise.all([
      User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      success: true,
      users: data,
      page,
      limit,
      totalRecords,
      totalPages
    });

  } catch (error) {

    res.status(error.status || 500).json({
      error: error.message
    });

  }
};


// Approve user
export const approveUser = async (req, res) => {

  try {

    const { userId, role, organizationId, allowedOrganizations } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    user.status = "approved";
    user.role = role;

    if (!organizationId && role !== "superadmin") {
      return res.status(400).json({
        message: "organizationId is required for approved users"
      });
    }

    const normalizedAllowedOrganizations = normalizeOrganizationAccess(
      organizationId,
      allowedOrganizations
    );

    await validateOrganizations(
      [organizationId, ...normalizedAllowedOrganizations].filter(Boolean)
    );

    if (organizationId) {
      user.organizationId = organizationId;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "allowedOrganizations")) {
      user.allowedOrganizations = normalizedAllowedOrganizations;
    }

    await user.save();

    res.json({
      message: "User approved successfully",
      user
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

};

export const getTeamUsers = async (req, res) => {
  try {
    const orgId = await requireActiveOrganizationId(req);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const query = {
      status: "approved",
      $or: [
        { organizationId: orgId },
        { allowedOrganizations: orgId }
      ]
    };

    const [data, totalRecords] = await Promise.all([
      User.find(query)
        .select("name email role status isActive organizationId")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      users: data,
      page,
      limit,
      totalRecords,
      totalPages
    });

  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message
    });
  }
};

export const getAssignableUsers = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const users = await User.find({
      status: "approved",
      isActive: true,
      $or: [
        {
          $or: [
            { organizationId },
            { allowedOrganizations: organizationId }
          ],
          role: { $in: ["team", "admin", "superadmin"] }
        },
        { _id: req.user._id }
      ]
    })
      .select("name email role organizationId")
      .sort({ name: 1 });

    res.json({ users });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Failed to load assignable users"
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const { search, role, status, organizationId, isActive } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role && role !== "all") query.role = role;
    if (status && status !== "all") query.status = status;
    if (isActive && isActive !== "all") query.isActive = isActive === "active";
    if (organizationId && organizationId !== "all") {
      if (organizationId === "none") {
        query.organizationId = null;
      } else {
        query.organizationId = organizationId;
      }
    }

    const [users, totalRecords] = await Promise.all([
      User.find(query)
        .select("-password")
        .populate("organizationId", "name")
        .populate("allowedOrganizations", "name")
        .populate("projectIds", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      data: users,
      page,
      limit,
      totalRecords,
      totalPages
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load users", error: error.message });
  }
};

export const createUserBySuperAdmin = async (req, res) => {
  try {
    const { name, email, role, organizationId, password, allowedOrganizations, projectIds } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "name, email, and role are required" });
    }

    if (role !== "admin" && role !== "team" && role !== "client") {
      return res.status(400).json({ message: "role must be admin, team, or client" });
    }

    if (!organizationId) {
      return res.status(400).json({ message: "organizationId is required" });
    }

    const normalizedEmail = String(email).toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const normalizedAllowedOrganizations = normalizeOrganizationAccess(
      organizationId,
      allowedOrganizations
    );

    await validateOrganizations([String(organizationId), ...normalizedAllowedOrganizations]);

    const rawPassword =
      password && String(password).trim().length >= 6
        ? String(password)
        : Math.random().toString(36).slice(2, 10) + "A1!";

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      organizationId,
      allowedOrganizations: normalizedAllowedOrganizations,
      projectIds: role === "client" ? (projectIds || []) : [],
      status: "approved"
    });

    res.status(201).json({
      message: "User created",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      credentials: {
        email: normalizedEmail,
        password: rawPassword
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create user", error: error.message });
  }
};

export const updateUserBySuperAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      name,
      email,
      role,
      organizationId,
      allowedOrganizations,
      projectIds,
      status,
      isActive
    } = req.body;

    if (role && !USER_EDITABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role provided" });
    }

    if (status && !["pending", "approved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status provided" });
    }

    if (req.user?.id && String(req.user.id) === String(user._id)) {
      if (role && role !== "superadmin") {
        return res.status(400).json({ message: "You cannot remove your own superadmin role" });
      }

      if (isActive === false) {
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
    }

    const nextRole = role || user.role;
    const nextStatus = status || user.status;
    const nextOrganizationId =
      Object.prototype.hasOwnProperty.call(req.body, "organizationId")
        ? organizationId || null
        : user.organizationId;

    if (nextRole !== "superadmin" && nextStatus === "approved" && !nextOrganizationId) {
      return res.status(400).json({
        message: "An approved non-superadmin user must have a primary organization"
      });
    }

    const normalizedAllowedOrganizations = Object.prototype.hasOwnProperty.call(
      req.body,
      "allowedOrganizations"
    )
      ? normalizeOrganizationAccess(nextOrganizationId, allowedOrganizations)
      : normalizeOrganizationAccess(nextOrganizationId, user.allowedOrganizations);

    await validateOrganizations(
      [
        nextOrganizationId ? String(nextOrganizationId) : null,
        ...normalizedAllowedOrganizations
      ].filter(Boolean)
    );

    if (name !== undefined) {
      const normalizedName = String(name).trim();

      if (!normalizedName) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }

      user.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({ message: "Another user already uses this email" });
      }

      user.email = normalizedEmail;
    }

    if (role !== undefined) {
      user.role = role;
    }

    if (status !== undefined) {
      user.status = status;
    }

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "organizationId")) {
      user.organizationId = nextOrganizationId;
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "organizationId") ||
      Object.prototype.hasOwnProperty.call(req.body, "allowedOrganizations")
    ) {
      user.allowedOrganizations = normalizedAllowedOrganizations;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "projectIds")) {
      user.projectIds = nextRole === "client" ? (projectIds || []) : [];
    } else if (nextRole !== "client") {
      user.projectIds = [];
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("organizationId", "name")
      .populate("allowedOrganizations", "name")
      .populate("projectIds", "name");

    res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Failed to update user"
    });
  }
};

export const deleteTeamUser = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "team") {
      return res.status(400).json({ message: "Only team users can be deleted by admins" });
    }

    if (String(user.organizationId) !== String(organizationId)) {
      return res.status(403).json({ message: "User does not belong to the selected organization" });
    }

    await Promise.all([
      Task.updateMany({ assignedTo: user._id }, { $unset: { assignedTo: "" } }),
      Project.updateMany(
        { teamMembers: user._id },
        { $pull: { teamMembers: user._id } }
      ),
      User.findByIdAndDelete(user._id)
    ]);

    res.json({ message: "Team user deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete team user"
    });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = await bcrypt.hash(String(password), 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update password", error: error.message });
  }
};
