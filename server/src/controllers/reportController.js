import ExcelJS from "exceljs";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import AuditLog from "../models/AuditLog.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

export const exportTaskReport = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: "End date cannot be before start date." });
    }

    // Restrict max range to 1 year + 1 month
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays > 396) {
      return res.status(400).json({ message: "Export range cannot exceed 1 year." });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const activeUsers = await User.find({
      organizationId,
      isActive: true,
      role: { $ne: "client" }
    }).select("name email role gender");

    const usersMap = {};
    for (const u of activeUsers) {
      usersMap[u._id.toString()] = u;
    }

    // Fetch all attendance for these users in the date range
    const attendanceRecords = await Attendance.find({
      organizationId,
      attendanceDate: {
        $gte: start.toISOString().split("T")[0],
        $lte: end.toISOString().split("T")[0]
      }
    });

    const attendanceMap = {};
    for (const a of attendanceRecords) {
      const uId = a.userId.toString();
      if (!attendanceMap[uId]) attendanceMap[uId] = {};
      attendanceMap[uId][a.attendanceDate] = a;
    }

    // Fetch all tasks created, updated or active within the range
    const tasks = await Task.find({
      organizationId,
      $or: [
        { createdAt: { $lte: end }, updatedAt: { $gte: start } },
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    })
      .populate("createdBy", "name")
      .populate("projectId", "name");

    const tasksByUser = {};
    for (const u of activeUsers) {
      tasksByUser[u._id.toString()] = [];
    }

    for (const task of tasks) {
      const assignees = [];
      if (task.assignedTo) assignees.push(task.assignedTo.toString());
      if (task.assignedToUsers) {
        for (const au of task.assignedToUsers) {
          assignees.push(au.toString());
        }
      }

      const uniqueAssignees = [...new Set(assignees)];
      for (const assignee of uniqueAssignees) {
        if (tasksByUser[assignee]) {
          tasksByUser[assignee].push(task);
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TaskPilot";
    workbook.created = new Date();

    const reportSheet = workbook.addWorksheet("Task Report", {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    reportSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 20 },
      { header: 'Task Name', key: 'taskName', width: 40 },
      { header: 'Project', key: 'project', width: 25 }, // Project name requires populating project, wait I didn't populate it. Let me just leave it for now or populate it.
      { header: 'Assigned By', key: 'assignedBy', width: 20 },
      { header: 'Assigned Time', key: 'assignedTime', width: 15 },
      { header: 'Completion Time', key: 'completionTime', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Working Day Status', key: 'workingDayStatus', width: 20 },
      { header: 'Remarks', key: 'remarks', width: 30 }
    ];

    reportSheet.getRow(1).font = { bold: true };

    const summarySheet = workbook.addWorksheet("Employee Monthly Summary", {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    summarySheet.columns = [
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Tasks Assigned', key: 'tasksAssigned', width: 15 },
      { header: 'Tasks Completed', key: 'tasksCompleted', width: 15 },
      { header: 'Tasks In Progress', key: 'tasksInProgress', width: 18 },
      { header: 'Tasks Pending', key: 'tasksPending', width: 15 },
      { header: 'Tasks Rejected', key: 'tasksRejected', width: 15 },
      { header: 'Tasks Cancelled', key: 'tasksCancelled', width: 15 },
      { header: 'Attendance Days', key: 'attendanceDays', width: 18 },
      { header: 'Half Days', key: 'halfDays', width: 15 },
      { header: 'Absent Days', key: 'absentDays', width: 15 },
      { header: 'Sundays', key: 'sundays', width: 12 },
      { header: 'Holidays', key: 'holidays', width: 12 },
      { header: 'Completion Rate', key: 'completionRate', width: 18 }
    ];

    summarySheet.getRow(1).font = { bold: true };

    const dateIterator = new Date(start);
    const dailyRows = [];

    // Summary counters per user
    const summaryData = {};
    for (const u of activeUsers) {
      summaryData[u._id.toString()] = {
        name: u.name,
        assigned: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        rejected: 0,
        cancelled: 0,
        attendanceDays: 0,
        halfDays: 0,
        absentDays: 0,
        sundays: 0,
        holidays: 0
      };
    }

    while (dateIterator <= end) {
      const dateStr = dateIterator.toISOString().split("T")[0];
      const isSunday = dateIterator.getDay() === 0;

      for (const user of activeUsers) {
        const uId = user._id.toString();
        const att = attendanceMap[uId]?.[dateStr];
        const userTasks = tasksByUser[uId] || [];

        // Filter tasks that belong to this day (created or updated or falls into range)
        // Simplest approximation: if task was created <= this date AND (not completed OR completed on/after this date)
        // A task is "assigned" on this day if its createdAt date matches this date.
        // Wait, the requirement says "Show actual assigned tasks" if present.
        // Let's just find tasks created on this specific day to represent "Assigned Tasks".
        const dailyTasks = userTasks.filter(t => {
          const tDate = new Date(t.createdAt).toISOString().split("T")[0];
          return tDate === dateStr;
        });

        // Update summary attendance
        let workStatus = "Absent";
        let remarks = "No Attendance Record";
        if (att) {
          workStatus = att.status || "Absent";
          if (workStatus === "Present") summaryData[uId].attendanceDays++;
          else if (workStatus === "Half Day") summaryData[uId].halfDays++;
          else if (workStatus === "Absent") summaryData[uId].absentDays++;
          else if (workStatus === "Weekly Off") summaryData[uId].sundays++;
          else if (workStatus === "Holiday") summaryData[uId].holidays++;
          
          if (workStatus === "Absent") remarks = "Absent";
          else remarks = "";
        } else {
          if (isSunday) {
            workStatus = "Sunday";
            remarks = "Weekly Off";
            summaryData[uId].sundays++;
          } else {
            summaryData[uId].absentDays++;
          }
        }

        if (dailyTasks.length > 0) {
          for (const t of dailyTasks) {
            summaryData[uId].assigned++;
            if (t.status === "completed") summaryData[uId].completed++;
            else if (t.status === "inprogress") summaryData[uId].inProgress++;
            else if (t.status === "rejected") summaryData[uId].rejected++;
            else if (t.status === "cancelled") summaryData[uId].cancelled++;
            else summaryData[uId].pending++;

            dailyRows.push({
              date: dateStr,
              employeeName: user.name,
              taskName: t.title,
              project: t.projectId?.name || "-", 
              assignedBy: t.createdBy?.name || "-",
              assignedTime: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              completionTime: t.status === "completed" ? new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-",
              status: t.status,
              workingDayStatus: workStatus,
              remarks: remarks
            });
          }
        } else {
          dailyRows.push({
            date: dateStr,
            employeeName: user.name,
            taskName: "-",
            project: "-",
            assignedBy: "-",
            assignedTime: "-",
            completionTime: "-",
            status: isSunday ? "Sunday" : workStatus,
            workingDayStatus: workStatus,
            remarks: remarks
          });
        }
      }

      dateIterator.setDate(dateIterator.getDate() + 1);
    }

    // Apply rows to Sheet 1 with alternating colors
    dailyRows.forEach((row, index) => {
      const addedRow = reportSheet.addRow(row);
      if (index % 2 === 0) {
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9F9F9' }
        };
      }
    });

    // Populate Summary Sheet
    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalAttendance = 0;
    let totalAbsent = 0;

    const summaryRows = [];
    for (const u of activeUsers) {
      const d = summaryData[u._id.toString()];
      const rate = d.assigned > 0 ? ((d.completed / d.assigned) * 100).toFixed(2) + "%" : "0.00%";
      
      totalAssigned += d.assigned;
      totalCompleted += d.completed;
      totalAttendance += d.attendanceDays;
      totalAbsent += d.absentDays;

      summaryRows.push({
        employeeName: d.name,
        tasksAssigned: d.assigned,
        tasksCompleted: d.completed,
        tasksInProgress: d.inProgress,
        tasksPending: d.pending,
        tasksRejected: d.rejected,
        tasksCancelled: d.cancelled,
        attendanceDays: d.attendanceDays,
        halfDays: d.halfDays,
        absentDays: d.absentDays,
        sundays: d.sundays,
        holidays: d.holidays,
        completionRate: rate
      });
    }

    summaryRows.forEach(row => summarySheet.addRow(row));

    const avgRate = totalAssigned > 0 ? ((totalCompleted / totalAssigned) * 100).toFixed(2) + "%" : "0.00%";
    
    const totalsRow = summarySheet.addRow({
      employeeName: "TOTALS",
      tasksAssigned: totalAssigned,
      tasksCompleted: totalCompleted,
      tasksInProgress: "-",
      tasksPending: "-",
      tasksRejected: "-",
      tasksCancelled: "-",
      attendanceDays: totalAttendance,
      halfDays: "-",
      absentDays: totalAbsent,
      sundays: "-",
      holidays: "-",
      completionRate: avgRate
    });

    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEEEEE' }
    };

    // Audit Log
    await AuditLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: "Exported Task Report",
      details: { startDate, endDate },
      organizationId
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Task_Report_${startDate}_to_${endDate}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Task Report Export Error:", error);
    res.status(500).json({ message: "Server error during task report export." });
  }
};
