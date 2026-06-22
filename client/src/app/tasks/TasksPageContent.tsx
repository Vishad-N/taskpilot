"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
// import { useSearchParams } from "next/navigation";
import { Plus, X, Calendar, User, Briefcase, Tag, CheckCircle2, Search, Clock, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SearchHandler from "./SearchHandler";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import Link from "next/link";

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
  projectId?: { _id: string; name: string } | string;
  parentTaskId?: { _id: string; title: string } | null;
  assignedTo?: { _id: string; name: string } | null;
  assignedToUsers?: Array<{ _id: string; name: string }>;
  createdBy?: { _id: string; name: string } | null;
};

type ProjectOption = {
  _id: string;
  name: string;
};

type AssignableUser = {
  _id: string;
  name: string;
  email?: string;
  role?: string;
};

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

const statuses = ["all", "pending", "inprogress", "review", "completed", "blocked"] as const;
const boardStatuses = ["pending", "inprogress", "review", "completed", "blocked"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500"
};

const canCreateTasks = (role?: string) => role === "admin" || role === "superadmin" || role === "team";
const formatStatusLabel = (status: string) => status === "inprogress" ? "In Progress" : `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useMe();
  const { showToast, dismissToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<AssignableUser[]>([]);

  // Creation state
  const [showCreate, setShowCreate] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [team, setTeam] = useState<AssignableUser[]>([]);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectId: "",
    assignedToIds: [] as string[],
    priority: "Normal",
    startDate: "",
    endDate: "",
    deadlineDate: "",
    clientVisible: true
  });
  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const load = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const trimmedSearch = searchTerm.trim();
      let res;
      if (trimmedSearch) {
        res = await api.get("/tasks/search", {
          params: {
            q: trimmedSearch,
            ...(status === "all" ? {} : { status })
          }
        });
      } else if (user?.role === "client") {
        res = await api.get("/tasks/client-view");
      } else if (myTasksOnly) {
        res = await api.get("/tasks/my-tasks");
      } else if (memberFilter) {
        res = await api.get(`/tasks/by-member/${memberFilter}`, {
          params: status === "all" ? {} : { status }
        });
      } else {
        res = await api.get("/tasks/org-tasks", {
          params: status === "all" ? {} : { status }
        });
      }

      let all = res.data.tasks ?? [];
      if (status !== "all" && (user?.role === "client" || myTasksOnly)) {
        all = all.filter((t: Task) => t.status === status);
      }
      setTasks(all);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load tasks"));
    } finally {
      setLoading(false);
    }
  }, [status, user?.role, myTasksOnly, memberFilter]);

  useEffect(() => {
    if (user) {
      const timeoutId = window.setTimeout(() => {
        void load(searchQuery);
      }, searchQuery.trim() ? 250 : 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [load, searchQuery, user]);

  useEffect(() => {
    const memberParam = searchParams.get("member") ?? "";
    if (memberParam && memberParam !== memberFilter) {
      setMemberFilter(memberParam);
      setMyTasksOnly(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const nextSearch = searchParams.get("q") ?? "";
    if (nextSearch !== searchQuery) {
      setSearchQuery(nextSearch);
    }
  }, [searchParams]);

  useEffect(() => {
    if (showCreate && canCreateTasks(user?.role)) {
      api.get("/projects/org-projects").then((res) => setProjects((res.data.projects ?? []) as ProjectOption[]));
      api.get("/users/assignable").then((res) => setTeam((res.data.users ?? []) as AssignableUser[]));
    }
  }, [showCreate, user?.role]);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "superadmin") {
      api.get("/users/assignable").then((res) => setTeamMembers((res.data.users ?? []) as AssignableUser[]));
    }
  }, [user?.role]);

  useEffect(() => {
    const handleTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const newTask = customEvent.detail;
      setTasks((current) => {
        if (current.some((t) => t._id === newTask._id)) return current;
        return [newTask, ...current];
      });
    };

    const handleTaskUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const updatedTask = customEvent.detail;
      setTasks((current) =>
        current.map((task) => (task._id === updatedTask._id ? { ...task, ...updatedTask } : task))
      );
    };

    const handleTaskDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ _id: string }>;
      const { _id } = customEvent.detail;
      setTasks((current) => current.filter((task) => task._id !== _id));
    };

    window.addEventListener("taskpilot:task_created", handleTaskCreated);
    window.addEventListener("taskpilot:task_updated", handleTaskUpdated);
    window.addEventListener("taskpilot:task_deleted", handleTaskDeleted);

    return () => {
      window.removeEventListener("taskpilot:task_created", handleTaskCreated);
      window.removeEventListener("taskpilot:task_updated", handleTaskUpdated);
      window.removeEventListener("taskpilot:task_deleted", handleTaskDeleted);
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const taskTitle = formData.title;
    try {
      await api.post("/tasks/create", formData);
      setShowCreate(false);
      await load(searchQuery);
      setFormData({
        title: "",
        description: "",
        projectId: "",
        assignedToIds: [],
        priority: "Normal",
        startDate: "",
        endDate: "",
        deadlineDate: "",
        clientVisible: true
      });
      setAssigneeDraft("");
      showToast({
        title: "Task created",
        description: `${taskTitle} has been added to the workflow.`,
        variant: "success"
      });
    } catch (err: unknown) {
      showToast({
        title: "Task creation failed",
        description: getErrorMessage(err, "Failed to create task"),
        variant: "error"
      });
    } finally {
      setCreating(false);
    }
  };

  const canManageTasks = user?.role === "admin" || user?.role === "superadmin";

  const canMoveTask = (task: Task) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "superadmin") return true;
    const assignedIds = [
      ...(task.assignedTo ? [task.assignedTo._id] : []),
      ...((task.assignedToUsers ?? []).map((u) => u._id))
    ];
    return assignedIds.includes(user._id);
  };
  const usesBoardLayout = user?.role !== "client";

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of boardStatuses) map[s] = [];
    for (const t of tasks) (map[t.status] ??= []).push(t);
    return map;
  }, [tasks]);

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
  };

  const isCardCollapsed = (taskId: string) => collapsedCards[taskId] ?? true;

  const toggleCardCollapsed = (taskId: string) => {
    setCollapsedCards((current) => ({
      ...current,
      [taskId]: !(current[taskId] ?? false)
    }));
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !editTitle.trim()) return;

    try {
      setSavingEdit(true);
      await api.patch(`/tasks/${editingTask._id}`, {
        title: editTitle,
        description: editDescription
      });
      setTasks((current) =>
        current.map((task) =>
          task._id === editingTask._id
            ? { ...task, title: editTitle, description: editDescription }
            : task
        )
      );
      showToast({
        title: "Task updated",
        description: `${editTitle} was updated successfully.`,
        variant: "success"
      });
      setEditingTask(null);
    } catch (err: unknown) {
      showToast({
        title: "Task update failed",
        description: getErrorMessage(err, "Could not update the task."),
        variant: "error"
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleUpdateTask();
  };

  const handleDeleteTask = async (task: Task) => {
    const toastId = showToast({
      title: `Delete ${task.title}?`,
      description: "This task will be removed from the workflow.",
      variant: "error",
      durationMs: 9000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            setDeletingTaskId(task._id);
            await api.delete(`/tasks/${task._id}`);
            setTasks((current) => current.filter((item) => item._id !== task._id));
            showToast({
              title: "Task deleted",
              description: `${task.title} was removed from the workflow.`,
              variant: "success"
            });
          } catch (err: unknown) {
            showToast({
              title: "Task delete failed",
              description: getErrorMessage(err, "Could not delete the task."),
              variant: "error"
            });
          } finally {
            setDeletingTaskId(null);
          }
        }
      },
      secondaryAction: {
        label: "Cancel",
        onClick: () => dismissToast(toastId)
      }
    });

  };

  const updateStatus = async (taskId: string, nextStatus: Task["status"]) => {
    const currentTask = tasks.find((task) => task._id === taskId);
    if (!currentTask || currentTask.status === nextStatus) return;

    const previousStatus = currentTask.status;

    setUpdating((current) => ({ ...current, [taskId]: true }));
    try {
      await api.patch(`/tasks/update-status/${taskId}`, { status: nextStatus });
      setTasks((current) =>
        current.map((task) => (task._id === taskId ? { ...task, status: nextStatus } : task))
      );
      showToast({
        title: "Task updated",
        description: `${currentTask.title} moved to ${formatStatusLabel(nextStatus)}.`,
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.patch(`/tasks/update-status/${taskId}`, { status: previousStatus });
            setTasks((current) =>
              current.map((task) => (task._id === taskId ? { ...task, status: previousStatus } : task))
            );
            showToast({
              title: "Status reverted",
              description: `${currentTask.title} is back in ${formatStatusLabel(previousStatus)}.`,
              variant: "info"
            });
          }
        }
      });
    } catch {
      showToast({
        title: "Update failed",
        description: "The task status could not be changed right now.",
        variant: "error"
      });
    } finally {
      setUpdating((current) => ({ ...current, [taskId]: false }));
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of statuses) c[s] = 0;
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1;
    c.all = tasks.length;
    return c;
  }, [tasks]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const getAssignableLabel = (member: AssignableUser) => {
    if (member._id === user?._id) {
      return `${member.name.toUpperCase()} (YOU)`;
    }

    return member.name.toUpperCase();
  };

  const searchResultLabel = searchQuery.trim()
    ? `${tasks.length} result${tasks.length === 1 ? "" : "s"} for "${searchQuery.trim()}"`
    : null;

  return (
    <DashboardLayout>

        <SearchHandler 
          setShowCreate={setShowCreate} 
          setFormData={setFormData}
        />

      <div className="mb-12 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase sm:text-4xl">Task <span className="text-emerald-500">Orchestration</span></h1>
          <p className="text-gray-500 text-sm mt-1 font-bold tracking-widest uppercase">Central Repository / Global Backlog</p>
        </motion.div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative group flex-1 xl:flex-none">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks, sub-tasks, or projects..."
              className="w-full rounded-2xl border border-white/5 bg-white/5 py-3 pl-12 pr-4 text-xs font-bold text-white outline-none transition-all placeholder:text-gray-600 focus:border-emerald-500/50 xl:w-72"
            />
          </div>
          {canCreateTasks(user?.role) && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 sm:self-auto"
            >
              <Plus size={18} />
              New Task
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {user?.role !== "client" && (
          <button
            type="button"
            onClick={() => { setMyTasksOnly((v) => !v); setMemberFilter(""); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all duration-200 ${
              myTasksOnly
                ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <User size={12} />
            My Tasks
          </button>
        )}

        {(user?.role === "admin" || user?.role === "superadmin") && (
          <select
            value={memberFilter}
            onChange={(e) => { setMemberFilter(e.target.value); setMyTasksOnly(false); }}
            className="bg-white/5 border border-white/5 rounded-2xl px-5 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest outline-none hover:bg-white/10 transition-all appearance-none cursor-pointer"
          >
            <option value="" className="bg-[#0B0F14] normal-case font-normal tracking-normal">All Members</option>
            {teamMembers.map((m) => (
              <option key={m._id} value={m._id} className="bg-[#0B0F14] normal-case font-normal tracking-normal">
                {m.name}
              </option>
            ))}
          </select>
        )}

        {(myTasksOnly || memberFilter) && (
          <button
            type="button"
            onClick={() => { setMyTasksOnly(false); setMemberFilter(""); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {searchResultLabel && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">
            {searchResultLabel}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              router.push("/tasks");
            }}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300 transition"
          >
            Clear search
          </button>
        </div>
      )}

      {!usesBoardLayout && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide"
        >
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border flex items-center gap-3 whitespace-nowrap group ${status === s
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                  : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${s === 'all' ? 'bg-emerald-400' : (statusColors[s] || 'bg-gray-400')} ${status === s ? 'animate-pulse' : ''}`} />
              {s}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-black ${status === s ? 'bg-white/20' : 'bg-black/20 group-hover:bg-black/40'} transition-colors`}>
                {counts[s] ?? 0}
              </span>
            </button>
          ))}
        </motion.div>
      )}

      {loading && (
        <SoftLoader
          title="Loading tasks"
          subtitle="Synchronizing your task board, filters, and assignments."
        />
      )}

      {error && <p className="text-sm text-red-400 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 font-bold">{error}</p>}

      {!loading && !error && usesBoardLayout && (
        <div className="grid grid-cols-1 gap-6 items-start md:grid-cols-2 2xl:grid-cols-5">
          {boardStatuses.map((columnStatus, idx) => (
            <motion.div
              key={columnStatus}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.08, ease: "easeOut" }}
              className="flex min-w-0 flex-col gap-5"
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${statusColors[columnStatus]} glow-border`} />
                  <h2 className="font-black text-sm tracking-widest text-gray-400">{formatStatusLabel(columnStatus)}</h2>
                </div>
                <span className="text-[10px] font-black bg-white/5 px-2.5 py-1 rounded-lg text-gray-500 border border-white/5">
                  {grouped[columnStatus]?.length ?? 0}
                </span>
              </div>

              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {(grouped[columnStatus] ?? []).map((task) => (
                    <motion.div
                      key={task._id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => router.push(`/tasks/${task._id}`)}
                      transition={{ duration: 0.3 }}
                      className="glass-card rounded-3xl p-5 hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer relative"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-gray-200 group-hover:text-emerald-400 transition-colors leading-snug block mb-2">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/projects/${typeof task.projectId === "object" ? task.projectId._id : "#"}`}
                              onClick={(event) => event.stopPropagation()}
                              className="text-[9px] font-black text-gray-600 hover:text-gray-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                            >
                              <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
                              {typeof task.projectId === "object" ? task.projectId.name : "Unassigned Project"}
                            </Link>
                            {task.parentTaskId && (
                              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-indigo-300">
                                Sub-task
                              </span>
                            )}
                          </div>
                          {task.parentTaskId && (
                            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-gray-600">
                              Parent: {task.parentTaskId.title}
                            </p>
                          )}
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                            <span className="text-gray-600">Created by</span>
                            <span className="text-emerald-300">{task.createdBy?.name ?? "Unknown"}</span>
                          </div>
                        </div>

                        {canManageTasks && (
                          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                            <button
                              onClick={() => openEditTask(task)}
                              className="text-gray-700 hover:text-emerald-400 transition-colors"
                              title="Edit task"
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task)}
                              disabled={deletingTaskId === task._id}
                              className="text-gray-700 hover:text-red-400 disabled:opacity-50 transition-colors"
                              title="Delete task"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {!isCardCollapsed(task._id) && (
                        <>
                          <div className="flex items-center justify-between pt-5 border-t border-white/5 bg-linear-to-t from-white/2 to-transparent -mx-5 px-5 -mb-5 rounded-b-3xl">
                            <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-400 transition-colors">
                              <Clock size={12} className="opacity-60" />
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {task.deadlineDate || task.dueDate
                                  ? new Date(task.deadlineDate || task.dueDate || "").toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                  : "No Deadline"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border tracking-tighter ${
                                task.priority === "Urgent"
                                  ? "bg-red-500/5 text-red-500 border-red-500/20"
                                  : task.priority === "High"
                                    ? "bg-amber-500/5 text-amber-500 border-amber-500/20"
                                    : "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                              }`}>
                                {task.priority || "Normal"}
                              </span>
                            </div>
                          </div>

                          {canMoveTask(task) ? (
                            <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                              {boardStatuses.map((option) => {
                                const active = option === task.status;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    disabled={!!updating[task._id] || active}
                                    onClick={() => updateStatus(task._id, option)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                                      active
                                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/10"
                                        : "border-white/8 bg-white/[0.03] text-gray-500 hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                    title={`Move to ${formatStatusLabel(option)}`}
                                  >
                                    <span className={`h-2 w-2 rounded-full ${statusColors[option]}`} />
                                    {formatStatusLabel(option)}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-4 px-3 py-2 rounded-full border border-white/5 bg-white/[0.02] text-[9px] font-black uppercase tracking-widest text-gray-600 w-fit">
                              View only
                            </div>
                          )}
                        </>
                      )}

                      <div className="mt-4 flex justify-center" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleCardCollapsed(task._id)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-gray-500 hover:border-white/15 hover:bg-white/[0.08] hover:text-white transition-all"
                          aria-label={isCardCollapsed(task._id) ? "Expand task details" : "Collapse task details"}
                        >
                          {isCardCollapsed(task._id) ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {(grouped[columnStatus] ?? []).length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="text-[10px] text-gray-600 py-10 text-center font-bold uppercase tracking-[0.2em] border border-dashed border-white/5 rounded-3xl"
                  >
                    {searchQuery.trim() ? "No Match" : "Draft Empty"}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && !error && !usesBoardLayout && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <motion.div
                key={task._id}
                variants={item}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => router.push(`/tasks/${task._id}`)}
                className="glass-card rounded-[1.8rem] p-6 hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer relative flex flex-col h-full"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-200 group-hover:text-emerald-400 transition-colors uppercase tracking-tight line-clamp-1 block">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status] || 'bg-gray-500'} glow-border`} />
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{task.status}</span>
                      </div>
                      <span className="text-gray-800 text-[10px]"> • </span>
                    <div className="flex items-center gap-1 text-[9px] font-black text-gray-600 group-hover:text-gray-400 transition-colors uppercase tracking-widest">
                        <Briefcase size={10} />
                        {typeof task.projectId === "object" ? task.projectId?.name : "Global"}
                      </div>
                    </div>
                    {task.parentTaskId && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-300">
                        <span>Sub-task</span>
                        <span className="text-indigo-200">{task.parentTaskId.title}</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-1.5 text-[9px] font-black text-emerald-400/80 uppercase tracking-widest">
                      <span className="text-gray-600">Created by</span>
                      <span className="text-gray-300">{task.createdBy?.name ?? "Unknown"}</span>
                    </div>
                  </div>
                  {canManageTasks && (
                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        onClick={() => openEditTask(task)}
                        className="text-gray-700 hover:text-emerald-400 transition-colors"
                        title="Edit task"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task)}
                        disabled={deletingTaskId === task._id}
                        className="text-gray-700 hover:text-red-400 disabled:opacity-50 transition-colors"
                        title="Delete task"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {task.description && (
                  <p className="text-[11px] text-gray-500 font-bold leading-relaxed line-clamp-2 mb-6 uppercase tracking-wider">
                    {task.description}
                  </p>
                )}

                {!isCardCollapsed(task._id) && (
                  <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 group-hover:text-emerald-400 transition-all group-hover:scale-110">
                        <User size={12} />
                      </div>
                      <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest truncate max-w-[80px]">
                        {task.assignedToUsers && task.assignedToUsers.length > 0
                          ? task.assignedToUsers.map((u) => u.name).join(", ")
                          : (task.assignedTo?.name ?? "Unassigned")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg border tracking-tighter uppercase ${task.priority === "Urgent" ? "bg-red-500/5 text-red-500 border-red-500/20" :
                          task.priority === "High" ? "bg-amber-500/5 text-amber-500 border-amber-500/20" :
                            "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                        }`}>
                        {task.priority || "Normal"}
                      </span>
                      <div className="h-3 w-px bg-white/5" />
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar size={10} />
                        <span className="text-[9px] font-black uppercase tracking-tighter">
                          {task.deadlineDate || task.dueDate
                            ? new Date(task.deadlineDate || task.dueDate || "").toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : "No Deadline"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex justify-center" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleCardCollapsed(task._id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-gray-500 hover:border-white/15 hover:bg-white/[0.08] hover:text-white transition-all"
                    aria-label={isCardCollapsed(task._id) ? "Expand task details" : "Collapse task details"}
                  >
                    {isCardCollapsed(task._id) ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] grayscale opacity-40"
            >
              <Tag size={40} className="mx-auto mb-4 text-gray-600" />
              <p className="text-sm font-black text-gray-500 uppercase tracking-[0.3em]">
                {searchQuery.trim() ? "No matching tasks or sub-tasks found" : "Zero Operational Tasks Detected"}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass relative z-10 w-full max-w-2xl overflow-y-auto rounded-[2rem] sm:rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] max-h-[min(90dvh,56rem)]"
            >
              <div className="mb-2 flex items-center justify-between p-6 pb-0 sm:p-10 sm:pb-0">
                <div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-2 block">New Operation</span>
                  <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase sm:text-3xl">Initialize <span className="text-emerald-500 font-bold">Task</span></h2>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-full transition-all group"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-8 p-6 sm:p-10">
                <div className="space-y-4">
                  <div className="relative group">
                    <input
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="TASK_DESIGNATION"
                      className="w-full bg-white/5 border border-white/5 rounded-3xl px-8 py-5 text-sm font-black text-white focus:border-emerald-500/50 transition-all outline-none uppercase tracking-widest"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                      <Tag size={16} className="text-emerald-400" />
                    </div>
                  </div>

                  <div className="relative group">
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="MISSION_SUMMARY_AND_OBJECTIVES..."
                      rows={3}
                      className="w-full bg-white/5 border border-white/5 rounded-3xl px-8 py-5 text-xs font-bold text-gray-400 focus:border-emerald-500/50 transition-all outline-none resize-none uppercase tracking-widest placeholder:opacity-30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      <Briefcase size={10} /> Strategic Area
                    </label>
                    <select
                      required
                      value={formData.projectId}
                      onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter appearance-none"
                    >
                      <option value="" className="bg-[#0B0F14]">SELECT AREA</option>
                      {projects.map(p => <option key={p._id} value={p._id} className="bg-[#0B0F14]">{p.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      <User size={10} /> Operative
                    </label>
                    <select
                      value={assigneeDraft}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAssigneeDraft(next);
                        if (!next) return;
                        setFormData((p) => ({
                          ...p,
                          assignedToIds: p.assignedToIds.includes(next)
                            ? p.assignedToIds
                            : [...p.assignedToIds, next]
                        }));
                      }}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter appearance-none"
                    >
                      <option value="" className="bg-[#0B0F14]">TAG OPERATIVES</option>
                      {team.map((u) => (
                        <option key={u._id} value={u._id} className="bg-[#0B0F14]">
                          {getAssignableLabel(u)}
                        </option>
                      ))}
                    </select>

                    {formData.assignedToIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-3">
                        {formData.assignedToIds.map((id) => {
                          const u = team.find((x) => x._id === id);
                          const label = u ? getAssignableLabel(u) : id;
                          return (
                            <button
                              type="button"
                              key={id}
                              onClick={() =>
                                setFormData((p) => ({
                                  ...p,
                                  assignedToIds: p.assignedToIds.filter((x) => x !== id)
                                }))
                              }
                              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:bg-white/10 transition flex items-center gap-2"
                              title="Remove"
                            >
                              <span>{label}</span>
                              <X size={12} className="text-gray-500" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter appearance-none"
                    >
                      <option value="Urgent" className="bg-[#0B0F14] text-red-500">Urgent</option>
                      <option value="High" className="bg-[#0B0F14] text-amber-500">High</option>
                      <option value="Normal" className="bg-[#0B0F14] text-emerald-400">Normal</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      <Calendar size={10} /> Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      <Calendar size={10} /> End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] uppercase tracking-[0.3em] font-black text-gray-500 ml-4 flex items-center gap-2">
                      <Calendar size={10} /> Deadline
                    </label>
                    <input
                      type="date"
                      value={formData.deadlineDate}
                      onChange={e => setFormData({ ...formData, deadlineDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-xs font-black text-white focus:border-emerald-500/50 outline-none transition uppercase tracking-tighter"
                    />
                  </div>
                </div>

                <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, clientVisible: !p.clientVisible }))}
                    className="flex items-center gap-3 group bg-white/5 px-5 py-3 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${formData.clientVisible ? 'bg-emerald-600 shadow-lg shadow-emerald-600/30' : 'bg-white/10'}`}>
                      {formData.clientVisible && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Sync Protocol</span>
                  </button>

                  <div className="flex gap-4 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 md:flex-none px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                    >
                      Abort
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 md:flex-none px-12 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
                    >
                      {creating ? "Launching..." : "Deploy Task"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTask(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 bg-[var(--surface)] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Edit Task</h2>
              <form onSubmit={handleUpdateTaskSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                  placeholder="Task title"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full min-h-28 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none resize-none"
                  placeholder="Task description"
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="rounded-2xl px-4 py-2 text-sm text-[var(--muted)] hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
