import Task from "../models/Task.js";
import ActivityLog from "../models/ActivityLog.js";
import NotificationService from "../services/notificationService.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import TaskWorkSession from "../models/TaskWorkSession.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeAssigneeIds = ({ assignedTo, assignedToIds }) => {
  const ids = [];

  if (typeof assignedTo === "string" && assignedTo.trim()) {
    ids.push(assignedTo.trim());
  }

  if (Array.isArray(assignedToIds)) {
    for (const value of assignedToIds) {
      if (typeof value === "string" && value.trim()) ids.push(value.trim());
    }
  }

  return [...new Set(ids)];
};

const ASSIGNABLE_ROLES = new Set(["team", "admin", "superadmin"]);

const validateAssignableUsers = async ({
  assigneeIds,
  organizationId,
  currentUserId
}) => {
  if (!assigneeIds.length) {
    return { valid: true };
  }

  const assignees = await User.find({
    _id: { $in: assigneeIds },
    status: "approved",
    isActive: true
  }).select("_id role organizationId allowedOrganizations");

  if (assignees.length !== assigneeIds.length) {
    return {
      valid: false,
      message: "One or more assigned users are invalid for this organization"
    };
  }

  const assigneeMap = new Map(assignees.map((assignee) => [String(assignee._id), assignee]));

  for (const assigneeId of assigneeIds) {
    const assignee = assigneeMap.get(String(assigneeId));

    if (!assignee) {
      return {
        valid: false,
        message: "One or more assigned users are invalid for this organization"
      };
    }

    const isCurrentUser = currentUserId && String(assignee._id) === String(currentUserId);
    const accessibleOrganizationIds = [
      assignee.organizationId,
      ...(assignee.allowedOrganizations || [])
    ]
      .filter(Boolean)
      .map((value) => String(value));
    const isOrgAdminOrTeamMember =
      accessibleOrganizationIds.includes(String(organizationId)) &&
      ASSIGNABLE_ROLES.has(assignee.role);

    if (!isCurrentUser && !isOrgAdminOrTeamMember) {
      return {
        valid: false,
        message: "Tasks can be assigned to the creator, admins, and team members in this organization"
      };
    }
  }

  return { valid: true };
};

const normalizeOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("Invalid date provided");
    error.status = 400;
    throw error;
  }

  return parsed;
};

const normalizeMeetingNotes = (value, currentUserId) => {
  if (!Array.isArray(value)) {
    const error = new Error("Meeting notes must be provided as an array");
    error.status = 400;
    throw error;
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      const error = new Error("Each meeting note must be an object");
      error.status = 400;
      throw error;
    }

    const meetingDate = normalizeOptionalDate(entry.meetingDate);
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const description = typeof entry.description === "string" ? entry.description.trim() : "";

    if (!meetingDate) {
      const error = new Error("Meeting note date is required");
      error.status = 400;
      throw error;
    }

    if (!title) {
      const error = new Error("Meeting note title is required");
      error.status = 400;
      throw error;
    }

    if (!description) {
      const error = new Error("Meeting note description is required");
      error.status = 400;
      throw error;
    }

    const createdAt = normalizeOptionalDate(entry.createdAt) || new Date();
    const createdBy =
      typeof entry.createdBy === "string" && entry.createdBy.trim()
        ? entry.createdBy.trim()
        : typeof entry.createdBy === "object" &&
            entry.createdBy !== null &&
            "_id" in entry.createdBy &&
            typeof entry.createdBy._id === "string" &&
            entry.createdBy._id.trim()
          ? entry.createdBy._id.trim()
          : currentUserId;

    return {
      meetingDate,
      title,
      description,
      createdBy,
      createdAt
    };
  });
};

const parseTimezoneOffsetMinutes = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getLocalDateKey = (date, timezoneOffsetMinutes = 0) => {
  return new Date(date.getTime() - timezoneOffsetMinutes * MILLISECONDS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
};

const addDaysToDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, month - 1, day) + days * MILLISECONDS_PER_DAY);
  return nextDate.toISOString().slice(0, 10);
};

const getUtcInstantForLocalMidnight = (dateKey, timezoneOffsetMinutes = 0) => {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, month - 1, day) + timezoneOffsetMinutes * MILLISECONDS_PER_MINUTE);
};

const getDurationMinutes = (startedAt, endedAt) => {
  const duration = endedAt.getTime() - startedAt.getTime();
  return duration > 0 ? Math.max(1, Math.round(duration / MILLISECONDS_PER_MINUTE)) : 0;
};

const splitSessionAcrossWorkDates = (startedAt, endedAt, timezoneOffsetMinutes = 0) => {
  if (endedAt <= startedAt) {
    return [];
  }

  const chunks = [];
  let chunkStart = startedAt;

  while (chunkStart < endedAt) {
    const workDate = getLocalDateKey(chunkStart, timezoneOffsetMinutes);
    const nextDayBoundary = getUtcInstantForLocalMidnight(
      addDaysToDateKey(workDate, 1),
      timezoneOffsetMinutes
    );
    const chunkEnd = nextDayBoundary < endedAt ? nextDayBoundary : endedAt;

    chunks.push({
      workDate,
      startedAt: chunkStart,
      endedAt: chunkEnd,
      durationMinutes: getDurationMinutes(chunkStart, chunkEnd)
    });

    chunkStart = chunkEnd;
  }

  return chunks;
};

const getTaskWorkSummaryData = async ({
  taskId,
  userId,
  organizationId,
  timezoneOffsetMinutes = 0
}) => {
  const todayKey = getLocalDateKey(new Date(), timezoneOffsetMinutes);
  const closedSessionMatch = {
    $or: [
      { sessionState: { $in: ["paused", "stopped"] } },
      { endedAt: { $ne: null } }
    ]
  };
  const activeSessionMatch = {
    $or: [
      { sessionState: "active" },
      { $and: [{ endedAt: null }, { sessionState: { $exists: false } }] }
    ]
  };

  const [todaySessions, recentDailyRaw, activeSession] = await Promise.all([
    TaskWorkSession.find({
      taskId,
      userId,
      organizationId,
      workDate: todayKey,
      ...closedSessionMatch
    }).sort({ startedAt: -1 }),
    TaskWorkSession.aggregate([
      {
        $match: {
          taskId,
          userId,
          organizationId,
          ...closedSessionMatch
        }
      },
      {
        $group: {
          _id: "$workDate",
          totalMinutes: { $sum: "$durationMinutes" },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]),
    TaskWorkSession.findOne({
      taskId,
      userId,
      organizationId,
      ...activeSessionMatch
    }).sort({ startedAt: -1 })
  ]);

  const recentDailyMap = new Map(
    recentDailyRaw.map((entry) => [
      entry._id,
      {
        workDate: entry._id,
        totalMinutes: entry.totalMinutes,
        sessionCount: entry.sessionCount
      }
    ])
  );

  let todayTotalMinutes = todaySessions.reduce(
    (sum, session) => sum + (session.durationMinutes || 0),
    0
  );

  let activeSessionSummary = null;

  if (activeSession) {
    const now = new Date();
    const activeChunks = splitSessionAcrossWorkDates(
      activeSession.startedAt,
      now,
      timezoneOffsetMinutes
    );
    const activeTodayChunk = activeChunks.find((chunk) => chunk.workDate === todayKey);

    if (activeTodayChunk) {
      todayTotalMinutes += activeTodayChunk.durationMinutes;
    }

    for (const chunk of activeChunks) {
      const existing = recentDailyMap.get(chunk.workDate);

      if (existing) {
        existing.totalMinutes += chunk.durationMinutes;
        existing.sessionCount += 1;
      } else {
        recentDailyMap.set(chunk.workDate, {
          workDate: chunk.workDate,
          totalMinutes: chunk.durationMinutes,
          sessionCount: 1
        });
      }
    }

    activeSessionSummary = {
      _id: activeSession._id,
      startedAt: activeSession.startedAt,
      workDate: activeSession.workDate
    };
  }

  const recentDays = [...recentDailyMap.values()]
    .sort((left, right) => right.workDate.localeCompare(left.workDate))
    .slice(0, 7);

  return {
    todayKey,
    todayTotalMinutes,
    todaySessions,
    recentDays,
    activeSession: activeSessionSummary
  };
};

const getTaskTeamWorkBreakdown = async ({
  taskId,
  organizationId,
  timezoneOffsetMinutes = 0
}) => {
  const todayKey = getLocalDateKey(new Date(), timezoneOffsetMinutes);
  const sessions = await TaskWorkSession.find({
    taskId,
    organizationId
  })
    .populate("userId", "name email role")
    .sort({ startedAt: -1 });

  const breakdownMap = new Map();

  for (const session of sessions) {
    const userId = String(session.userId?._id || session.userId || "");

    if (!userId) {
      continue;
    }

    const existing = breakdownMap.get(userId) || {
      userId,
      user: session.userId
        ? {
          _id: String(session.userId._id),
          name: session.userId.name,
          email: session.userId.email,
          role: session.userId.role
        }
        : null,
      totalMinutes: 0,
      todayMinutes: 0,
      sessionCount: 0,
      activeSessionStartedAt: null
    };

    const isActiveSession =
      session.sessionState === "active" ||
      (!session.sessionState && !session.endedAt);

    if (isActiveSession) {
      const chunks = splitSessionAcrossWorkDates(
        session.startedAt,
        new Date(),
        timezoneOffsetMinutes
      );
      const activeTotalMinutes = chunks.reduce((sum, chunk) => sum + chunk.durationMinutes, 0);
      const activeTodayMinutes = chunks
        .filter((chunk) => chunk.workDate === todayKey)
        .reduce((sum, chunk) => sum + chunk.durationMinutes, 0);

      existing.totalMinutes += activeTotalMinutes;
      existing.todayMinutes += activeTodayMinutes;
      existing.sessionCount += 1;
      existing.activeSessionStartedAt = session.startedAt;
    } else {
      const closedDurationMinutes =
        session.durationMinutes ||
        (session.endedAt ? getDurationMinutes(session.startedAt, session.endedAt) : 0);

      existing.totalMinutes += closedDurationMinutes;
      if (session.workDate === todayKey) {
        existing.todayMinutes += closedDurationMinutes;
      }
      existing.sessionCount += 1;
    }

    breakdownMap.set(userId, existing);
  }

  return [...breakdownMap.values()].sort((left, right) => {
    if (left.activeSessionStartedAt && !right.activeSessionStartedAt) return -1;
    if (!left.activeSessionStartedAt && right.activeSessionStartedAt) return 1;
    return right.totalMinutes - left.totalMinutes;
  });
};

const finalizeWorkSession = async ({
  session,
  taskTitle,
  organizationId,
  timezoneOffsetMinutes = 0,
  actorUserId,
  finalState,
  activityAction
}) => {
  const finishedAt = new Date();
  const chunks = splitSessionAcrossWorkDates(
    session.startedAt,
    finishedAt,
    timezoneOffsetMinutes
  );

  const [firstChunk, ...remainingChunks] = chunks;

  session.endedAt = firstChunk?.endedAt || finishedAt;
  session.durationMinutes = firstChunk?.durationMinutes || 0;
  session.workDate = firstChunk?.workDate || session.workDate;
  session.sessionState = finalState;
  await session.save();

  if (remainingChunks.length > 0) {
    await TaskWorkSession.insertMany(
      remainingChunks.map((chunk, index) => ({
        taskId: session.taskId,
        userId: session.userId,
        organizationId: session.organizationId,
        projectId: session.projectId,
        startedAt: chunk.startedAt,
        endedAt: chunk.endedAt,
        durationMinutes: chunk.durationMinutes,
        workDate: chunk.workDate,
        sessionState: index === remainingChunks.length - 1 ? finalState : "paused"
      }))
    );
  }

  const totalDurationMinutes = chunks.reduce(
    (sum, chunk) => sum + chunk.durationMinutes,
    0
  );

  await ActivityLog.create({
    userId: actorUserId,
    action: `${activityAction} on task "${taskTitle}"`,
    entityType: "task",
    entityId: session.taskId,
    projectId: session.projectId,
    organizationId,
    changes: {
      startedAt: session.startedAt,
      endedAt: finishedAt,
      durationMinutes: totalDurationMinutes,
      sessionState: finalState
    }
  });

  return {
    _id: session._id,
    startedAt: session.startedAt,
    endedAt: finishedAt,
    durationMinutes: totalDurationMinutes,
    sessionState: finalState
  };
};

const getActiveSessionLookup = (extra = {}) => ({
  ...extra,
  $or: [
    { sessionState: "active" },
    { $and: [{ endedAt: null }, { sessionState: { $exists: false } }] }
  ]
});

const validateTaskTimeline = ({ startDate, endDate, deadlineDate }) => {
  if (startDate && endDate && endDate < startDate) {
    const error = new Error("End date must be after the start date");
    error.status = 400;
    throw error;
  }

  if (startDate && deadlineDate && deadlineDate < startDate) {
    const error = new Error("Deadline date must be on or after the start date");
    error.status = 400;
    throw error;
  }
};

const populateAssignees = (query) => {
  return query
    .populate("assignedTo", "name email role")
    .populate("assignedToUsers", "name email role")
    .populate("parentTaskId", "title");
};

const getDescendantTaskIds = async (rootTaskId) => {
  const collectedIds = [];
  const queue = [String(rootTaskId)];

  while (queue.length > 0) {
    const currentTaskId = queue.shift();
    const children = await Task.find({ parentTaskId: currentTaskId }).select("_id");

    for (const child of children) {
      const childId = String(child._id);
      collectedIds.push(childId);
      queue.push(childId);
    }
  }

  return collectedIds;
};

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      parentTaskId,
      assignedTo,
      assignedToIds,
      priority,
      startDate,
      endDate,
      deadlineDate,
      clientVisible
    } = req.body;

    if (!title || (!projectId && !parentTaskId)) {
      return res.status(400).json({ message: "title and either projectId or parentTaskId are required" });
    }

    const parentTask = parentTaskId
      ? await Task.findById(parentTaskId).select("_id title projectId organizationId clientVisible")
      : null;

    if (parentTaskId && !parentTask) {
      return res.status(404).json({ message: "Parent task not found" });
    }

    const resolvedProjectId = parentTask?.projectId || projectId;

    const project = await Project.findById(resolvedProjectId).select("_id organizationId name clientVisible");

    const activeOrganizationId =
      req.user.role === "superadmin" ? null : await requireActiveOrganizationId(req);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (
      req.user.role !== "superadmin" &&
      String(project.organizationId) !== String(activeOrganizationId)
    ) {
      return res.status(403).json({ message: "Not allowed for this organization" });
    }

    const assigneeIds = normalizeAssigneeIds({ assignedTo, assignedToIds });

    if (assigneeIds.length > 0) {
      const validation = await validateAssignableUsers({
        assigneeIds,
        organizationId: project.organizationId,
        currentUserId: req.user._id
      });

      if (!validation.valid) {
        return res.status(400).json({
          message: validation.message
        });
      }
    }

    const normalizedStartDate = normalizeOptionalDate(startDate);
    const normalizedDeadlineDate = normalizeOptionalDate(deadlineDate);
    const normalizedEndDate = normalizeOptionalDate(endDate);

    validateTaskTimeline({
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      deadlineDate: normalizedDeadlineDate
    });

    const task = await Task.create({
      title,
      description,
      projectId: resolvedProjectId,
      parentTaskId: parentTask?._id || null,
      assignedTo: assigneeIds[0] || undefined,
      assignedToUsers: assigneeIds,
      priority,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      deadlineDate: normalizedDeadlineDate,
      dueDate: normalizedDeadlineDate,
      clientVisible: typeof clientVisible === "boolean" ? clientVisible : (parentTask?.clientVisible ?? false),
      createdBy: req.user._id,
      organizationId: project.organizationId
    });

    if (assigneeIds.length > 0) {
      for (const userId of assigneeIds) {
        await NotificationService.createNotification({
          userId,
          organizationId: project.organizationId,
          title: "New Task Assigned",
          message: `You have been assigned a new task: ${task.title}`,
          type: "task_assigned",
          taskId: task._id
        });
      }
    }

    await ActivityLog.create({
      userId: req.user._id,
      action: parentTask ? `created sub-task "${task.title}"` : `created task "${task.title}"`,
      entityType: "task",
      entityId: task._id,
      projectId: task.projectId,
      organizationId: project.organizationId,
      changes: {
        title: task.title,
        assignedToUsers: assigneeIds,
        parentTaskId: parentTask?._id || null,
        parentTaskTitle: parentTask?.title || null,
        startDate: task.startDate,
        endDate: task.endDate,
        deadlineDate: task.deadlineDate
      }
    });

    res.status(201).json({
      message: "Task created successfully",
      task
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const tasks = await populateAssignees(Task.find({
      organizationId,
      $or: [
        { createdBy: req.user._id },
        { assignedTo: req.user._id },
        { assignedToUsers: req.user._id }
      ]
    }))
      .populate("createdBy", "name email")
      .populate("projectId", "name");

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getTasksByMember = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const { userId } = req.params;
    const { status } = req.query;

    const query = {
      organizationId,
      $or: [
        { assignedTo: userId },
        { assignedToUsers: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const tasks = await populateAssignees(Task.find(query))
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("projectId", "name");

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const organizationId = await requireActiveOrganizationId(req);

    const task = await populateAssignees(Task.findOne({
      _id: req.params.id,
      organizationId
    }));

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
    const assignedIds = [
      ...(task.assignedTo ? [String(task.assignedTo?._id || task.assignedTo)] : []),
      ...((task.assignedToUsers || []).map((u) => String(u?._id || u)))
    ];
    const isAssigned = assignedIds.includes(String(req.user._id));

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ message: "Only the assigned user or an admin can move this task." });
    }

    const oldStatus = task.status;
    const previousEndDate = task.endDate;

    task.status = status;
    if (status === "completed" && !task.endDate) {
      task.endDate = new Date();
    }
    if (status !== "completed" && oldStatus === "completed" && previousEndDate) {
      task.endDate = undefined;
    }
    await task.save();

    const notifyIds = [
      ...(task.assignedTo ? [String(task.assignedTo?._id || task.assignedTo)] : []),
      ...((task.assignedToUsers || []).map((u) => String(u?._id || u)))
    ];
    const uniqueNotifyIds = [...new Set(notifyIds)].filter(Boolean);

    if (uniqueNotifyIds.length > 0) {
      for (const userId of uniqueNotifyIds) {
        await NotificationService.createNotification({
          userId,
          organizationId: task.organizationId,
          title: "Task Status Updated",
          message: `Your task "${task.title}" moved to ${status}`,
          type: status === "completed" ? "task_completed" : "task_updated",
          taskId: task._id
        });
      }
    }
    
    if (status === "completed" && task.createdBy && !uniqueNotifyIds.includes(String(task.createdBy._id || task.createdBy))) {
      await NotificationService.createNotification({
        userId: task.createdBy._id || task.createdBy,
        organizationId: task.organizationId,
        title: "Task Completed",
        message: `Task "${task.title}" has been marked as completed.`,
        type: "task_completed",
        taskId: task._id
      });
    }

    await ActivityLog.create({
      userId: req.user._id,
      action: `moved task to ${status}`,
      entityType: "task",
      entityId: task._id,
      projectId: task.projectId,
      organizationId: task.organizationId,
      changes: {
        from: oldStatus,
        to: status,
        endDate: task.endDate
      }
    });

    res.json(task);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getOrganizationTasks = async (req, res) => {
  try {
    const { status } = req.query;
    const organizationId = await requireActiveOrganizationId(req);

    const query = {
      organizationId
    };

    if (status) {
      query.status = status;
    }

    if (req.user.role === "client") {
      query.clientVisible = true;
    }

    const tasks = await populateAssignees(Task.find(query))
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("projectId", "name");

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const searchTasks = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50)
    );

    if (!rawQuery) {
      return res.json({ tasks: [] });
    }

    const searchRegex = new RegExp(rawQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchingProjects = await Project.find({
      organizationId,
      name: searchRegex
    }).select("_id");

    const query = {
      organizationId,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        ...(matchingProjects.length > 0
          ? [{ projectId: { $in: matchingProjects.map((project) => project._id) } }]
          : [])
      ]
    };

    if (status && status !== "all") {
      query.status = status;
    }

    if (req.user.role === "client") {
      query.clientVisible = true;
    }

    const tasks = await populateAssignees(Task.find(query))
      .populate("createdBy", "name email")
      .populate("projectId", "name")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit);

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getProjectTasks = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const query = {
      projectId: req.params.projectId,
      organizationId,
      parentTaskId: null
    };

    if (req.user.role === "client") {
      query.clientVisible = true;
    }

    const tasks = await populateAssignees(Task.find(query))
      .populate("createdBy", "name email")
      .populate("projectId", "name");

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getClientTasks = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const tasks = await populateAssignees(Task.find({
      organizationId,
      clientVisible: true
    }))
      .populate("projectId", "name");

    res.json({ tasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const task = await populateAssignees(Task.findOne({
      _id: req.params.id,
      organizationId
    }))
      .populate("createdBy", "name email role")
      .populate("meetingNotes.createdBy", "name email role")
      .populate("projectId", "name");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (req.user.role === "client" && !task.clientVisible) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const subtasksQuery = {
      parentTaskId: task._id,
      organizationId
    };

    if (req.user.role === "client") {
      subtasksQuery.clientVisible = true;
    }

    const subtasks = await populateAssignees(Task.find(subtasksQuery))
      .populate("createdBy", "name email role")
      .sort({ createdAt: 1 });

    res.json({ task, subtasks });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const startTaskWorkSession = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(req.body?.timezoneOffsetMinutes);

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    }).select("_id title projectId organizationId");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const activeSession = await TaskWorkSession.findOne(
      getActiveSessionLookup({
        userId: req.user._id,
        organizationId
      })
    ).populate("taskId", "title");

    if (activeSession) {
      if (String(activeSession.taskId?._id || activeSession.taskId) !== String(task._id)) {
        return res.status(409).json({
          message: "You already have an active work session on another task",
          activeTask: activeSession.taskId
        });
      }

      const summary = await getTaskWorkSummaryData({
        taskId: task._id,
        userId: req.user._id,
        organizationId,
        timezoneOffsetMinutes
      });

      return res.json({
        message: "Work session already active",
        session: activeSession,
        summary
      });
    }

    const session = await TaskWorkSession.create({
      taskId: task._id,
      userId: req.user._id,
      organizationId,
      projectId: task.projectId,
      startedAt: new Date(),
      sessionState: "active",
      workDate: getLocalDateKey(new Date(), timezoneOffsetMinutes)
    });

    await ActivityLog.create({
      userId: req.user._id,
      action: `started work on task "${task.title}"`,
      entityType: "task",
      entityId: task._id,
      projectId: task.projectId,
      organizationId,
      changes: {
        startedAt: session.startedAt
      }
    });

    const summary = await getTaskWorkSummaryData({
      taskId: task._id,
      userId: req.user._id,
      organizationId,
      timezoneOffsetMinutes
    });

    res.status(201).json({
      message: "Work session started",
      session,
      summary
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const stopTaskWorkSession = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(req.body?.timezoneOffsetMinutes);

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    }).select("_id title projectId organizationId");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const activeSession = await TaskWorkSession.findOne(
      getActiveSessionLookup({
        taskId: task._id,
        userId: req.user._id,
        organizationId
      })
    );

    if (!activeSession) {
      return res.status(404).json({ message: "No active work session found for this task" });
    }

    const finalizedSession = await finalizeWorkSession({
      session: activeSession,
      taskTitle: task.title,
      organizationId,
      timezoneOffsetMinutes,
      actorUserId: req.user._id,
      finalState: "stopped",
      activityAction: "stopped work"
    });

    const summary = await getTaskWorkSummaryData({
      taskId: task._id,
      userId: req.user._id,
      organizationId,
      timezoneOffsetMinutes
    });

    res.json({
      message: "Work session stopped",
      session: finalizedSession,
      summary
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const pauseTaskWorkSession = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(req.body?.timezoneOffsetMinutes);

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    }).select("_id title projectId organizationId");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const activeSession = await TaskWorkSession.findOne(
      getActiveSessionLookup({
        taskId: task._id,
        userId: req.user._id,
        organizationId
      })
    );

    if (!activeSession) {
      return res.status(404).json({ message: "No active work session found for this task" });
    }

    const finalizedSession = await finalizeWorkSession({
      session: activeSession,
      taskTitle: task.title,
      organizationId,
      timezoneOffsetMinutes,
      actorUserId: req.user._id,
      finalState: "paused",
      activityAction: "paused work"
    });

    const summary = await getTaskWorkSummaryData({
      taskId: task._id,
      userId: req.user._id,
      organizationId,
      timezoneOffsetMinutes
    });

    res.json({
      message: "Work session paused",
      session: finalizedSession,
      summary
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getCurrentWorkSession = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const session = await TaskWorkSession.findOne(
      getActiveSessionLookup({
        userId: req.user._id,
        organizationId
      })
    )
      .populate("taskId", "title")
      .populate("projectId", "name")
      .sort({ startedAt: -1 });

    if (!session) {
      return res.json({ session: null });
    }

    res.json({
      session: {
        _id: session._id,
        taskId: session.taskId?._id || session.taskId,
        taskTitle: session.taskId?.title || "Task",
        projectId: session.projectId?._id || session.projectId,
        projectName: session.projectId?.name || "Project",
        startedAt: session.startedAt
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const pauseCurrentWorkSession = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(req.body?.timezoneOffsetMinutes);

    const activeSession = await TaskWorkSession.findOne(
      getActiveSessionLookup({
        userId: req.user._id,
        organizationId
      })
    ).populate("taskId", "title");

    if (!activeSession) {
      return res.json({ message: "No active work session to pause", session: null });
    }

    const finalizedSession = await finalizeWorkSession({
      session: activeSession,
      taskTitle: activeSession.taskId?.title || "Task",
      organizationId,
      timezoneOffsetMinutes,
      actorUserId: req.user._id,
      finalState: "paused",
      activityAction: "paused work"
    });

    res.json({
      message: "Work session paused",
      session: finalizedSession
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const getTaskWorkSummary = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(
      req.query?.timezoneOffsetMinutes
    );

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    }).select("_id");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const summary = await getTaskWorkSummaryData({
      taskId: task._id,
      userId: req.user._id,
      organizationId,
      timezoneOffsetMinutes
    });

    if (req.user.role === "admin" || req.user.role === "superadmin") {
      summary.teamBreakdown = await getTaskTeamWorkBreakdown({
        taskId: task._id,
        organizationId,
        timezoneOffsetMinutes
      });
      summary.totalTaskMinutes = summary.teamBreakdown.reduce(
        (sum, entry) => sum + entry.totalMinutes,
        0
      );
      summary.totalTaskTodayMinutes = summary.teamBreakdown.reduce(
        (sum, entry) => sum + entry.todayMinutes,
        0
      );
    }

    res.json({ summary });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const {
      title,
      description,
      assignedTo,
      assignedToIds,
      priority,
      startDate,
      endDate,
      deadlineDate,
      clientVisible,
      meetingNotes
    } = req.body;

    const normalizedStartDate = normalizeOptionalDate(startDate);
    const normalizedDeadlineDate = normalizeOptionalDate(deadlineDate);
    const normalizedEndDate = normalizeOptionalDate(endDate);
    const nextAssigneeIds = Object.prototype.hasOwnProperty.call(req.body, "assignedToIds") || Object.prototype.hasOwnProperty.call(req.body, "assignedTo")
      ? normalizeAssigneeIds({ assignedTo, assignedToIds })
      : null;

    const nextStartDate = Object.prototype.hasOwnProperty.call(req.body, "startDate")
      ? normalizedStartDate
      : task.startDate;
    const nextEndDate = Object.prototype.hasOwnProperty.call(req.body, "endDate")
      ? normalizedEndDate
      : task.endDate;
    const nextDeadlineDate = Object.prototype.hasOwnProperty.call(req.body, "deadlineDate")
      ? normalizedDeadlineDate
      : task.deadlineDate;
    const nextMeetingNotes = Object.prototype.hasOwnProperty.call(req.body, "meetingNotes")
      ? normalizeMeetingNotes(meetingNotes, String(req.user._id))
      : null;

    validateTaskTimeline({
      startDate: nextStartDate,
      endDate: nextEndDate,
      deadlineDate: nextDeadlineDate
    });

    if (nextAssigneeIds) {
      if (nextAssigneeIds.length > 0) {
        const validation = await validateAssignableUsers({
          assigneeIds: nextAssigneeIds,
          organizationId,
          currentUserId: req.user._id
        });

        if (!validation.valid) {
          return res.status(400).json({
            message: validation.message
          });
        }
      }
    }

    const before = {
      title: task.title,
      description: task.description,
      assignedToUsers: task.assignedToUsers,
      priority: task.priority,
      startDate: task.startDate,
      endDate: task.endDate,
      deadlineDate: task.deadlineDate,
      clientVisible: task.clientVisible,
      meetingNotes: task.meetingNotes
    };

    if (typeof title === "string" && title.trim()) task.title = title.trim();
    if (typeof description === "string") task.description = description;
    if (typeof priority === "string") task.priority = priority;
    if (typeof clientVisible === "boolean") task.clientVisible = clientVisible;
    if (nextAssigneeIds) {
      task.assignedToUsers = nextAssigneeIds;
      task.assignedTo = nextAssigneeIds[0] || undefined;
    }
    if (startDate !== undefined) task.startDate = normalizedStartDate;
    if (endDate !== undefined) task.endDate = normalizedEndDate;
    if (deadlineDate !== undefined) {
      task.deadlineDate = normalizedDeadlineDate;
      task.dueDate = normalizedDeadlineDate;
    }
    if (nextMeetingNotes) task.meetingNotes = nextMeetingNotes;

    await task.save();

    if (nextAssigneeIds) {
      const prevIds = (before.assignedToUsers || []).map((id) => String(id));
      const newlyAssignedIds = nextAssigneeIds.filter((id) => !prevIds.includes(String(id)));
      if (newlyAssignedIds.length > 0) {
        for (const userId of newlyAssignedIds) {
          await NotificationService.createNotification({
            userId,
            organizationId: task.organizationId,
            title: "Task Reassigned",
            message: `You have been assigned to task: ${task.title}`,
            type: "task_assigned",
            taskId: task._id
          });
        }
      }
    }

    await ActivityLog.create({
      userId: req.user._id,
      action: `edited task "${task.title}"`,
      entityType: "task",
      entityId: task._id,
      projectId: task.projectId,
      organizationId,
      changes: {
        before,
        after: {
          title: task.title,
          description: task.description,
          assignedToUsers: task.assignedToUsers,
          priority: task.priority,
          startDate: task.startDate,
          endDate: task.endDate,
          deadlineDate: task.deadlineDate,
          clientVisible: task.clientVisible,
          meetingNotes: task.meetingNotes
        }
      }
    });

    res.json({
      message: "Task updated successfully",
      task
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const descendantTaskIds = await getDescendantTaskIds(task._id);
    const taskIdsToDelete = [String(task._id), ...descendantTaskIds];

    await Comment.deleteMany({ taskId: { $in: taskIdsToDelete } });
    await Notification.deleteMany({
      organizationId,
      entityType: "task",
      entityId: { $in: taskIdsToDelete }
    });
    await ActivityLog.create({
      userId: req.user._id,
      action: `deleted task "${task.title}"`,
      entityType: "task",
      entityId: task._id,
      projectId: task.projectId,
      organizationId,
      changes: {
        deletedTaskTitle: task.title,
        deletedFromStatus: task.status,
        deletedSubtaskCount: descendantTaskIds.length
      }
    });
    await Task.deleteMany({ _id: { $in: taskIdsToDelete } });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
