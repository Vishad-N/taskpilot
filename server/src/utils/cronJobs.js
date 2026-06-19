import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import NotificationService from "../services/notificationService.js";

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
          await Attendance.create({
            userId: user._id,
            organizationId: user.organizationId,
            attendanceDate: today,
            status: statusToApply,
          });
        }
      }
      console.log(`[Cron] Completed Attendance check.`);
    } catch (error) {
      console.error("[Cron] Error during 12:00 PM Attendance check:", error);
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
};
