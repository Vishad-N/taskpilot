import mongoose from "mongoose";
import LeaveType from "../models/LeaveType.js";
import LeaveBalance from "../models/LeaveBalance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Notification from "../models/Notification.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";
import { getISTDateString } from "../utils/dateUtils.js";

// Utility function to get current year
const getCurrentYear = () => new Date().getFullYear();

export const initializeLeaveTypes = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const defaultTypes = [
      {
        name: "Earned Leave",
        code: "EL",
        applicableGenders: ["male", "female"],
        creditsPerYear: 12,
        creditsPerMonth: 1,
        maxCarryForward: 6,
        requiresApproval: true,
        maxConsecutiveDays: 0,
      },
      {
        name: "Menstrual Leave",
        code: "MSL",
        applicableGenders: ["female"],
        creditsPerYear: 12,
        creditsPerMonth: 1,
        maxCarryForward: 0,
        requiresApproval: false,
        maxConsecutiveDays: 1,
      },
      {
        name: "Maternity Leave",
        code: "ML",
        applicableGenders: ["female"],
        creditsPerYear: 180, // e.g., 6 months
        creditsPerMonth: 0,
        maxCarryForward: 0,
        requiresApproval: true,
        maxConsecutiveDays: 180,
      }
    ];

    for (const type of defaultTypes) {
      await LeaveType.findOneAndUpdate(
        { organizationId, code: type.code },
        { ...type, organizationId },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({ message: "Leave types initialized successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to initialize leave types.", error: error.message });
  }
};

export const getLeaveTypes = async (req, res) => {
  try {
    const { gender } = req.user;
    const organizationId = await requireActiveOrganizationId(req);
    const query = { organizationId, isActive: true };

    if (gender && gender !== "not_specified" && req.query.all !== "true") {
      query.applicableGenders = gender;
    }

    let leaveTypes = await LeaveType.find(query);

    if (leaveTypes.length === 0) {
      const defaultTypes = [
        {
          name: "Earned Leave",
          code: "EL",
          applicableGenders: ["male", "female"],
          creditsPerYear: 12,
          creditsPerMonth: 1,
          creditsPerMonth: 1,
          maxCarryForward: 0,
          requiresApproval: true,
          maxConsecutiveDays: 1,
        },
        {
          name: "Menstrual Leave",
          code: "MSL",
          applicableGenders: ["female"],
          creditsPerYear: 12,
          creditsPerMonth: 1,
          maxCarryForward: 0,
          requiresApproval: false,
          maxConsecutiveDays: 1,
        },
        {
          name: "Maternity Leave",
          code: "ML",
          applicableGenders: ["female"],
          creditsPerYear: 180,
          creditsPerMonth: 0,
          maxCarryForward: 0,
          requiresApproval: true,
          maxConsecutiveDays: 180,
        }
      ];

      for (const type of defaultTypes) {
        await LeaveType.findOneAndUpdate(
          { organizationId, code: type.code },
          { ...type, organizationId },
          { upsert: true, new: true }
        );
      }
      leaveTypes = await LeaveType.find(query);
    }

    res.status(200).json({ leaveTypes });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leave types.", error: error.message });
  }
};

export const getMyLeaveBalances = async (req, res) => {
  try {
    const { _id: userId, gender } = req.user;
    const organizationId = await requireActiveOrganizationId(req);
    const year = getCurrentYear();

    // Auto-initialize missing balances
    const ltQuery = { organizationId, isActive: true };
    if (gender && gender !== "not_specified") {
      ltQuery.applicableGenders = gender;
    }
    const leaveTypes = await LeaveType.find(ltQuery);
    
    for (const leaveType of leaveTypes) {
      const balanceExists = await LeaveBalance.exists({ userId, leaveTypeId: leaveType._id, year });
      if (!balanceExists) {
        let expired = 0;
        if (leaveType.creditsPerMonth === 1) {
          expired = new Date().getMonth(); // Expire past months
        }

        await LeaveBalance.create({
          userId,
          organizationId,
          leaveTypeId: leaveType._id,
          year,
          totalCredits: leaveType.creditsPerYear,
          used: 0,
          pending: 0,
          expired
        });
      }
    }

    const balances = await LeaveBalance.find({ userId, organizationId, year })
      .populate("leaveTypeId", "name code requiresApproval");
      
    res.status(200).json({ balances });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leave balances.", error: error.message });
  }
};

export const getUserLeaveBalances = async (req, res) => {
  try {
    const { userId } = req.params;
    const organizationId = await requireActiveOrganizationId(req);
    const year = getCurrentYear();

    const balances = await LeaveBalance.find({ userId, organizationId, year })
      .populate("leaveTypeId", "name code");

    res.status(200).json({ balances });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user leave balances.", error: error.message });
  }
};

export const getAllLeaveBalances = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const year = getCurrentYear();

    const balances = await LeaveBalance.find({ organizationId, year })
      .populate("userId", "name email gender role")
      .populate("leaveTypeId", "name code");

    res.status(200).json({ balances });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all leave balances.", error: error.message });
  }
};

export const applyLeave = async (req, res) => {
  try {
    const { _id: userId, gender, name: userName } = req.user;
    const organizationId = await requireActiveOrganizationId(req);
    const { leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod, reason } = req.body;

    if (!gender || gender === "not_specified") {
      return res.status(403).json({ message: "Please update your gender in your profile to apply for leave." });
    }

    const leaveType = await LeaveType.findOne({ _id: leaveTypeId, organizationId, isActive: true });
    if (!leaveType) {
      return res.status(404).json({ message: "Leave type not found or inactive." });
    }

    if (!leaveType.applicableGenders.includes(gender)) {
      return res.status(403).json({ message: "You are not eligible for this leave type based on gender." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ message: "End date cannot be before start date." });
    }

    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = isHalfDay ? 0.5 : daysDiff;

    if (leaveType.maxConsecutiveDays > 0 && totalDays > leaveType.maxConsecutiveDays) {
      return res.status(400).json({ message: `Cannot apply for more than ${leaveType.maxConsecutiveDays} consecutive days of ${leaveType.name}.` });
    }

    // Monthly strict validation for Use-It-Or-Lose-It types (Earned Leave, Menstrual Leave)
    if (leaveType.creditsPerMonth === 1) {
      if (totalDays > 1) {
        return res.status(400).json({ message: `You can only apply for a maximum of 1 day at a time for ${leaveType.name}.` });
      }

      // Check if they already applied for a leave of this type this month
      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      
      // We check the start date of past leaves to see if it falls in the same month
      // Mongoose makes it easy if we construct a date range for the month
      const monthStart = new Date(startYear, startMonth, 1);
      const monthEnd = new Date(startYear, startMonth + 1, 0, 23, 59, 59);

      const existingMonthlyRequest = await LeaveRequest.findOne({
        userId,
        leaveTypeId,
        status: { $in: ["Pending", "Approved"] },
        startDate: { $gte: monthStart, $lte: monthEnd }
      });

      if (existingMonthlyRequest) {
        return res.status(400).json({ message: `You have already applied for ${leaveType.name} in this calendar month.` });
      }
    }

    // Check balance
    const year = start.getFullYear();
    let balance = await LeaveBalance.findOne({ userId, leaveTypeId, year });
    if (!balance) {
      let expired = 0;
      if (leaveType.creditsPerMonth === 1) {
        expired = new Date().getMonth();
      }

      balance = new LeaveBalance({
        userId,
        organizationId,
        leaveTypeId,
        year,
        totalCredits: leaveType.creditsPerYear,
        used: 0,
        pending: 0,
        expired
      });
      await balance.save();
    }

    if (balance.available < totalDays) {
      return res.status(400).json({ message: `Insufficient leave balance. You have ${balance.available} days available.` });
    }

    // Check overlaps
    const overlaps = await LeaveRequest.find({
      userId,
      status: { $in: ["Pending", "Approved"] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    if (overlaps.length > 0) {
      return res.status(400).json({ message: "You already have a leave request overlapping with these dates." });
    }

    // Auto-approve if requiresApproval is false
    const initialStatus = leaveType.requiresApproval ? "Pending" : "Approved";

    const request = new LeaveRequest({
      userId,
      organizationId,
      leaveTypeId,
      startDate,
      endDate,
      totalDays,
      isHalfDay,
      halfDayPeriod,
      reason,
      status: initialStatus
    });

    await request.save();

    if (initialStatus === "Pending") {
      balance.pending += totalDays;
    } else {
      balance.used += totalDays;
    }
    await balance.save();

    // Notifications
    if (initialStatus === "Pending") {
      const admins = await User.find({ organizationId, role: { $in: ["admin", "superadmin"] } });
      const notifications = admins.map((admin) => ({
        userId: admin._id,
        organizationId,
        title: "New Leave Request",
        message: `${userName} applied for ${totalDays} days of ${leaveType.name}.`,
        type: "leave_applied"
      }));
      if (notifications.length > 0) await Notification.insertMany(notifications);
    } else {
      // Create attendance records if auto-approved
      const attendanceRecords = [];
      let current = new Date(start);
      while (current <= end) {
        attendanceRecords.push({
          userId,
          organizationId,
          attendanceDate: getISTDateString(current),
          status: isHalfDay ? "Half Day" : "On Leave",
          totalHours: isHalfDay ? 4 : 0
        });
        current.setDate(current.getDate() + 1);
      }
      
      for (const record of attendanceRecords) {
        await Attendance.findOneAndUpdate(
          { userId, attendanceDate: record.attendanceDate },
          record,
          { upsert: true }
        );
      }
    }

    res.status(201).json({ message: `Leave application submitted. Status: ${initialStatus}`, request });
    try {
      const { getIO } = await import("../services/socketHandler.js");
      getIO().to(`org:${organizationId}`).emit("leave_updated");
    } catch (err) {
      console.error("Socket emit failed:", err);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to apply leave.", error: error.message });
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user;

    const request = await LeaveRequest.findOne({ _id: id, userId });
    if (!request) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Can only cancel pending requests." });
    }

    request.status = "Cancelled";
    await request.save();

    const start = new Date(request.startDate);
    const balance = await LeaveBalance.findOne({ userId, leaveTypeId: request.leaveTypeId, year: start.getFullYear() });
    
    if (balance) {
      balance.pending -= request.totalDays;
      await balance.save();
    }

    res.status(200).json({ message: "Leave request cancelled.", request });
    try {
      const { getIO } = await import("../services/socketHandler.js");
      getIO().to(`org:${request.organizationId}`).emit("leave_updated");
    } catch (err) {
      console.error("Socket emit failed:", err);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel leave.", error: error.message });
  }
};

export const getMyLeaveRequests = async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const requests = await LeaveRequest.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("leaveTypeId", "name code")
      .populate("reviewedBy", "name");

    const total = await LeaveRequest.countDocuments({ userId });

    res.status(200).json({
      requests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leave requests.", error: error.message });
  }
};

export const getAllLeaveRequests = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { status, leaveTypeId, startDate, endDate, search } = req.query;

    const query = { organizationId };
    
    if (status && status !== "all") query.status = status;
    if (leaveTypeId && leaveTypeId !== "all") query.leaveTypeId = leaveTypeId;
    
    if (startDate && endDate) {
      query.$or = [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } }
      ];
    }

    let userIds = [];
    if (search) {
      const users = await User.find({ 
        organizationId, 
        name: { $regex: search, $options: "i" } 
      }).select("_id");
      userIds = users.map(u => u._id);
      query.userId = { $in: userIds };
    }

    const requests = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email avatar")
      .populate("leaveTypeId", "name code")
      .populate("reviewedBy", "name");

    const total = await LeaveRequest.countDocuments(query);

    res.status(200).json({
      requests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all leave requests.", error: error.message });
  }
};

export const reviewLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;
    const { _id: adminId } = req.user;
    const organizationId = await requireActiveOrganizationId(req);

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be Approved or Rejected." });
    }

    const request = await LeaveRequest.findOne({ _id: id, organizationId }).populate("userId", "name");
    if (!request) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ message: `Request is already ${request.status}.` });
    }

    request.status = status;
    request.reviewNote = reviewNote;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    await request.save();

    const start = new Date(request.startDate);
    const balance = await LeaveBalance.findOne({ userId: request.userId._id, leaveTypeId: request.leaveTypeId, year: start.getFullYear() });

    if (balance) {
      balance.pending -= request.totalDays;
      if (status === "Approved") {
        balance.used += request.totalDays;
      }
      await balance.save();
    }

    if (status === "Approved") {
      const end = new Date(request.endDate);
      const attendanceRecords = [];
      let current = new Date(start);
      
      while (current <= end) {
        attendanceRecords.push({
          userId: request.userId._id,
          organizationId,
          attendanceDate: getISTDateString(current),
          status: request.isHalfDay ? "Half Day" : "On Leave",
          totalHours: request.isHalfDay ? 4 : 0
        });
        current.setDate(current.getDate() + 1);
      }

      for (const record of attendanceRecords) {
        await Attendance.findOneAndUpdate(
          { userId: record.userId, attendanceDate: record.attendanceDate },
          record,
          { upsert: true }
        );
      }
    }

    // Send notification
    await Notification.create({
      userId: request.userId._id,
      organizationId,
      title: `Leave Request ${status}`,
      message: `Your leave request for ${request.totalDays} days has been ${status.toLowerCase()}.`,
      type: status === "Approved" ? "leave_approved" : "leave_rejected"
    });

    res.status(200).json({ message: `Leave request ${status.toLowerCase()}.`, request });
    try {
      const { getIO } = await import("../services/socketHandler.js");
      getIO().to(`org:${organizationId}`).emit("leave_updated");
    } catch (err) {
      console.error("Socket emit failed:", err);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to review leave request.", error: error.message });
  }
};

export const getLeaveAnalytics = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const year = getCurrentYear();
    
    // Monthly stats
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0,0,0,0);
    
    const pendingCount = await LeaveRequest.countDocuments({ organizationId, status: "Pending" });
    
    const approvedThisMonth = await LeaveRequest.countDocuments({ 
      organizationId, 
      status: "Approved",
      reviewedAt: { $gte: monthStart }
    });

    res.status(200).json({
      pendingCount,
      approvedThisMonth
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leave analytics.", error: error.message });
  }
};

export const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = await requireActiveOrganizationId(req);
    const { creditsPerYear, creditsPerMonth, maxCarryForward, maxConsecutiveDays, requiresApproval } = req.body;

    const leaveType = await LeaveType.findOneAndUpdate(
      { _id: id, organizationId },
      { 
        $set: { 
          creditsPerYear, 
          creditsPerMonth, 
          maxCarryForward, 
          maxConsecutiveDays, 
          requiresApproval 
        } 
      },
      { new: true }
    );

    if (!leaveType) {
      return res.status(404).json({ message: "Leave type not found." });
    }

    res.status(200).json({ leaveType, message: "Leave type updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to update leave type.", error: error.message });
  }
};

export const updateLeaveBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = await requireActiveOrganizationId(req);
    const { totalCredits } = req.body;

    const balance = await LeaveBalance.findOne({ _id: id, organizationId });
    if (!balance) {
      return res.status(404).json({ message: "Leave balance not found." });
    }

    balance.totalCredits = totalCredits;
    await balance.save();

    res.status(200).json({ balance, message: "Leave balance updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to update leave balance.", error: error.message });
  }
};

export const createLeaveType = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { name, code, applicableGenders, creditsPerYear, creditsPerMonth, maxCarryForward, maxConsecutiveDays, requiresApproval } = req.body;

    const existingType = await LeaveType.findOne({ organizationId, code });
    if (existingType) {
      return res.status(400).json({ message: "A leave type with this code already exists." });
    }

    const leaveType = new LeaveType({
      organizationId,
      name,
      code,
      applicableGenders: applicableGenders || ["male", "female"],
      creditsPerYear: creditsPerYear || 0,
      creditsPerMonth: creditsPerMonth || 0,
      maxCarryForward: maxCarryForward || 0,
      maxConsecutiveDays: maxConsecutiveDays || 0,
      requiresApproval: requiresApproval !== undefined ? requiresApproval : true,
      isActive: true
    });

    await leaveType.save();
    res.status(201).json({ leaveType, message: "Leave type created successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to create leave type.", error: error.message });
  }
};

export const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = await requireActiveOrganizationId(req);

    const leaveType = await LeaveType.findOne({ _id: id, organizationId });
    if (!leaveType) {
      return res.status(404).json({ message: "Leave type not found." });
    }

    // Check if there are any balances or requests tied to it
    const balancesCount = await LeaveBalance.countDocuments({ leaveTypeId: id, organizationId });
    const requestsCount = await LeaveRequest.countDocuments({ leaveTypeId: id, organizationId });

    if (balancesCount > 0 || requestsCount > 0) {
      // Soft delete if there are dependencies
      leaveType.isActive = false;
      await leaveType.save();
      return res.status(200).json({ message: "Leave type deactivated as it is currently in use." });
    }

    await LeaveType.deleteOne({ _id: id, organizationId });
    res.status(200).json({ message: "Leave type deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete leave type.", error: error.message });
  }
};
