"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import Link from "next/link";
import { Clock, Filter, MoreHorizontal, MessageSquare, Trash2 } from "lucide-react";
import { useMe } from "@/hooks/useMe";
import { motion, AnimatePresence } from "framer-motion";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: "pending" | "inprogress" | "review" | "completed" | "blocked";
  projectId?: { _id: string; name: string } | string;
  dueDate?: string;
  priority?: "Urgent" | "High" | "Normal";
  createdBy?: { _id: string; name: string } | null;
  assignedTo?: { _id: string; name: string } | null;
  assignedToUsers?: Array<{ _id: string; name: string }>;
};

type DailyUpdate = {
  _id: string;
  content: string;
  date: string;
  createdAt: string;
  userId: { _id: string; name: string; email: string; role: string };
  projectId: { _id: string; name: string } | null;
  taskId: { _id: string; title: string } | null;
};

const statusOptions: Task["status"][] = [
  "pending",
  "inprogress",
  "review",
  "completed",
  "blocked"
];

const statusColors: Record<Task["status"], string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500"
};

const formatStatusLabel = (status: Task["status"]) => {
  if (status === "inprogress") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function TeamDashboard() {
  const router = useRouter();
  const { user } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [organizationName, setOrganizationName] = useState<string>("");
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const { showToast } = useToast();

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of statusOptions) map[s] = [];
    for (const t of tasks) (map[t.status] ??= []).push(t);
    return map;
  }, [tasks]);

  const canMoveTask = (task: Task) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "superadmin") return true;
    const assignedIds = [
      ...(task.assignedTo ? [task.assignedTo._id] : []),
      ...((task.assignedToUsers ?? []).map((u) => u._id))
    ];
    return assignedIds.includes(user._id);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, statsRes] = await Promise.all([
        api.get("/tasks/org-tasks"),
        api.get("/dashboard")
      ]);
      setTasks(tasksRes.data.tasks ?? []);
      setOrganizationName(statsRes.data.organization?.name ?? "");
    } catch (e: unknown) {
      const message =
        typeof e === "object" &&
        e !== null &&
        "response" in e &&
        typeof (e as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Failed to load tasks";
      setError(message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (taskId: string, status: Task["status"]) => {
    const currentTask = tasks.find((task) => task._id === taskId);

    if (!currentTask || currentTask.status === status) {
      return;
    }

    const previousStatus = currentTask.status;

    setUpdating((p) => ({ ...p, [taskId]: true }));
    try {
      await api.patch(`/tasks/update-status/${taskId}`, { status });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status } : t))
      );
      showToast({
        title: "Task updated",
        description: `${currentTask.title} moved to ${status}.`,
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.patch(`/tasks/update-status/${taskId}`, { status: previousStatus });
            setTasks((prev) =>
              prev.map((t) => (t._id === taskId ? { ...t, status: previousStatus } : t))
            );
            showToast({
              title: "Status reverted",
              description: `${currentTask.title} is back in ${previousStatus}.`,
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
      setUpdating((p) => ({ ...p, [taskId]: false }));
    }
  };

  useEffect(() => {
    load();
    api.get("/daily-updates/organization?limit=20")
      .then((res) => setUpdates(res.data.updates || []))
      .finally(() => setUpdatesLoading(false));
  }, []);

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

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="mt-1 text-[11px] text-gray-500 font-semibold uppercase tracking-[0.24em]">My workspace</p>
          <h1 className="mt-3 text-5xl md:text-6xl font-extrabold tracking-tight text-white">All tasks in one smooth view</h1>
          <p className="mt-3 text-sm text-gray-500">Track assigned work, update status, and keep progress moving.</p>
          {organizationName && (
            <p className="mt-3 text-xs text-emerald-400 uppercase tracking-[0.2em]">{organizationName}</p>
          )}
        </motion.div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold text-gray-400 hover:text-white transition-all group">
            <Filter size={14} className="group-hover:text-emerald-400 transition-colors" />
            Filter View
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20">
            Export Report
          </button>
        </div>
      </div>

      <div>
        {loading && (
          <SoftLoader
            title="Loading your tasks"
            subtitle="Your current assignments and status columns are being synced."
          />
        )}

        {error && <p className="text-sm text-red-400 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 font-bold">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-start">
            {statusOptions.map((status, idx) => (
              <motion.div
                key={status}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: "easeOut" }}
                className="flex flex-col gap-5 min-w-[240px]"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${statusColors[status]} glow-border`} />
                    <h2 className="font-black text-sm tracking-widest text-gray-400">{formatStatusLabel(status)}</h2>
                  </div>
                  <span className="text-[10px] font-black bg-white/5 px-2.5 py-1 rounded-lg text-gray-500 border border-white/5">
                    {grouped[status]?.length ?? 0}
                  </span>
                </div>

                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {(grouped[status] ?? []).map((task) => (
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
                            </div>
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                              <span className="text-gray-600">Created by</span>
                              <span className="text-emerald-300">{task.createdBy?.name ?? "Unknown"}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            className="text-gray-600 hover:text-white transition-colors"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-5 border-t border-white/5 bg-linear-to-t from-white/2 to-transparent -mx-5 px-5 -mb-5 rounded-b-3xl">
                          <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-400 transition-colors">
                            <Clock size={12} className="opacity-60" />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No Limit"}
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
                            {statusOptions.map((option) => {
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
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {(grouped[status] ?? []).length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      className="text-[10px] text-gray-600 py-10 text-center font-bold uppercase tracking-[0.2em] border border-dashed border-white/5 rounded-3xl"
                    >
                      Draft Empty
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-12 glass-card p-8 md:p-10 rounded-[2.25rem] border border-white/5 overflow-hidden"
      >
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare size={16} className="text-emerald-400" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">Team updates</p>
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">Daily Updates</h2>
        <p className="text-gray-500 text-sm mb-8">Recent updates posted by your team across all projects.</p>

        {updatesLoading ? (
          <p className="text-sm text-gray-500">Loading updates...</p>
        ) : updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">No updates posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {updates.map((update) => (
              <div key={update._id} className="p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem]">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-white">{update.userId?.name}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{update.userId?.role}</span>
                  {update.projectId && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {update.projectId.name}
                    </span>
                  )}
                  {update.taskId && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      {update.taskId.title}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">{update.date}</span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{update.content}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
