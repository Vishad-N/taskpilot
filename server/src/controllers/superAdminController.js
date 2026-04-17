import User from "../models/User.js";
import Organization from "../models/Organization.js";

// Get all pending users
export const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "pending" }).select("-password");

    res.json({
      success: true,
      users,
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