import Attendance from "../models/Attendance.js";
import AttendanceCorrectionRequest from "../models/AttendanceCorrectionRequest.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";
import User from "../models/User.js";
import ExcelJS from "exceljs";
import NotificationService from "../services/notificationService.js";
import { getIO } from "../services/socketHandler.js";
import { getISTDateString } from "../utils/dateUtils.js";

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

const getTodayDateString = () => getISTDateString();

// Shared helper to auto-close pending attendance records from previous days (UTC safe)
const autoClosePendingAttendances = async (query = {}) => {
  try {
    const today = getTodayDateString();
    const pendingAttendances = await Attendance.find({
      ...query,
      attendanceDate: { $ne: today },
      clockIn: { $exists: true, $ne: null },
      clockOut: null,
    });

    for (const pending of pendingAttendances) {
      const autoOut = new Date(pending.clockIn);
      // Correctly represent 7:00 PM IST (13:30 UTC) on production cloud servers
      autoOut.setUTCHours(13, 30, 0, 0);

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
  } catch (err) {
    console.error("Error auto-closing pending attendances:", err);
  }
};

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

    // Auto-close any pending records from previous days
    await autoClosePendingAttendances({ userId: req.user._id });

    const existingAttendance = await Attendance.findOne({
      userId: req.user._id,
      attendanceDate: today,
    });

    if (existingAttendance && existingAttendance.clockIn) {
      return res.status(400).json({ message: "You have already clocked in today." });
    }

    // Convert current time to IST to get the accurate local hour regardless of server timezone (UTC on Hostinger)
    const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' };
    const istHour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now), 10);
    const isLate = istHour >= 12;

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

        const finalRecord = await Attendance.findById(existingAttendance._id).populate("userId", "name email");
        getIO().to(`org:${organizationId}`).emit("attendance_updated", finalRecord);

        return res.status(201).json({
          message: "Clocked in late. You are marked Absent. A correction request has been sent to the admin.",
          attendance: finalRecord
        });
      }

      const finalRecord = await Attendance.findById(existingAttendance._id).populate("userId", "name email");
      getIO().to(`org:${organizationId}`).emit("attendance_updated", finalRecord);

      return res.status(201).json({ message: "Clocked in successfully.", attendance: finalRecord });
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

      const finalAttendance = await Attendance.findById(attendance._id).populate("userId", "name email");
      getIO().to(`org:${organizationId}`).emit("attendance_updated", finalAttendance);

      return res.status(201).json({
        message: "Clocked in late. You are marked Absent. A correction request has been sent to the admin.",
        attendance: finalAttendance
      });
    }

    const finalAttendance = await Attendance.findById(attendance._id).populate("userId", "name email");
    getIO().to(`org:${organizationId}`).emit("attendance_updated", finalAttendance);

    res.status(201).json({ message: "Clocked in successfully.", attendance: finalAttendance });
  } catch (error) {
    console.error("Clock In Error:", error);
    res.status(500).json({ message: "Server error during clock in." });
  }
};

export const clockOut = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      userId: req.user._id,
      clockIn: { $ne: null },
      clockOut: null,
    }).sort({ attendanceDate: -1 });

    if (!attendance) {
      return res.status(400).json({ message: "You have not clocked in or already clocked out." });
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

    const organizationId = await requireActiveOrganizationId(req);
    const finalAttendance = await Attendance.findById(attendance._id).populate("userId", "name email");
    getIO().to(`org:${organizationId}`).emit("attendance_updated", finalAttendance);

    res.json({ message: "Clocked out successfully.", attendance: finalAttendance });
  } catch (error) {
    console.error("Clock Out Error:", error);
    res.status(500).json({ message: "Server error during clock out." });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const today = getTodayDateString();

    // Auto-close any pending records from previous days
    await autoClosePendingAttendances({ userId: req.user._id });

    const { month, year } = req.query;
    const query = { userId: req.user._id };
    if (month && year) {
      const regex = new RegExp(`^${year}-${month.padStart(2, '0')}-`);
      query.attendanceDate = { $regex: regex };
    }

    const attendance = await Attendance.find(query)
      .sort({ attendanceDate: -1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance records." });
  }
};

export const getAllAttendance = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    await autoClosePendingAttendances({ organizationId });
    const { date, user, month, year } = req.query;

    const query = { organizationId };
    if (date) query.attendanceDate = date;
    if (user) query.userId = user;
    if (month && year) {
      const regex = new RegExp(`^${year}-${month.padStart(2, '0')}-`);
      query.attendanceDate = { $regex: regex };
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: "userId",
        select: "name email gender role",
        match: { role: { $ne: "superadmin" } }
      })
      .populate("correctedBy", "name role")
      .sort({ attendanceDate: -1 });

    const filteredAttendance = attendance.filter(a => a.userId !== null);

    const sanitizedAttendance = filteredAttendance.map(a => {
      const doc = a.toObject();
      if (doc.correctedBy && doc.correctedBy.role === "developer") {
        doc.correctedBy = null;
      }
      return doc;
    });

    res.json({ attendance: sanitizedAttendance });
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
      isManual: true,
    });

    res.status(201).json({ message: "Correction request submitted.", request });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit correction request." });
  }
};

export const getCorrectionRequests = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const [data, totalRecords] = await Promise.all([
      AttendanceCorrectionRequest.find({ organizationId })
        .populate("userId", "name email")
        .populate("attendanceId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AttendanceCorrectionRequest.countDocuments({ organizationId })
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
          ? getISTDateString(request.requestedClockIn)
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
        let canModify = true;
        
        // Safety check: Don't let automatic requests overwrite manual corrections
        if (!request.isManual) {
          const hasManual = await AttendanceCorrectionRequest.exists({
            attendanceId: attendance._id,
            isManual: true,
            status: { $in: ["Approved", "Half Day"] }
          });
          
          const wasDirectlyEdited = attendance.corrected && attendance.correctionReason && !attendance.correctionReason.startsWith("Correction request");
          
          if (hasManual || wasDirectlyEdited) {
            canModify = false;
          }
        }

        if (canModify) {
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
          } else if (status === "Approved") {
            attendance.status = "Present";
          }

          await attendance.save();

          const finalAttendance = await Attendance.findById(attendance._id).populate("userId", "name email");
          getIO().to(`org:${request.organizationId}`).emit("attendance_updated", finalAttendance);
        }
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
    await autoClosePendingAttendances({ organizationId });
    const today = getTodayDateString();

    const allAttendanceToday = await Attendance.find({
      organizationId,
      attendanceDate: today,
    }).populate({
      path: "userId",
      select: "role",
      match: { role: { $ne: "superadmin" } }
    });

    const filteredAttendanceToday = allAttendanceToday.filter(a => a.userId !== null);

    // We can fetch all users in org to calculate absent
    const usersInOrg = await User.find({
      $or: [{ organizationId }, { allowedOrganizations: organizationId }],
      isActive: true,
      role: { $nin: ["client", "superadmin"] }
    });

    const presentUserIds = filteredAttendanceToday.map(a => a.userId._id.toString());
    const absentCount = usersInOrg.filter(u => !presentUserIds.includes(u._id.toString())).length;

    const currentlyClockedInUserIds = filteredAttendanceToday.filter(a => a.clockIn && !a.clockOut).map(a => a.userId._id.toString());
    const currentlyClockedIn = new Set(currentlyClockedInUserIds).size;

    const totalHoursToday = filteredAttendanceToday.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

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
    await autoClosePendingAttendances({ organizationId });
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
    const attendanceRaw = await Attendance.find(query)
      .populate({
        path: "userId",
        select: "name email role gender",
        match: { role: { $ne: "superadmin" } }
      })
      .sort({ attendanceDate: 1 });
    
    const attendanceRecords = attendanceRaw.filter(a => a.userId !== null);

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

    const correctionRequestsRaw = await AttendanceCorrectionRequest.find(requestsQuery)
      .populate({
        path: "userId",
        select: "name email role",
        match: { role: { $ne: "superadmin" } }
      })
      .sort({ createdAt: 1 });
      
    const correctionRequests = correctionRequestsRaw.filter(r => r.userId !== null);

    // Fetch users for monthly summary
    const usersQuery = employeeId
      ? { _id: employeeId }
      : {
        $or: [{ organizationId }, { allowedOrganizations: organizationId }],
        isActive: true,
        role: { $nin: ["client", "superadmin"] }
      };

    const users = await User.find(usersQuery).select("name gender");

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
      { header: "Gender", key: "gender", width: 15 },
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
      let status = record.status;
      if (status === "Absent") {
        const [y, m, d] = record.attendanceDate.split('-').map(Number);
        if (new Date(y, m - 1, d).getDay() === 0) status = "Weekly Off";
      }
      dailySheet.addRow({
        name: record.userId?.name || "Unknown",
        email: record.userId?.email || "Unknown",
        role: record.userId?.role || "Unknown",
        gender: record.userId?.gender === "not_specified" ? "-" : (record.userId?.gender || "-"),
        date: record.attendanceDate,
        clockIn: record.clockIn ? new Date(record.clockIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : "-",
        clockOut: record.clockOut ? new Date(record.clockOut).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : "-",
        hours: record.totalHours ? record.totalHours.toFixed(2) : "-",
        status,
        distance: record.distanceFromOffice ? Math.round(record.distanceFromOffice) : "-",
        corrected: record.corrected ? "Yes" : "No",
        correctionReason: record.correctionReason || "-",
      });
    });

    // Sheet 2: Monthly Summary
    const summarySheet = workbook.addWorksheet("Monthly Summary");
    summarySheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Gender", key: "gender", width: 15 },
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
    const todayStr = getTodayDateString();
    const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);

    let lastEvaluatedDay = 0;
    if (yearNum === todayYear && monthNum === todayMonth) {
      lastEvaluatedDay = todayDay;
    } else if (yearNum < todayYear || (yearNum === todayYear && monthNum < todayMonth)) {
      lastEvaluatedDay = daysInMonth;
    } else {
      lastEvaluatedDay = 0;
    }

    users.forEach((user) => {
      const userRecords = attendanceRecords.filter(
        (r) => r.userId?._id.toString() === user._id.toString()
      );

      let present = 0;
      let halfDay = 0;
      let absent = 0;
      let leave = 0;
      let lateArrivals = 0;
      let totalHours = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const isSunday = new Date(yearNum, monthNum - 1, day).getDay() === 0;
        const isPastOrToday = day <= lastEvaluatedDay;

        const dbRecord = userRecords.find((r) => r.attendanceDate === dateStr);
        let status = "Not Evaluated";
        let hours = 0;

        if (dbRecord) {
          status = dbRecord.status;
          hours = dbRecord.totalHours || 0;
          if (status === "Absent" && isSunday) {
            status = "Weekly Off";
          }
        } else {
          if (isPastOrToday) {
            if (isSunday) {
              status = "Weekly Off";
            } else {
              const isPastDate = yearNum < todayYear || 
                (yearNum === todayYear && monthNum < todayMonth) || 
                (yearNum === todayYear && monthNum === todayMonth && day < todayDay);

              if (isPastDate) {
                status = "Absent";
              } else {
                status = "Pending";
              }
            }
          }
        }

        if (status === "Present" || status === "Late") {
          present++;
          if (status === "Late") lateArrivals++;
        } else if (status === "Absent") {
          absent++;
        } else if (status === "Half Day") {
          halfDay++;
        } else if (status === "Leave" || status === "On Leave" || status === "Weekly Off") {
          leave++;
        }

        totalHours += hours;
      }

      const effectiveWorkingDays = present + absent + halfDay;
      const score = present + (halfDay * 0.5);
      const percentage = effectiveWorkingDays > 0 ? ((score / effectiveWorkingDays) * 100).toFixed(2) : 0;
      const daysPresentStr = halfDay > 0 ? `${present} (+${halfDay} Half)` : `${present}`;
      
      const avgHours = (present + halfDay) > 0 ? (totalHours / (present + halfDay)).toFixed(2) : 0;

      summarySheet.addRow({
        name: user.name,
        gender: user.gender === "not_specified" ? "-" : (user.gender || "-"),
        workingDays: effectiveWorkingDays,
        present: daysPresentStr,
        absent,
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
        reqIn: reqLog.requestedClockIn ? new Date(reqLog.requestedClockIn).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : "-",
        reqOut: reqLog.requestedClockOut ? new Date(reqLog.requestedClockOut).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : "-",
        status: reqLog.status,
        date: new Date(reqLog.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
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

export const submitProposedClockOut = async (req, res) => {
  try {
    const { proposedTime, attendanceId } = req.body;
    
    if (!proposedTime || !attendanceId) {
      return res.status(400).json({ message: "Proposed time and attendance ID are required." });
    }

    const attendance = await Attendance.findOne({ _id: attendanceId, userId: req.user._id });
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found." });
    }

    if (attendance.freezeStatus !== "frozen") {
      return res.status(400).json({ message: "This record is not currently awaiting a proposed time." });
    }

    if (new Date(proposedTime) <= new Date(attendance.clockIn)) {
      return res.status(400).json({ message: "Proposed clock out time must be strictly after clock in time." });
    }

    attendance.proposedClockOut = new Date(proposedTime);
    attendance.freezeStatus = "submitted_time";
    await attendance.save();

    res.json({ message: "Proposed time submitted. Waiting for admin approval.", attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit proposed clock out time.", error: error.message });
  }
};

export const getFrozenAccounts = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const frozenRecords = await Attendance.find({
      organizationId,
      freezeStatus: { $in: ["frozen", "submitted_time"] }
    })
      .populate("userId", "name email avatar")
      .sort({ attendanceDate: -1 });

    res.json({ frozenRecords });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch frozen accounts.", error: error.message });
  }
};

export const resolveFrozenAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "unfreeze" or "unfreeze_half_day"
    
    const attendance = await Attendance.findById(id).populate("userId");
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found." });
    }

    if (!["frozen", "submitted_time"].includes(attendance.freezeStatus)) {
      return res.status(400).json({ message: "This account is not currently frozen." });
    }

    if (action === "unfreeze") {
      if (!attendance.proposedClockOut) {
        return res.status(400).json({ message: "Cannot unfreeze normally without a proposed clock out time. The user must submit it first." });
      }
      if (new Date(attendance.proposedClockOut) <= new Date(attendance.clockIn)) {
        return res.status(400).json({ message: "Cannot unfreeze: proposed clock out time is before or equal to clock in time." });
      }
      attendance.clockOut = attendance.proposedClockOut;
      const diffMs = attendance.clockOut.getTime() - attendance.clockIn.getTime();
      attendance.totalHours = diffMs / (1000 * 60 * 60);
      attendance.status = "Present"; 
      
      attendance.corrected = true;
      attendance.correctedBy = req.user._id;
      attendance.correctionReason = "Resolved missing clock out";
    } else if (action === "unfreeze_half_day") {
      // Keep it as Half Day (set by cron), discard proposed time if any
      attendance.corrected = true;
      attendance.correctedBy = req.user._id;
      attendance.correctionReason = "Enforced half-day for missing clock out";
    } else {
      return res.status(400).json({ message: "Invalid action." });
    }

    attendance.freezeStatus = "resolved";
    await attendance.save();

    // Check if the user has any other currently frozen attendance records
    const otherFrozen = await Attendance.findOne({
      userId: attendance.userId._id,
      freezeStatus: { $in: ["frozen", "submitted_time"] }
    });

    if (!otherFrozen) {
      // Unfreeze the user account
      attendance.userId.isAccountFrozen = false;
      await attendance.userId.save();
    }

    res.json({ message: `Account resolved successfully via ${action}.`, attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve frozen account.", error: error.message });
  }
};
