import User from "../models/User.js";
import Organization from "../models/Organization.js";

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
    res.status(500).json({ error: error.message });
  }
};


// Approve user and assign role + organization
export const approveUser = async (req, res) => {
  try {
    const { userId, role, organizationId, allowedOrganizations } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    user.organizationId = organizationId;
    user.allowedOrganizations = allowedOrganizations || [];
    user.status = "approved";

    await user.save();

    res.json({
      message: "User approved successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};