import Attendance from "../models/Attendance.js";
import AttendanceCorrectionRequest from "../models/AttendanceCorrectionRequest.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";
import User from "../models/User.js";
import ExcelJS from "exceljs";
import NotificationService from "../services/notificationService.js";

const OFFICE_LAT = 22.736024;
const OFFICE_LNG = 75.902866;
const ALLOWED_RADIUS_METERS = 150;

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d * 1000;
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

export const clockIn = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Location coordinates are required to clock in." });
    }

    const distance = getDistanceFromLatLonInM(OFFICE_LAT, OFFICE_LNG, latitude, longitude);

    if (distance > ALLOWED_RADIUS_METERS) {
      return res.status(400).json({
        message: `You are too far from the office. You are ${Math.round(distance)} meters away (allowed: ${ALLOWED_RADIUS_METERS}m).`,
      });
    }

    const today = getTodayDateString();
    const now = new Date();

    // Fix for: if user forgets to clock out yesterday, auto clock them out at 7:00 PM of that day
    const pendingAttendances = await Attendance.find({
      userId: req.user._id,
      attendanceDate: { $ne: today },
      clockIn: { $exists: true, $ne: null },
      clockOut: null,
    });

    for (const pending of pendingAttendances) {
      const autoOut = new Date(pending.clockIn);
      autoOut.setHours(19, 0, 0, 0); // 7:00 PM local time of the clock-in date
      
      // If the clock in was somehow AFTER 7:00 PM, just add 0 hours
      if (autoOut <= pending.clockIn) {
        pending.clockOut = pending.clockIn;
        pending.totalHours = 0;
      } else {
        pending.clockOut = autoOut;
        const diffMs = autoOut.getTime() - pending.clockIn.getTime();
        pending.totalHours = diffMs / (1000 * 60 * 60);
      }
      await pending.save();
    }

    const existingAttendance = await Attendance.findOne({
      userId: req.user._id,
      attendanceDate: today,
    });

    if (existingAttendance && existingAttendance.clockIn) {
      return res.status(400).json({ message: "You have already clocked in today." });
    }

    const isLate = now.getHours() >= 12;

    if (existingAttendance) {
      existingAttendance.clockIn = now;
      existingAttendance.location = { latitude, longitude };
      existingAttendance.distanceFromOffice = distance;
      existingAttendance.status = isLate ? "Absent" : "Present";
      await existingAttendance.save();

      if (isLate) {
        await AttendanceCorrectionRequest.create({
          userId: req.user._id,
          organizationId,
          attendanceId: existingAttendance._id,
          requestedClockIn: now,
          reason: "Late clock-in attempt after 12:00 PM",
        });

        return res.status(201).json({
          message: "Clocked in late. You are marked Absent. A correction request has been sent to the admin.",
          attendance: existingAttendance
        });
      }

      return res.status(201).json({ message: "Clocked in successfully.", attendance: existingAttendance });
    }

    const attendance = await Attendance.create({
      userId: req.user._id,
      organizationId,
      attendanceDate: today,
      clockIn: now,
      location: { latitude, longitude },
      distanceFromOffice: distance,
      status: isLate ? "Absent" : "Present",
    });

    if (isLate) {
      await AttendanceCorrectionRequest.create({
        userId: req.user._id,
        organizationId,
        attendanceId: attendance._id,
        requestedClockIn: now,
        reason: "Late clock-in attempt after 12:00 PM",
      });

      return res.status(201).json({
        message: "Clocked in late. You are marked Absent. A correction request has been sent to the admin.",
        attendance
      });
    }

    res.status(201).json({ message: "Clocked in successfully.", attendance });
  } catch (error) {
    console.error("Clock In Error:", error);
    res.status(500).json({ message: "Server error during clock in." });
  }
};

export const clockOut = async (req, res) => {
  try {
    const today = getTodayDateString();

    const attendance = await Attendance.findOne({
      userId: req.user._id,
      attendanceDate: today,
    });

    if (!attendance) {
      return res.status(400).json({ message: "You have not clocked in today." });
    }

    if (!attendance.clockIn) {
      return res.status(400).json({ message: "You have no valid clock-in time to clock out from." });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ message: "You have already clocked out today." });
    }

    const clockOutTime = new Date();
    attendance.clockOut = clockOutTime;
    
    // Calculate total hours
    const diffMs = clockOutTime.getTime() - new Date(attendance.clockIn).getTime();
    attendance.totalHours = diffMs / (1000 * 60 * 60);

    await attendance.save();

    res.json({ message: "Clocked out successfully.", attendance });
  } catch (error) {
    console.error("Clock Out Error:", error);
    res.status(500).json({ message: "Server error during clock out." });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const today = getTodayDateString();

    // Auto-close any pending records from previous days
    const pendingAttendances = await Attendance.find({
      userId: req.user._id,
      attendanceDate: { $ne: today },
      clockIn: { $exists: true, $ne: null },
      clockOut: null,
    });

    for (const pending of pendingAttendances) {
      const autoOut = new Date(pending.clockIn);
      autoOut.setHours(19, 0, 0, 0); // 7:00 PM local time of the clock-in date
      
      if (autoOut <= pending.clockIn) {
        pending.clockOut = pending.clockIn;
        pending.totalHours = 0;
      } else {
        pending.clockOut = autoOut;
        const diffMs = autoOut.getTime() - pending.clockIn.getTime();
        pending.totalHours = diffMs / (1000 * 60 * 60);
      }
      await pending.save();
    }

    const attendance = await Attendance.find({ userId: req.user._id })
      .sort({ attendanceDate: -1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance records." });
  }
};

export const getAllAttendance = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { date, user } = req.query;

    const query = { organizationId };
    if (date) query.attendanceDate = date;
    if (user) query.userId = user;

    const attendance = await Attendance.find(query)
      .populate("userId", "name email")
      .populate("correctedBy", "name")
      .sort({ attendanceDate: -1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch all attendance records." });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { clockIn, clockOut, status, correctionReason } = req.body;

    if (!correctionReason) {
      return res.status(400).json({ message: "Correction reason is required for manual edits." });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found." });
    }

    let finalClockIn = clockIn ? new Date(clockIn) : attendance.clockIn;
    let finalClockOut = clockOut ? new Date(clockOut) : attendance.clockOut;

    if (finalClockIn && finalClockOut && finalClockOut.getTime() <= finalClockIn.getTime()) {
      return res.status(400).json({ message: "Clock out time must be after clock in time." });
    }

    if (clockIn) attendance.clockIn = finalClockIn;
    if (clockOut) attendance.clockOut = finalClockOut;
    
    if (attendance.clockIn && attendance.clockOut) {
      const diffMs = attendance.clockOut.getTime() - attendance.clockIn.getTime();
      attendance.totalHours = diffMs / (1000 * 60 * 60);
    }
    
    if (status) attendance.status = status;

    attendance.corrected = true;
    attendance.correctedBy = req.user._id;
    attendance.correctionReason = correctionReason;

    await attendance.save();

    res.json({ message: "Attendance updated.", attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to update attendance." });
  }
};

export const requestCorrection = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { attendanceId, requestedClockIn, requestedClockOut, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required." });
    }

    let finalClockIn = requestedClockIn ? new Date(requestedClockIn) : null;
    let finalClockOut = requestedClockOut ? new Date(requestedClockOut) : null;

    if (attendanceId) {
      const attendance = await Attendance.findById(attendanceId);
      if (attendance) {
        if (!finalClockIn && attendance.clockIn) finalClockIn = new Date(attendance.clockIn);
        if (!finalClockOut && attendance.clockOut) finalClockOut = new Date(attendance.clockOut);
      }
    }

    if (finalClockIn && finalClockOut && finalClockOut.getTime() <= finalClockIn.getTime()) {
      return res.status(400).json({ message: "Clock out time must be after clock in time." });
    }

    const request = await AttendanceCorrectionRequest.create({
      userId: req.user._id,
      organizationId,
      attendanceId,
      requestedClockIn,
      requestedClockOut,
      reason,
    });

    res.status(201).json({ message: "Correction request submitted.", request });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit correction request." });
  }
};

export const getCorrectionRequests = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    
    const requests = await AttendanceCorrectionRequest.find({ organizationId })
      .populate("userId", "name email")
      .populate("attendanceId")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch correction requests." });
  }
};

export const updateCorrectionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Approved or Rejected

    const request = await AttendanceCorrectionRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    request.status = status;
    await request.save();

    if (status === "Approved" || status === "Half Day") {
      let attendance;
      if (request.attendanceId) {
        attendance = await Attendance.findById(request.attendanceId);
      } else {
        // Missing attendance creation
        const dateString = request.requestedClockIn 
          ? new Date(request.requestedClockIn).toISOString().split('T')[0]
          : getTodayDateString();
          
        attendance = await Attendance.findOne({
          userId: request.userId,
          attendanceDate: dateString,
        });

        if (!attendance) {
          attendance = new Attendance({
            userId: request.userId,
            organizationId: request.organizationId,
            attendanceDate: dateString,
          });
        }
      }

      if (attendance) {
        if (request.requestedClockIn) attendance.clockIn = request.requestedClockIn;
        if (request.requestedClockOut) attendance.clockOut = request.requestedClockOut;
        
        if (attendance.clockIn && attendance.clockOut) {
          const diffMs = new Date(attendance.clockOut).getTime() - new Date(attendance.clockIn).getTime();
          attendance.totalHours = diffMs / (1000 * 60 * 60);
        }

        attendance.corrected = true;
        attendance.correctedBy = req.user._id;
        attendance.correctionReason = `Correction request ${status.toLowerCase()}: ${request.reason}`;
        
        if (status === "Half Day") {
          attendance.status = "Half Day";
        }

        await attendance.save();
      }
    }

    if (status === "Approved" || status === "Half Day" || status === "Rejected") {
      const type = status === "Rejected" ? "attendance_correction_rejected" : "attendance_correction_approved";
      await NotificationService.createNotification({
        userId: request.userId,
        organizationId: request.organizationId,
        title: `Attendance Correction ${status}`,
        message: status === "Rejected" ? "Attendance correction request rejected." : "Attendance correction approved.",
        type
      });
    }

    res.json({ message: `Request ${status}.`, request });
  } catch (error) {
    res.status(500).json({ message: "Failed to update request." });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const today = getTodayDateString();

    const allAttendanceToday = await Attendance.find({
      organizationId,
      attendanceDate: today,
    });

    // We can fetch all users in org to calculate absent
    const usersInOrg = await User.find({
      $or: [{ organizationId }, { allowedOrganizations: organizationId }],
      isActive: true,
      role: { $ne: "client" }
    });

    const presentUserIds = allAttendanceToday.map(a => a.userId.toString());
    const absentCount = usersInOrg.filter(u => !presentUserIds.includes(u._id.toString())).length;

    const currentlyClockedInUserIds = allAttendanceToday.filter(a => !a.clockOut).map(a => a.userId.toString());
    const currentlyClockedIn = new Set(currentlyClockedInUserIds).size;
    
    const totalHoursToday = allAttendanceToday.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

    const pendingRequests = await AttendanceCorrectionRequest.countDocuments({
      organizationId,
      status: "Pending",
    });

    res.json({
      presentToday: new Set(presentUserIds).size,
      absentToday: absentCount,
      currentlyClockedIn,
      totalHoursToday,
      pendingRequests
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load analytics." });
  }
};

export const exportAttendance = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { month, year, employeeId } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required." });
    }

    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    // Build query for date range
    const startStr = `${yearNum}-${monthNum.toString().padStart(2, "0")}-01`;
    const endStr = `${yearNum}-${monthNum.toString().padStart(2, "0")}-31`; // Using 31 works for string comparison

    const query = {
      organizationId,
      attendanceDate: { $gte: startStr, $lte: endStr },
    };

    if (employeeId) {
      query.userId = employeeId;
    }

    // Fetch data
    const attendanceRecords = await Attendance.find(query)
      .populate("userId", "name email role")
      .sort({ attendanceDate: 1 });

    const requestsQuery = {
      organizationId,
      createdAt: {
        $gte: new Date(yearNum, monthNum - 1, 1),
        $lte: new Date(yearNum, monthNum, 0, 23, 59, 59),
      },
    };

    if (employeeId) {
      requestsQuery.userId = employeeId;
    }

    const correctionRequests = await AttendanceCorrectionRequest.find(requestsQuery)
      .populate("userId", "name email")
      .sort({ createdAt: 1 });

    // Fetch users for monthly summary
    const usersQuery = employeeId 
      ? { _id: employeeId } 
      : { 
          $or: [{ organizationId }, { allowedOrganizations: organizationId }],
          isActive: true,
          role: { $ne: "client" }
        };
    
    const users = await User.find(usersQuery);

    // Initialize workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TaskPilot";
    workbook.created = new Date();

    // Sheet 1: Daily Attendance Records
    const dailySheet = workbook.addWorksheet("Daily Attendance");
    dailySheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Employee Email", key: "email", width: 30 },
      { header: "Role", key: "role", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Clock In", key: "clockIn", width: 20 },
      { header: "Clock Out", key: "clockOut", width: 20 },
      { header: "Total Hours", key: "hours", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Distance (m)", key: "distance", width: 15 },
      { header: "Corrected", key: "corrected", width: 10 },
      { header: "Correction Reason", key: "correctionReason", width: 30 },
    ];

    dailySheet.getRow(1).font = { bold: true };

    attendanceRecords.forEach((record) => {
      dailySheet.addRow({
        name: record.userId?.name || "Unknown",
        email: record.userId?.email || "Unknown",
        role: record.userId?.role || "Unknown",
        date: record.attendanceDate,
        clockIn: record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : "-",
        clockOut: record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : "-",
        hours: record.totalHours ? record.totalHours.toFixed(2) : "-",
        status: record.status,
        distance: record.distanceFromOffice ? Math.round(record.distanceFromOffice) : "-",
        corrected: record.corrected ? "Yes" : "No",
        correctionReason: record.correctionReason || "-",
      });
    });

    // Sheet 2: Monthly Summary
    const summarySheet = workbook.addWorksheet("Monthly Summary");
    summarySheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Total Working Days", key: "workingDays", width: 20 },
      { header: "Days Present", key: "present", width: 15 },
      { header: "Days Absent", key: "absent", width: 15 },
      { header: "Total Hours", key: "totalHours", width: 15 },
      { header: "Avg Hours/Day", key: "avgHours", width: 15 },
      { header: "Late Arrivals", key: "late", width: 15 },
      { header: "Attendance %", key: "percentage", width: 15 },
    ];

    summarySheet.getRow(1).font = { bold: true };

    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    users.forEach((user) => {
      const userRecords = attendanceRecords.filter(
        (r) => r.userId?._id.toString() === user._id.toString()
      );

      const daysPresent = userRecords.filter((r) => r.status === "Present" || r.status === "Half Day" || r.status === "Late").length;
      const daysAbsent = daysInMonth - daysPresent;
      const totalHours = userRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0);
      const avgHours = daysPresent > 0 ? (totalHours / daysPresent).toFixed(2) : 0;
      const lateArrivals = userRecords.filter((r) => r.status === "Late").length; // assuming late logic if present
      const percentage = ((daysPresent / daysInMonth) * 100).toFixed(2);

      summarySheet.addRow({
        name: user.name,
        workingDays: daysInMonth,
        present: daysPresent,
        absent: daysAbsent,
        totalHours: totalHours.toFixed(2),
        avgHours,
        late: lateArrivals,
        percentage: `${percentage}%`,
      });
    });

    // Sheet 3: Correction Requests Log
    const requestsSheet = workbook.addWorksheet("Correction Requests");
    requestsSheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Reason", key: "reason", width: 40 },
      { header: "Req. Clock In", key: "reqIn", width: 20 },
      { header: "Req. Clock Out", key: "reqOut", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Date Requested", key: "date", width: 20 },
    ];

    requestsSheet.getRow(1).font = { bold: true };

    correctionRequests.forEach((reqLog) => {
      requestsSheet.addRow({
        name: reqLog.userId?.name || "Unknown",
        reason: reqLog.reason,
        reqIn: reqLog.requestedClockIn ? new Date(reqLog.requestedClockIn).toLocaleString() : "-",
        reqOut: reqLog.requestedClockOut ? new Date(reqLog.requestedClockOut).toLocaleString() : "-",
        status: reqLog.status,
        date: new Date(reqLog.createdAt).toLocaleDateString(),
      });
    });

    // Write to buffer and send
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Attendance_${month}_${year}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export attendance." });
  }
};
