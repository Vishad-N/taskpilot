import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import NotificationService from "../services/notificationService.js";
import LeaveType from "../models/LeaveType.js";
import LeaveBalance from "../models/LeaveBalance.js";

const getTodayDateString = () => new Date().toISOString().split("T")[0];

export const initCronJobs = () => {
  // Run every day at 12:00 PM for Attendance Check
  cron.schedule("0 12 * * *", async () => {
    console.log("[Cron] Running 12:00 PM Attendance check...");
    try {
      const today = getTodayDateString();
      const now = new Date();
      const isSunday = now.getDay() === 0;

      const users = await User.find({
        isActive: true,
        role: { $ne: "client" },
      });

      for (const user of users) {
        const existingRecord = await Attendance.findOne({
          userId: user._id,
          attendanceDate: today,
        });

        if (!existingRecord) {
          const statusToApply = isSunday ? "Weekly Off" : "Absent";
          const newRecord = await Attendance.create({
            userId: user._id,
            organizationId: user.organizationId,
            attendanceDate: today,
            status: statusToApply,
          });

          // Fetch the final record with populated user to emit
          const finalRecord = await Attendance.findById(newRecord._id).populate("userId", "name email");
          
          try {
            const { getIO } = await import("../services/socketHandler.js");
            getIO().to(`org:${user.organizationId}`).emit("attendance_updated", finalRecord);
          } catch (err) {
            console.error("Socket emit failed in cron:", err);
          }
        }
      }
      console.log(`[Cron] Completed Attendance check.`);
    } catch (error) {
      console.error("[Cron] Error during 12:00 PM Attendance check:", error);
    }
  });

  // Daily at 9:00 PM check for users who forgot to clock out
  cron.schedule("0 21 * * *", async () => {
    console.log("[Cron] Checking for missing clock-outs at 9:00 PM...");
    try {
      const today = getTodayDateString();
      const records = await Attendance.find({
        attendanceDate: today,
        clockIn: { $ne: null },
        clockOut: null,
        status: { $ne: "On Leave" } // Ignore leaves just in case
      }).populate("userId", "role");

      for (const record of records) {
        // Skip superadmins
        if (record.userId && record.userId.role === "superadmin") {
          continue;
        }

        // Mark as half day and freeze
        record.status = "Half Day";
        record.freezeStatus = "frozen";
        await record.save();

        // Freeze user account
        await User.findByIdAndUpdate(record.userId, { isAccountFrozen: true });

        // Notify admins
        const admins = await User.find({ 
          organizationId: record.organizationId, 
          role: { $in: ["admin", "superadmin"] },
          isActive: true 
        });

        for (const admin of admins) {
          await NotificationService.createNotification({
            userId: admin._id,
            organizationId: record.organizationId,
            title: "No Clock Out Detected",
            message: "A user forgot to clock out. Their account has been frozen.",
            type: "no_clock_out"
          });
        }
      }
    } catch (error) {
      console.error("[Cron] Error checking for missing clock-outs:", error);
    }
  });

  // Daily at 9:00 AM check for due and overdue tasks
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Checking for due and overdue tasks...");
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = await Task.find({
        status: { $ne: "completed" },
        deadlineDate: { $ne: null }
      });

      for (const task of tasks) {
        const notifyIds = [
          ...(task.assignedTo ? [String(task.assignedTo)] : []),
          ...(task.assignedToUsers || []).map(String)
        ];
        const uniqueNotifyIds = [...new Set(notifyIds)].filter(Boolean);

        if (uniqueNotifyIds.length > 0) {
          if (task.deadlineDate < now) {
            // Overdue
            for (const userId of uniqueNotifyIds) {
              await NotificationService.createNotification({
                userId,
                organizationId: task.organizationId,
                title: "Task Overdue",
                message: `Task "${task.title}" is overdue.`,
                type: "task_overdue",
                taskId: task._id
              });
            }
          } else if (task.deadlineDate <= tomorrow) {
            // Due within 24 hours
            for (const userId of uniqueNotifyIds) {
              await NotificationService.createNotification({
                userId,
                organizationId: task.organizationId,
                title: "Task Due Soon",
                message: `Task "${task.title}" is due within 24 hours.`,
                type: "task_due",
                taskId: task._id
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("[Cron] Error checking due tasks:", error);
    }
  });

  // 10:25 AM check for users who haven't clocked in
  cron.schedule("25 10 * * *", async () => {
    console.log("[Cron] Running 10:25 AM clock-in reminder...");
    try {
      const today = getTodayDateString();
      const now = new Date();
      if (now.getDay() === 0) return; // Skip Sunday
      
      const users = await User.find({ isActive: true, role: { $ne: "client" } });
      for (const user of users) {
        const record = await Attendance.findOne({ userId: user._id, attendanceDate: today });
        if (!record || !record.clockIn) {
          await NotificationService.createNotification({
            userId: user._id,
            organizationId: user.organizationId,
            title: "Clock-in Reminder",
            message: "Clock in time is 10:30 AM",
            type: "system"
          });
        }
      }
    } catch (error) {
      console.error("[Cron] Error in 10:25 AM clock-in reminder:", error);
    }
  });

  // 6:55 PM check for users who haven't clocked out
  cron.schedule("55 18 * * *", async () => {
    console.log("[Cron] Running 6:55 PM clock-out reminder...");
    try {
      const today = getTodayDateString();
      const users = await User.find({ isActive: true, role: { $ne: "client" } });
      for (const user of users) {
        const record = await Attendance.findOne({ userId: user._id, attendanceDate: today });
        if (record && record.clockIn && !record.clockOut) {
          await NotificationService.createNotification({
            userId: user._id,
            organizationId: user.organizationId,
            title: "Clock-out Reminder",
            message: "Clock out time is 7:00 PM",
            type: "system"
          });
        }
      }
    } catch (error) {
      console.error("[Cron] Error in 6:55 PM clock-out reminder:", error);
    }
  });
  // Every 30 minutes check for incomplete tasks for clocked-in team members
  cron.schedule("*/30 * * * *", async () => {
    console.log("[Cron] Running 30-minute incomplete task reminder...");
    try {
      const today = getTodayDateString();
      const teamMembers = await User.find({ isActive: true, role: "team" });
      
      for (const user of teamMembers) {
        // Check if user is currently clocked in
        const record = await Attendance.findOne({ userId: user._id, attendanceDate: today });
        if (record && record.clockIn && !record.clockOut) {
          // User is clocked in. Find their incomplete tasks.
          const incompleteTasks = await Task.find({
            status: { $ne: "completed" },
            organizationId: user.organizationId,
            $or: [
              { assignedTo: user._id },
              { assignedToUsers: user._id }
            ]
          }).select("title");

          if (incompleteTasks.length > 0) {
            let message = "";
            if (incompleteTasks.length === 1) {
              message = `Your task "${incompleteTasks[0].title}" is incomplete.`;
            } else {
              message = `You have ${incompleteTasks.length} incomplete tasks pending, including "${incompleteTasks[0].title}".`;
            }

            await NotificationService.createNotification({
              userId: user._id,
              organizationId: user.organizationId,
              title: "Incomplete Tasks Reminder",
              message: message,
              type: "system"
            });
          }
        }
      }
    } catch (error) {
      console.error("[Cron] Error in 30-minute incomplete task reminder:", error);
    }
  });

  // Annual Leave Balance Reset (Run on Jan 1st at 00:00)
  cron.schedule("0 0 1 1 *", async () => {
    console.log("[Cron] Running Annual Leave Balance Reset...");
    try {
      const year = new Date().getFullYear();
      const users = await User.find({ isActive: true });
      const types = await LeaveType.find({ isActive: true });

      for (const user of users) {
        for (const type of types) {
          if (!type.applicableGenders.includes(user.gender)) continue;

          let carryForward = 0;
          if (type.maxCarryForward > 0) {
            const lastYearBalance = await LeaveBalance.findOne({
              userId: user._id,
              leaveTypeId: type._id,
              year: year - 1
            });
            if (lastYearBalance) {
              const available = lastYearBalance.totalCredits - lastYearBalance.used - lastYearBalance.pending;
              carryForward = Math.min(available, type.maxCarryForward);
            }
          }

          const initialCredits = type.creditsPerYear;

          await LeaveBalance.create({
            userId: user._id,
            leaveTypeId: type._id,
            organizationId: user.organizationId,
            year: year,
            totalCredits: initialCredits + carryForward,
            used: 0,
            pending: 0
          });
        }
      }
    } catch (error) {
      console.error("[Cron] Error in Annual Leave Balance Reset:", error);
    }
  });

  // Monthly Leave Credits (e.g., MSL) (Run on the 1st of every month at 00:00)
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Cron] Running Monthly Leave Credits allocation...");
    try {
      const year = new Date().getFullYear();
      const types = await LeaveType.find({ isActive: true, creditsPerMonth: { $gt: 0 } });
      
      for (const type of types) {
        const users = await User.find({ isActive: true, gender: { $in: type.applicableGenders } });
        
        for (const user of users) {
          const balance = await LeaveBalance.findOne({
            userId: user._id,
            leaveTypeId: type._id,
            year: year
          });

          if (balance) {
            balance.totalCredits += type.creditsPerMonth;
            await balance.save();
          } else {
             // In case they were hired this month, create balance
             await LeaveBalance.create({
               userId: user._id,
               leaveTypeId: type._id,
               organizationId: user.organizationId,
               year: year,
               totalCredits: type.creditsPerMonth,
               used: 0,
               pending: 0
             });
          }
        }
      }
    } catch (error) {
      console.error("[Cron] Error in Monthly Leave Credits:", error);
    }
  });

  // Monthly on the 1st day at 00:00 - Deduct unused monthly use-it-or-lose-it leaves (like Earned/Menstrual)
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Cron] Running monthly use-it-or-lose-it leave expiry check...");
    try {
      const now = new Date();
      let year = now.getFullYear();
      let lastMonth = now.getMonth() - 1; // 0-indexed. If now is Jan (0), lastMonth is -1
      
      // If the current month is January, the "previous month" is December of the previous year
      if (lastMonth < 0) {
        lastMonth = 11;
        year -= 1;
      }

      // Find monthly use-it-or-lose-it leave types
      const monthlyLeaveTypes = await LeaveType.find({ creditsPerMonth: 1, maxCarryForward: 0, isActive: true });
      const monthlyTypeIds = monthlyLeaveTypes.map(lt => lt._id);

      if (monthlyTypeIds.length > 0) {
        const balances = await LeaveBalance.find({ 
          year: now.getFullYear(), // Update balances for the current year
          leaveTypeId: { $in: monthlyTypeIds }
        });

        for (const balance of balances) {
          // Check if the user had any approved/pending leave for this type in the last month
          const monthStart = new Date(year, lastMonth, 1);
          const monthEnd = new Date(year, lastMonth + 1, 0, 23, 59, 59);

          const usedLastMonth = await LeaveRequest.findOne({
            userId: balance.userId,
            leaveTypeId: balance.leaveTypeId,
            status: { $in: ["Approved", "Pending"] },
            startDate: { $gte: monthStart, $lte: monthEnd }
          });

          // If they didn't use a leave last month, it expires!
          if (!usedLastMonth) {
            balance.expired += 1;
            await balance.save();
          }
        }
      }
      console.log("[Cron] Completed monthly leave expiry check.");
    } catch (error) {
      console.error("[Cron] Error in monthly leave expiry check:", error);
    }
  });
};
