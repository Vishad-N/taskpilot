"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import {
  MessageSquare,
  Clock,
  Play,
  Pause,
  ChevronLeft,
  ShieldAlert,
  ShieldCheck,
  User,
  Calendar,
  Zap,
  MoreHorizontal,
  Send,
  Search,
  Lock,
  ArrowRight,
  GitBranch,
  Plus,
  X,
  Sun,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMe } from "@/hooks/useMe";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  deadlineDate?: string;
  projectId?: { _id: string; name: string };
  parentTaskId?: { _id: string; title: string } | null;
  assignedTo?: { _id: string; name: string; email: string };
  assignedToUsers?: Array<{ _id: string; name: string; email: string }>;
  createdBy?: { _id: string; name: string; email: string };
  clientVisible?: boolean;
  meetingNotes?: MeetingNote[];
};

type MeetingNote = {
  meetingDate: string;
  title: string;
  description: string;
  createdAt?: string;
  createdBy?: { _id: string; name: string; email?: string; role?: string } | string;
};

type Comment = {
  _id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  userId?: { _id: string; name: string; email: string; role: string };
};

type DailyUpdate = {
  _id: string;
  content: string;
  date: string;
  createdAt: string;
  userId?: { _id: string; name: string; email: string; role: string };
};

type AssignableUser = {
  _id: string;
  name: string;
};

type WorkSessionSummary = {
  _id: string;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: number;
};

type WorkDaySummary = {
  workDate: string;
  totalMinutes: number;
  sessionCount: number;
};

type ActiveWorkSession = {
  _id: string;
  startedAt: string;
  workDate: string;
};

type WorkSummary = {
  todayKey: string;
  todayTotalMinutes: number;
  todaySessions: WorkSessionSummary[];
  recentDays: WorkDaySummary[];
  activeSession: ActiveWorkSession | null;
  teamBreakdown?: Array<{
    userId: string;
    user: { _id: string; name: string; email?: string; role?: string } | null;
    totalMinutes: number;
    todayMinutes: number;
    sessionCount: number;
    activeSessionStartedAt: string | null;
  }>;
  totalTaskMinutes?: number;
  totalTaskTodayMinutes?: number;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500"
};

const canManageTaskDetails = (role?: string) => role === "admin" || role === "superadmin";
const canTrackWork = (role?: string) => role === "admin" || role === "superadmin" || role === "team";
const canViewTeamWork = (role?: string) => role === "admin" || role === "superadmin";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

const formatDateInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getTodayDateInputValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return "0m";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getElapsedTodayMinutes = (startedAt: string, nowTimestamp: number) => {
  const start = new Date(startedAt);
  const todayStart = getTodayStart();
  const effectiveStart = start > todayStart ? start : todayStart;
  const elapsed = nowTimestamp - effectiveStart.getTime();

  if (elapsed <= 0) return 0;

  return Math.max(1, Math.round(elapsed / (60 * 1000)));
};

const formatWorkDateLabel = (workDate: string) => {
  const date = new Date(`${workDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
};

const formatDisplayDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};

type SectionTab = {
  id: string;
  label: string;
};

export default function TaskDetailsPage() {
  const { id } = useParams();
  const { user } = useMe();
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [workSummary, setWorkSummary] = useState<WorkSummary | null>(null);
  const [workSummaryFetchedAt, setWorkSummaryFetchedAt] = useState<number | null>(null);
  const [workActionLoading, setWorkActionLoading] = useState<"start" | "stop" | null>(null);
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [team, setTeam] = useState<AssignableUser[]>([]);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [subtaskSearch, setSubtaskSearch] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [metadataAssigneeDraft, setMetadataAssigneeDraft] = useState("");
  const [activeSection, setActiveSection] = useState("subtasks");
  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    description: "",
    assignedToIds: [] as string[],
    priority: "Normal",
    startDate: "",
    endDate: "",
    deadlineDate: "",
    clientVisible: false
  });
  const [metadataForm, setMetadataForm] = useState({
    assignedToIds: [] as string[],
    priority: "Normal",
    startDate: "",
    endDate: "",
    deadlineDate: "",
    clientVisible: false
  });
  const [meetingNoteForm, setMeetingNoteForm] = useState({
    meetingDate: getTodayDateInputValue(),
    title: "",
    description: ""
  });
  const [savingMeetingNote, setSavingMeetingNote] = useState(false);
  const [editingMeetingNoteIndex, setEditingMeetingNoteIndex] = useState<number | null>(null);
  const [dailyUpdates, setDailyUpdates] = useState<DailyUpdate[]>([]);
  const [newDailyUpdateContent, setNewDailyUpdateContent] = useState("");
  const [submittingDailyUpdate, setSubmittingDailyUpdate] = useState(false);

  const fetchTaskData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskResult, commentsResult, workResult, dailyUpdatesResult] = await Promise.allSettled([
        api.get(`/tasks/${id}`),
        api.get(`/comments/task/${id}`),
        api.get(`/tasks/${id}/work-summary`, {
          params: {
            timezoneOffsetMinutes: new Date().getTimezoneOffset()
          }
        }),
        api.get(`/daily-updates/task/${id}`)
      ]);

      if (taskResult.status !== "fulfilled") {
        throw taskResult.reason;
      }

      const taskRes = taskResult.value;
      const commentsRes =
        commentsResult.status === "fulfilled"
          ? commentsResult.value
          : { data: { comments: [] } };
      const workRes =
        workResult.status === "fulfilled"
          ? workResult.value
          : { data: { summary: null } };

      const dailyUpdatesRes =
        dailyUpdatesResult.status === "fulfilled"
          ? dailyUpdatesResult.value
          : { data: { updates: [] } };

      setTask(taskRes.data.task);
      setSubtasks(taskRes.data.subtasks ?? []);
      setComments(commentsRes.data.comments ?? []);
      setDailyUpdates((dailyUpdatesRes.data.updates ?? []) as DailyUpdate[]);
      setWorkSummary((workRes.data.summary ?? null) as WorkSummary | null);
      setWorkSummaryFetchedAt(Date.now());
      const loadedTask = taskRes.data.task as Task;
      setMetadataForm({
        assignedToIds:
          loadedTask.assignedToUsers && loadedTask.assignedToUsers.length > 0
            ? loadedTask.assignedToUsers.map((member) => member._id)
            : loadedTask.assignedTo?._id
              ? [loadedTask.assignedTo._id]
              : [],
        priority: loadedTask.priority ?? "Normal",
        startDate: formatDateInput(loadedTask.startDate),
        endDate: formatDateInput(loadedTask.endDate),
        deadlineDate: formatDateInput(loadedTask.deadlineDate || loadedTask.dueDate),
        clientVisible: Boolean(loadedTask.clientVisible)
      });
      setMetadataAssigneeDraft("");
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to load task details", err);
      setError(getErrorMessage(err, "Failed to load task details"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchTaskData();
    }
  }, [id, fetchTaskData]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "superadmin" || user?.role === "team") {
      api.get("/users/assignable")
        .then((res) => setTeam((res.data.users ?? []) as AssignableUser[]))
        .catch(() => setTeam([]));
    }
  }, [user?.role]);

  useEffect(() => {
    setSubtaskForm((current) => ({
      ...current,
      clientVisible: task?.clientVisible ?? false
    }));
  }, [task?.clientVisible]);

  useEffect(() => {
    if (!workSummary?.activeSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLiveNow(Date.now());
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [workSummary?.activeSession]);

  const addComment = async (isInternal: boolean = false) => {
    if (!newComment.trim()) return;
    const commentText = newComment;
    try {
      await api.post("/comments/add", {
        taskId: id,
        content: newComment,
        isInternal
      });
      setNewComment("");
      const c = await api.get(`/comments/task/${id}`);
      setComments(c.data.comments ?? []);
      showToast({
        title: isInternal ? "Internal note added" : "Comment sent",
        description: commentText.length > 72 ? `${commentText.slice(0, 72)}...` : commentText,
        variant: "success"
      });
    } catch {
      showToast({
        title: "Comment failed",
        description: "We could not add that comment right now.",
        variant: "error"
      });
    }
  };

  const updateStatus = async (newStatus: string) => {
    const previousStatus = task?.status;
    if (!task || previousStatus === newStatus) return;

    setUpdating(true);
    try {
      await api.patch(`/tasks/update-status/${id}`, { status: newStatus });
      await fetchTaskData();
      showToast({
        title: "Task updated",
        description: `${task.title} moved to ${newStatus}.`,
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.patch(`/tasks/update-status/${id}`, { status: previousStatus });
            await fetchTaskData();
            showToast({
              title: "Status reverted",
              description: `${task.title} is back in ${previousStatus}.`,
              variant: "info"
            });
          }
        }
      });
    } catch {
      showToast({
        title: "Status update failed",
        description: "We could not change the task status.",
        variant: "error"
      });
    } finally {
      setUpdating(false);
    }
  };

  const createSubtask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task || !subtaskForm.title.trim()) {
      return;
    }

    try {
      setCreatingSubtask(true);
      await api.post("/tasks/create", {
        title: subtaskForm.title,
        description: subtaskForm.description,
        parentTaskId: task._id,
        assignedToIds: subtaskForm.assignedToIds,
        priority: subtaskForm.priority,
        startDate: subtaskForm.startDate || undefined,
        endDate: subtaskForm.endDate || undefined,
        deadlineDate: subtaskForm.deadlineDate || undefined,
        clientVisible: subtaskForm.clientVisible
      });

      setSubtaskForm({
        title: "",
        description: "",
        assignedToIds: [],
        priority: "Normal",
        startDate: "",
        endDate: "",
        deadlineDate: "",
        clientVisible: task.clientVisible ?? false
      });
      setAssigneeDraft("");
      await fetchTaskData();
      showToast({
        title: "Sub-task created",
        description: "The new nested task is now linked to this task.",
        variant: "success"
      });
    } catch {
      showToast({
        title: "Sub-task creation failed",
        description: "We could not create that sub-task right now.",
        variant: "error"
      });
    } finally {
      setCreatingSubtask(false);
    }
  };

  const saveMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task) return;

    try {
      setSavingMetadata(true);
      await api.patch(`/tasks/${task._id}`, {
        assignedToIds: metadataForm.assignedToIds,
        priority: metadataForm.priority,
        startDate: metadataForm.startDate || undefined,
        endDate: metadataForm.endDate || undefined,
        deadlineDate: metadataForm.deadlineDate || undefined,
        clientVisible: metadataForm.clientVisible
      });
      await fetchTaskData();
      showToast({
        title: "Metadata updated",
        description: "Task timeline and metadata were saved.",
        variant: "success"
      });
    } catch {
      showToast({
        title: "Metadata update failed",
        description: "We could not save the task metadata right now.",
        variant: "error"
      });
    } finally {
      setSavingMetadata(false);
    }
  };

  const saveMeetingNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task) return;

    const title = meetingNoteForm.title.trim();
    const description = meetingNoteForm.description.trim();

    if (!meetingNoteForm.meetingDate || !title || !description) {
      showToast({
        title: "Missing meeting note details",
        description: "Please add a date, title, and note description before saving.",
        variant: "error"
      });
      return;
    }

    try {
      setSavingMeetingNote(true);
      const currentNotes = task.meetingNotes ?? [];
      const nextMeetingNote = editingMeetingNoteIndex !== null
        ? {
          ...currentNotes[editingMeetingNoteIndex],
          meetingDate: meetingNoteForm.meetingDate,
          title,
          description
        }
        : {
          meetingDate: meetingNoteForm.meetingDate,
          title,
          description
        };

      await api.patch(`/tasks/${task._id}`, {
        meetingNotes:
          editingMeetingNoteIndex !== null
            ? currentNotes.map((note, index) =>
              index === editingMeetingNoteIndex ? nextMeetingNote : note
            )
            : [...currentNotes, nextMeetingNote]
      });
      setMeetingNoteForm({
        meetingDate: getTodayDateInputValue(),
        title: "",
        description: ""
      });
      setEditingMeetingNoteIndex(null);
      await fetchTaskData();
      showToast({
        title: editingMeetingNoteIndex !== null ? "Meeting note updated" : "Meeting note saved",
        description: editingMeetingNoteIndex !== null
          ? "The selected meeting note has been updated."
          : "The meeting status for this task has been updated.",
        variant: "success"
      });
    } catch {
      showToast({
        title: "Meeting note failed",
        description: "We could not save the meeting status note right now.",
        variant: "error"
      });
    } finally {
      setSavingMeetingNote(false);
    }
  };

  const startEditingMeetingNote = (noteIndex: number) => {
    const note = task?.meetingNotes?.[noteIndex];

    if (!note) return;

    setMeetingNoteForm({
      meetingDate: formatDateInput(note.meetingDate) || getTodayDateInputValue(),
      title: note.title,
      description: note.description
    });
    setEditingMeetingNoteIndex(noteIndex);
  };

  const cancelMeetingNoteEdit = () => {
    setMeetingNoteForm({
      meetingDate: getTodayDateInputValue(),
      title: "",
      description: ""
    });
    setEditingMeetingNoteIndex(null);
  };

  const deleteMeetingNote = async (noteIndex: number) => {
    if (!task) return;

    try {
      setSavingMeetingNote(true);
      await api.patch(`/tasks/${task._id}`, {
        meetingNotes: (task.meetingNotes ?? []).filter((_, index) => index !== noteIndex)
      });

      if (editingMeetingNoteIndex === noteIndex) {
        cancelMeetingNoteEdit();
      } else if (editingMeetingNoteIndex !== null && editingMeetingNoteIndex > noteIndex) {
        setEditingMeetingNoteIndex(editingMeetingNoteIndex - 1);
      }

      await fetchTaskData();
      showToast({
        title: "Meeting note deleted",
        description: "The selected meeting note has been removed.",
        variant: "success"
      });
    } catch {
      showToast({
        title: "Delete failed",
        description: "We could not delete that meeting note right now.",
        variant: "error"
      });
    } finally {
      setSavingMeetingNote(false);
    }
  };

  const postDailyUpdate = async () => {
    if (!newDailyUpdateContent.trim() || !task?.projectId?._id) return;
    try {
      setSubmittingDailyUpdate(true);
      await api.post("/daily-updates", {
        content: newDailyUpdateContent,
        taskId: id,
        projectId: task.projectId._id,
        timezoneOffsetMinutes: new Date().getTimezoneOffset()
      });
      setNewDailyUpdateContent("");
      const res = await api.get(`/daily-updates/task/${id}`);
      setDailyUpdates((res.data.updates ?? []) as DailyUpdate[]);
      showToast({ title: "Update posted", description: "Your daily update was submitted.", variant: "success" });
    } catch {
      showToast({ title: "Failed to post update", description: "Could not submit your daily update.", variant: "error" });
    } finally {
      setSubmittingDailyUpdate(false);
    }
  };

  const deleteTaskDailyUpdate = async (updateId: string) => {
    try {
      await api.delete(`/daily-updates/${updateId}`);
      setDailyUpdates((current) => current.filter((u) => u._id !== updateId));
      showToast({ title: "Update deleted", description: "The daily update was removed.", variant: "success" });
    } catch {
      showToast({ title: "Delete failed", description: "Could not remove that update.", variant: "error" });
    }
  };

  const syncWorkSummary = (summary: WorkSummary | null) => {
    setWorkSummary(summary);
    setWorkSummaryFetchedAt(Date.now());
    setLiveNow(Date.now());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("taskpilot:work-session-updated"));
    }
  };

  const startWorkSession = async () => {
    if (!task) return;

    try {
      setWorkActionLoading("start");
      const res = await api.post(`/tasks/${task._id}/work/start`, {
        timezoneOffsetMinutes: new Date().getTimezoneOffset()
      });
      syncWorkSummary((res.data.summary ?? null) as WorkSummary | null);
      showToast({
        title: "Work session started",
        description: `Tracking time for ${task.title}.`,
        variant: "success"
      });
    } catch (err: unknown) {
      showToast({
        title: "Could not start tracking",
        description: getErrorMessage(err, "You may already have another active work session."),
        variant: "error"
      });
    } finally {
      setWorkActionLoading(null);
    }
  };

  const stopWorkSession = async () => {
    if (!task) return;

    try {
      setWorkActionLoading("stop");
      const res = await api.post(`/tasks/${task._id}/work/stop`, {
        timezoneOffsetMinutes: new Date().getTimezoneOffset()
      });
      syncWorkSummary((res.data.summary ?? null) as WorkSummary | null);
      showToast({
        title: "Work session stopped",
        description: `Logged ${formatMinutes(res.data.session?.durationMinutes ?? 0)} on ${task.title}.`,
        variant: "success"
      });
    } catch (err: unknown) {
      showToast({
        title: "Could not stop tracking",
        description: getErrorMessage(err, "No active work session was found for this task."),
        variant: "error"
      });
    } finally {
      setWorkActionLoading(null);
    }
  };

  const additionalActiveMinutes =
    workSummary?.activeSession && workSummaryFetchedAt
      ? Math.max(
        0,
        getElapsedTodayMinutes(workSummary.activeSession.startedAt, liveNow) -
        getElapsedTodayMinutes(workSummary.activeSession.startedAt, workSummaryFetchedAt)
      )
      : 0;

  const effectiveTodayMinutes = (workSummary?.todayTotalMinutes ?? 0) + additionalActiveMinutes;
  const activeSessionElapsedMinutes = workSummary?.activeSession
    ? getElapsedTodayMinutes(workSummary.activeSession.startedAt, liveNow)
    : 0;

  const sectionTabs = useMemo(() => {
    const tabs: SectionTab[] = [
      { id: "subtasks", label: "Sub-tasks" },
      { id: "comments", label: "Comments" }
    ];

    if (canManageTaskDetails(user?.role)) {
      tabs.push({ id: "phase-control", label: "Phase Control" });
    }

    if (canTrackWork(user?.role)) {
      tabs.push({ id: "time-record", label: "Time Record" });
      tabs.push({ id: "daily-update", label: "Daily Update" });
    }

    tabs.push({ id: "metadata", label: "Task Metadata" });
    tabs.push({ id: "meeting-status", label: "Meeting Status" });

    return tabs;
  }, [user?.role]);

  const meetingNotes = useMemo(() => {
    return (task?.meetingNotes ?? [])
      .map((note, originalIndex) => ({
        ...note,
        originalIndex
      }))
      .sort((left, right) => {
        const leftTime = new Date(left.meetingDate).getTime();
        const rightTime = new Date(right.meetingDate).getTime();
        return rightTime - leftTime;
      });
  }, [task?.meetingNotes]);

  const filteredSubtasks = useMemo(() => {
    const query = subtaskSearch.trim().toLowerCase();

    if (!query) {
      return subtasks;
    }

    return subtasks.filter((subtask) => {
      const assigneeText = subtask.assignedToUsers && subtask.assignedToUsers.length > 0
        ? subtask.assignedToUsers.map((member) => member.name).join(" ")
        : (subtask.assignedTo?.name ?? "");

      return [
        subtask.title,
        subtask.description ?? "",
        subtask.status,
        subtask.priority ?? "",
        assigneeText
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [subtaskSearch, subtasks]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <DashboardLayout>
      <div className="mb-10 flex items-center justify-between">
        <Link
          href="/tasks"
          className="group flex items-center gap-3 text-xs font-black text-gray-500 hover:text-white uppercase tracking-[0.3em] transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-indigo-600 transition-all group-hover:border-indigo-500">
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          Back to Registry
        </Link>

        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <SoftLoader
          title="Loading task details"
          subtitle="Syncing comments, activity, assignments, and status controls."
        />
      )}

      {!loading && error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && task && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-10"
        >
          <div className="lg:col-span-2 space-y-10">
            <motion.div variants={item} className="glass-card rounded-[2.5rem] p-10 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center gap-2 text-indigo-400">
                    <ShieldCheck size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      #{task._id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  {task.parentTaskId && (
                    <Link
                      href={`/tasks/${task.parentTaskId._id}`}
                      className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <GitBranch size={12} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Parent: {task.parentTaskId.title}
                      </span>
                    </Link>
                  )}
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                    {task.projectId?.name || "Global Objective"}
                  </span>
                </div>

                <h1 className="text-4xl lg:text-5xl font-black italic tracking-tighter text-white uppercase leading-none mb-8">
                  {task.title}
                </h1>

                {task.description && (
                  <div className="p-8 bg-white/3 border border-white/5 rounded-3xl group-hover:border-white/10 transition-colors">
                    <p className="text-sm text-gray-400 font-bold leading-relaxed whitespace-pre-wrap uppercase tracking-wider">
                      {task.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute top-0 right-0 p-10 opacity-5 grayscale group-hover:opacity-10 transition-opacity">
                <ShieldAlert size={120} />
              </div>
            </motion.div>

            <motion.div variants={item} className="sticky top-4 z-20">
              <div className="rounded-[2rem] border border-white/10 bg-[#11161D]/85 p-3 backdrop-blur-xl">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {sectionTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSection(tab.id)}
                      className={`shrink-0 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                        activeSection === tab.id
                          ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {activeSection === "subtasks" && (
            <motion.div
              variants={item}
              className="glass-card rounded-[2.5rem] p-10 border border-white/5"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Nested execution</p>
                  <h2 className="mt-2 text-xl font-black text-white italic tracking-tighter uppercase">Sub-tasks</h2>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                  {filteredSubtasks.length}{subtaskSearch.trim() ? ` / ${subtasks.length}` : ""} linked
                </span>
              </div>

              <div className="relative mb-6">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={subtaskSearch}
                  onChange={(event) => setSubtaskSearch(event.target.value)}
                  placeholder="Search this task's sub-tasks..."
                  className="w-full rounded-2xl border border-white/5 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-emerald-500/40"
                />
              </div>

              <div className="space-y-4">
                {subtasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-600">No sub-tasks yet</p>
                  </div>
                ) : filteredSubtasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-600">No matching sub-tasks</p>
                  </div>
                ) : (
                  filteredSubtasks.map((subtask) => (
                    <Link
                      key={subtask._id}
                      href={`/tasks/${subtask._id}`}
                      className="group block rounded-[1.75rem] border border-white/7 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-5 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.75)] transition-all hover:-translate-y-0.5 hover:border-emerald-500/25 hover:shadow-[0_26px_60px_-40px_rgba(16,185,129,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-gray-500">
                              {subtask.priority || "Normal"}
                            </span>
                            <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-gray-500">
                              {subtask.clientVisible ? "Client visible" : "Internal"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-black text-white uppercase tracking-tight transition-colors group-hover:text-emerald-300">
                            {subtask.title}
                          </p>
                          {subtask.description && (
                            <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-gray-500 line-clamp-2">
                              {subtask.description}
                            </p>
                          )}
                          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              { label: "Start", value: formatDisplayDate(subtask.startDate) },
                              { label: "End", value: formatDisplayDate(subtask.endDate) },
                              { label: "Deadline", value: formatDisplayDate(subtask.deadlineDate || subtask.dueDate) },
                              {
                                label: "Owner",
                                value:
                                  subtask.assignedToUsers && subtask.assignedToUsers.length > 0
                                    ? subtask.assignedToUsers.map((member) => member.name).join(", ")
                                    : (subtask.assignedTo?.name ?? "Unassigned")
                              }
                            ].map((item) => (
                              <div
                                key={`${subtask._id}-${item.label}`}
                                className="rounded-2xl border border-white/6 bg-black/10 px-3.5 py-3"
                              >
                                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-gray-600">
                                  {item.label}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-gray-200">
                                  {item.value || (item.label === "Deadline" ? "Not set" : "Not added")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusColors[subtask.status] || "bg-gray-500"}`} />
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.24em]">
                            {subtask.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {(user?.role === "admin" || user?.role === "superadmin" || user?.role === "team") && (
                <form onSubmit={createSubtask} className="mt-8 space-y-5 border-t border-white/5 pt-8">
                  <div className="flex items-center gap-3">
                    <Plus size={14} className="text-emerald-400" />
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.24em]">Create sub-task</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Sub-task title</span>
                      <input
                        type="text"
                        value={subtaskForm.title}
                        onChange={(event) => setSubtaskForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Refine onboarding checklist"
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Start date</span>
                      <input
                        type="date"
                        value={subtaskForm.startDate}
                        onChange={(event) => setSubtaskForm((current) => ({ ...current, startDate: event.target.value }))}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">End date</span>
                      <input
                        type="date"
                        value={subtaskForm.endDate}
                        onChange={(event) => setSubtaskForm((current) => ({ ...current, endDate: event.target.value }))}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Deadline</span>
                      <input
                        type="date"
                        value={subtaskForm.deadlineDate}
                        onChange={(event) => setSubtaskForm((current) => ({ ...current, deadlineDate: event.target.value }))}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      />
                    </label>
                  </div>

                  <label className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Description</span>
                    <textarea
                      value={subtaskForm.description}
                      onChange={(event) => setSubtaskForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Capture the expected outcome, owner context, and any dependencies."
                      className="w-full min-h-28 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-6 outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04] resize-none"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Priority</span>
                      <select
                        value={subtaskForm.priority}
                        onChange={(event) => setSubtaskForm((current) => ({ ...current, priority: event.target.value }))}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      >
                        <option value="Urgent">Urgent</option>
                        <option value="High">High</option>
                        <option value="Normal">Normal</option>
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Assign team members</span>
                      <select
                        value={assigneeDraft}
                        onChange={(event) => {
                          const next = event.target.value;
                          setAssigneeDraft(next);
                          if (!next) return;

                          setSubtaskForm((current) => ({
                            ...current,
                            assignedToIds: current.assignedToIds.includes(next)
                              ? current.assignedToIds
                              : [...current.assignedToIds, next]
                          }));
                        }}
                        className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 text-sm outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.04]"
                      >
                        <option value="">Select assignees</option>
                        {team.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {subtaskForm.assignedToIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {subtaskForm.assignedToIds.map((memberId) => {
                        const member = team.find((entry) => entry._id === memberId);

                        return (
                          <button
                            key={memberId}
                            type="button"
                            onClick={() =>
                              setSubtaskForm((current) => ({
                                ...current,
                                assignedToIds: current.assignedToIds.filter((value) => value !== memberId)
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-300"
                          >
                            <span>{member?.name ?? memberId}</span>
                            <X size={11} className="text-gray-500" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSubtaskForm((current) => ({
                        ...current,
                        clientVisible: !current.clientVisible
                      }))
                    }
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400"
                  >
                    {subtaskForm.clientVisible ? "Client visible" : "Internal only"}
                  </button>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={creatingSubtask}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
                    >
                      {creatingSubtask ? "Creating..." : "Create sub-task"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
            )}

            {activeSection === "comments" && (
            <motion.div
              variants={item}
              className="glass-card rounded-[2.5rem] p-10 border border-white/5"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-4">
                  <MessageSquare className="text-indigo-500" />
                  Operational Log
                </h2>
                <div className="flex gap-2">
                  <span className="text-[10px] px-3 py-1 bg-white/5 rounded-full font-black text-gray-500 uppercase tracking-widest">
                    {comments.length} entries
                  </span>
                </div>
              </div>

              <div className="space-y-8 mb-10">
                <AnimatePresence mode="popLayout">
                  {comments.map((comment, idx) => (
                    <motion.div
                      key={comment._id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex gap-6 ${comment.isInternal ? "p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl" : ""}`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg transition-all ${comment.isInternal ? "bg-amber-500 text-black rotate-3" : "bg-indigo-600 text-white -rotate-3"}`}>
                          {comment.userId?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        {comment.isInternal && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border border-amber-500/50 flex items-center justify-center">
                            <Lock size={10} className="text-amber-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-gray-200 uppercase tracking-wider">{comment.userId?.name}</span>
                            {comment.isInternal && (
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em] px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                                Internal
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                            {new Date(comment.createdAt).toLocaleString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              month: "short",
                              day: "numeric"
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                          {comment.content}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {comments.length === 0 && (
                  <div className="py-12 text-center grayscale opacity-30">
                    <Zap size={32} className="mx-auto mb-4 text-gray-500" />
                    <p className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">No Communication Logged</p>
                  </div>
                )}
              </div>

              <div className="pt-10 border-t border-white/5">
                <div className="bg-white/2 border border-white/10 rounded-4xl p-4 focus-within:border-indigo-500/50 transition-all shadow-inner">
                  <textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    placeholder="DEPLOY MESSAGE PACKET..."
                    className="w-full bg-transparent px-6 py-4 outline-none text-xs font-black text-white min-h-[120px] resize-none uppercase tracking-widest placeholder:opacity-30"
                  />
                  <div className="flex flex-col sm:flex-row justify-between items-center p-3 gap-4 border-t border-white/5 mt-2">
                    <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest ml-4">Terminal active / Secure channel</p>
                    <div className="flex gap-4 w-full sm:w-auto">
                      {user?.role !== "client" && (
                        <button
                          onClick={() => addComment(true)}
                          className="flex-1 sm:flex-none px-6 py-3 rounded-2xl text-[9px] font-black text-amber-500 border border-amber-500/30 hover:bg-amber-500/10 transition-all uppercase tracking-widest"
                        >
                          Ghost Note
                        </button>
                      )}
                      <button
                        onClick={() => addComment(false)}
                        className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-2xl text-[9px] font-black text-white transition-all shadow-lg shadow-indigo-600/20 active:scale-95 uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                      >
                        Transmit
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            )}

            {activeSection === "daily-update" && (
            <motion.div
              variants={item}
              className="glass-card rounded-[2.5rem] p-10 border border-white/5"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Team Progress Log</p>
                  <h2 className="mt-2 text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-4">
                    <Sun className="text-amber-400" size={20} />
                    Daily Updates
                  </h2>
                </div>
                <span className="text-[10px] px-3 py-1 bg-white/5 rounded-full font-black text-gray-500 uppercase tracking-widest">
                  {dailyUpdates.length} entries
                </span>
              </div>

              <div className="bg-white/2 border border-white/10 rounded-4xl p-4 focus-within:border-amber-500/50 transition-all shadow-inner mb-10">
                <textarea
                  value={newDailyUpdateContent}
                  onChange={(event) => setNewDailyUpdateContent(event.target.value)}
                  placeholder="WHAT DID YOU ACCOMPLISH TODAY..."
                  className="w-full bg-transparent px-6 py-4 outline-none text-xs font-black text-white min-h-[100px] resize-none uppercase tracking-widest placeholder:opacity-30"
                />
                <div className="flex flex-col sm:flex-row justify-between items-center p-3 gap-4 border-t border-white/5 mt-2">
                  <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest ml-4">Daily progress log / {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                  <button
                    type="button"
                    onClick={() => void postDailyUpdate()}
                    disabled={submittingDailyUpdate || !newDailyUpdateContent.trim()}
                    className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-500 px-8 py-3 rounded-2xl text-[9px] font-black text-white transition-all shadow-lg shadow-amber-600/20 active:scale-95 uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingDailyUpdate ? "Posting..." : "Post Update"}
                    <Send size={12} />
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <AnimatePresence mode="popLayout">
                  {dailyUpdates.map((update, idx) => (
                    <motion.div
                      key={update._id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex gap-6"
                    >
                      <div className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        {update.userId?.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-black text-gray-200 uppercase tracking-wider">{update.userId?.name}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md uppercase tracking-[0.2em]">
                              {update.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                              {new Date(update.createdAt).toLocaleString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                            {(user?._id === update.userId?._id || user?.role === "admin" || user?.role === "superadmin") && (
                              <button
                                type="button"
                                onClick={() => void deleteTaskDailyUpdate(update._id)}
                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-wider leading-relaxed whitespace-pre-wrap">
                          {update.content}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {dailyUpdates.length === 0 && (
                  <div className="py-12 text-center grayscale opacity-30">
                    <Sun size={32} className="mx-auto mb-4 text-gray-500" />
                    <p className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">No Updates Yet</p>
                    <p className="mt-2 text-sm font-semibold text-gray-600">Be the first to post what you accomplished today.</p>
                  </div>
                )}
              </div>
            </motion.div>
            )}
          </div>

          <div className="space-y-8">
            {canManageTaskDetails(user?.role) && activeSection === "phase-control" && (
              <motion.div
                variants={item}
                className="glass-card rounded-[2.5rem] p-8 border border-white/5"
              >
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-8 ml-2">Phase Control</h3>
                <div className="grid grid-cols-1 gap-4">
                  {["pending", "inprogress", "review", "completed", "blocked"].map((status) => (
                    <button
                      key={status}
                      disabled={updating}
                      onClick={() => updateStatus(status)}
                      className={`group px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border flex items-center justify-between ${task.status === status
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/30 -translate-y-0.5"
                        : "bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-gray-500"} ${task.status === status ? "animate-pulse shadow-[0_0_10px_currentColor]" : "opacity-40"}`} />
                        {status}
                      </div>
                      {task.status === status && <ArrowRight size={14} className="animate-bounce-x" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {canTrackWork(user?.role) && activeSection === "time-record" && (
              <motion.div
                variants={item}
                className="glass-card rounded-[2.5rem] p-8 border border-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-3 ml-2 flex items-center gap-3">
                      <Clock size={14} />
                      Personal Time Log
                    </h3>
                    <p className="text-4xl font-black italic tracking-tight text-white">
                      {formatMinutes(effectiveTodayMinutes)}
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">
                      Time tracked today on this task
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={workActionLoading !== null}
                    onClick={workSummary?.activeSession ? stopWorkSession : startWorkSession}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                      workSummary?.activeSession
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                        : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                    } ${workActionLoading ? "opacity-70" : "hover:scale-[1.02]"}`}
                  >
                    {workSummary?.activeSession ? <Pause size={14} /> : <Play size={14} />}
                    {workActionLoading === "start"
                      ? "Starting..."
                      : workActionLoading === "stop"
                        ? "Stopping..."
                        : workSummary?.activeSession
                          ? "Pause Work"
                          : "Start Work"}
                  </button>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                        My Record
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${
                        workSummary?.activeSession ? "text-emerald-300" : "text-gray-600"
                      }`}>
                        {workSummary?.activeSession ? "Running" : "Idle"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                          Today
                        </p>
                        <p className="mt-2 text-lg font-black text-white">
                          {formatMinutes(effectiveTodayMinutes)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                          Current Session
                        </p>
                        <p className="mt-2 text-lg font-black text-white">
                          {workSummary?.activeSession ? formatMinutes(activeSessionElapsedMinutes) : "0m"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                          Last 7 Days
                        </p>
                        <p className="mt-2 text-lg font-black text-white">
                          {formatMinutes(
                            (workSummary?.recentDays ?? []).reduce(
                              (sum, entry) => sum + entry.totalMinutes,
                              0
                            )
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {(workSummary?.recentDays ?? []).length > 0 ? (
                        (workSummary?.recentDays ?? []).map((entry) => (
                          <div key={entry.workDate} className="flex items-center justify-between gap-4 text-sm">
                            <div>
                              <p className="font-black uppercase tracking-[0.16em] text-gray-200">
                                {entry.workDate === workSummary?.todayKey ? "Today" : formatWorkDateLabel(entry.workDate)}
                              </p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-600">
                                {entry.sessionCount} session{entry.sessionCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <span className="font-black text-white">{formatMinutes(entry.totalMinutes)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                          No work tracked yet
                        </p>
                      )}
                    </div>
                  </div>

                  {canViewTeamWork(user?.role) && (
                    <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                          Other User Record
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-600">
                          Same task
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {(workSummary?.teamBreakdown ?? []).filter((entry) => entry.user?._id !== user?._id).length > 0 ? (
                          (workSummary?.teamBreakdown ?? [])
                            .filter((entry) => entry.user?._id !== user?._id)
                            .map((entry) => (
                            <div
                              key={entry.userId}
                              className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-black/10 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-gray-200">
                                  {entry.user?.name ?? "Unknown User"}
                                </p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">
                                  Today {formatMinutes(entry.todayMinutes)} · Overall {formatMinutes(entry.totalMinutes)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                                  entry.activeSessionStartedAt ? "text-emerald-300" : "text-gray-600"
                                }`}>
                                  {entry.activeSessionStartedAt ? "Running" : `${entry.sessionCount} session${entry.sessionCount === 1 ? "" : "s"}`}
                                </p>
                                {entry.activeSessionStartedAt && (
                                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">
                                    Since {new Date(entry.activeSessionStartedAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-600">
                            No tracked time from other users yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === "metadata" && (
            <motion.div
              variants={item}
              className="glass-card rounded-[2.5rem] p-8 border border-white/5"
            >
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-8 ml-2">Task Metadata</h3>
              <form onSubmit={saveMetadata} className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <User size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Operative</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <div className="flex max-w-[60%] flex-col items-end gap-3">
                      <select
                        value={metadataAssigneeDraft}
                        onChange={(event) => {
                          const next = event.target.value;
                          setMetadataAssigneeDraft(next);
                          if (!next) return;
                          setMetadataForm((current) => ({
                            ...current,
                            assignedToIds: current.assignedToIds.includes(next)
                              ? current.assignedToIds
                              : [...current.assignedToIds, next]
                          }));
                        }}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 outline-none"
                      >
                        <option value="">Assign operative</option>
                        {team.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      {metadataForm.assignedToIds.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {metadataForm.assignedToIds.map((memberId) => {
                            const member = team.find((entry) => entry._id === memberId);

                            return (
                              <button
                                key={memberId}
                                type="button"
                                onClick={() =>
                                  setMetadataForm((current) => ({
                                    ...current,
                                    assignedToIds: current.assignedToIds.filter((value) => value !== memberId)
                                  }))
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-300"
                              >
                                <span>{member?.name ?? memberId}</span>
                                <X size={11} className="text-gray-500" />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Unassigned</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black text-gray-300 uppercase italic">
                        {task.assignedToUsers && task.assignedToUsers.length > 0
                          ? task.assignedToUsers.map((member) => member.name).join(", ")
                          : (task.assignedTo?.name || "UNASSIGNED")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <Zap size={14} className="text-purple-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Urgency</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <select
                      value={metadataForm.priority}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, priority: event.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 outline-none"
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Normal">Normal</option>
                    </select>
                  ) : (
                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg border tracking-tighter uppercase italic ${task.priority === "Urgent"
                      ? "bg-red-500/10 text-red-500 border-red-500/30"
                      : task.priority === "High"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                    }`}>
                      {task.priority || "Normal"}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <Calendar size={14} className="text-green-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Start Date</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <input
                      type="date"
                      value={metadataForm.startDate}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, startDate: event.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 outline-none"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-tighter italic">
                      {task.startDate
                        ? new Date(task.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "NOT_SET"}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <Calendar size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">End Date</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <input
                      type="date"
                      value={metadataForm.endDate}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, endDate: event.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 outline-none"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-tighter italic">
                      {task.endDate
                        ? new Date(task.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "NOT_FINISHED"}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <Calendar size={14} className="text-green-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Deadline</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <input
                      type="date"
                      value={metadataForm.deadlineDate}
                      onChange={(event) => setMetadataForm((current) => ({ ...current, deadlineDate: event.target.value }))}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 outline-none"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-tighter italic">
                      {task.deadlineDate || task.dueDate
                        ? new Date(task.deadlineDate || task.dueDate || "").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "NO_DEADLINE"}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4 text-gray-500">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Client Visibility</span>
                  </div>
                  {canManageTaskDetails(user?.role) ? (
                    <button
                      type="button"
                      onClick={() => setMetadataForm((current) => ({ ...current, clientVisible: !current.clientVisible }))}
                      className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                        metadataForm.clientVisible ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-gray-400"
                      }`}
                    >
                      {metadataForm.clientVisible ? "Visible" : "Internal"}
                    </button>
                  ) : (
                    <span className="text-[11px] font-black text-gray-300 uppercase tracking-tighter italic">
                      {task.clientVisible ? "VISIBLE" : "INTERNAL"}
                    </span>
                  )}
                </div>

                {canManageTaskDetails(user?.role) && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingMetadata}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
                    >
                      {savingMetadata ? "Saving..." : "Save Metadata"}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
            )}

            {activeSection === "meeting-status" && (
              <motion.div
                variants={item}
                className="glass-card rounded-[2.5rem] border border-white/5 p-8"
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-gray-500">
                      <Calendar size={14} />
                      Meeting Status
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-gray-400">
                      Capture dated meeting notes for this task topic with a clear title and a full summary of what was discussed.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                    {meetingNotes.length} notes
                  </span>
                </div>

                {canManageTaskDetails(user?.role) && (
                  <form
                    onSubmit={saveMeetingNote}
                    className="mb-8 space-y-5 rounded-[2rem] border border-white/8 bg-white/[0.03] p-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                        {editingMeetingNoteIndex !== null ? "Edit Meeting Note" : "Add Meeting Note"}
                      </p>
                      {editingMeetingNoteIndex !== null && (
                        <button
                          type="button"
                          onClick={cancelMeetingNoteEdit}
                          className="rounded-full bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-300 transition hover:bg-white/10 hover:text-white"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                          Meeting Date
                        </span>
                        <input
                          type="date"
                          value={meetingNoteForm.meetingDate}
                          onChange={(event) =>
                            setMeetingNoteForm((current) => ({
                              ...current,
                              meetingDate: event.target.value
                            }))}
                          className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                          Meeting Title
                        </span>
                        <input
                          type="text"
                          value={meetingNoteForm.title}
                          onChange={(event) =>
                            setMeetingNoteForm((current) => ({
                              ...current,
                              title: event.target.value
                            }))}
                          placeholder="Sprint sync, client call, blocker review..."
                          className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                        Discussion Notes
                      </span>
                      <textarea
                        value={meetingNoteForm.description}
                        onChange={(event) =>
                          setMeetingNoteForm((current) => ({
                            ...current,
                            description: event.target.value
                          }))}
                        rows={5}
                        placeholder="Summarize what happened around this task topic, decisions made, blockers raised, and next steps."
                        className="w-full rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-4 text-sm text-white outline-none transition focus:border-emerald-500/40"
                      />
                    </label>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingMeetingNote}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {savingMeetingNote ? "Saving..." : editingMeetingNoteIndex !== null ? "Update Meeting Note" : "Save Meeting Note"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-4">
                  {meetingNotes.map((note, index) => (
                    <div
                      key={`${note.meetingDate}-${note.title}-${note.originalIndex}-${index}`}
                      className="rounded-[2rem] border border-white/6 bg-white/[0.02] p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
                            {new Date(note.meetingDate).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })}
                          </p>
                          <h4 className="mt-3 text-lg font-black uppercase tracking-tight text-white">
                            {note.title}
                          </h4>
                        </div>
                        <div className="text-right text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                          <p>
                            {typeof note.createdBy === "object" && note.createdBy !== null
                              ? note.createdBy.name
                              : "TaskPilot"}
                          </p>
                          {note.createdAt && (
                            <p className="mt-1">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </p>
                          )}
                          {canManageTaskDetails(user?.role) && (
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingMeetingNote(note.originalIndex)}
                                className="rounded-full bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-300 transition hover:bg-white/10 hover:text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteMeetingNote(note.originalIndex)}
                                disabled={savingMeetingNote}
                                className="rounded-full bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-300">
                        {note.description}
                      </p>
                    </div>
                  ))}

                  {meetingNotes.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-600">
                        No meeting notes recorded yet
                      </p>
                      <p className="mt-3 text-sm font-semibold text-gray-500">
                        Add the first dated note here to keep track of what was discussed around this task.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
