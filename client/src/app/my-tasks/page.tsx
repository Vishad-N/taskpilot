"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import { CheckSquare, Clock, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SoftLoader from "@/components/ui/SoftLoader";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  deadlineDate?: string;
  projectId?: { _id: string; name: string } | string;
  assignedToUsers?: Array<{ _id: string; name: string }>;
  createdBy?: { _id: string; name: string } | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
};

const boardStatuses = ["pending", "inprogress", "review", "completed", "blocked"] as const;

const formatStatusLabel = (s: string) =>
  s === "inprogress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1);

const getErrorMessage = (error: unknown) => {
  if (
    typeof error === "object" && error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return "Failed to load your tasks";
};

export default function MyTasksPage() {
  const router = useRouter();
  const { user } = useMe();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/tasks/my-tasks");
      setTasks(res.data.tasks ?? []);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const newTask = customEvent.detail;
      
      const isAssigned = 
        (newTask.assignedTo && typeof newTask.assignedTo === 'object' && newTask.assignedTo._id === user?._id) ||
        (typeof newTask.assignedTo === 'string' && newTask.assignedTo === user?._id) ||
        (newTask.assignedToUsers && newTask.assignedToUsers.some(u => typeof u === 'object' ? u._id === user?._id : u === user?._id));

      if (!isAssigned) return;

      setTasks((current) => {
        if (current.some((t) => t._id === newTask._id)) return current;
        return [newTask, ...current];
      });
    };

    const handleTaskUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const updatedTask = customEvent.detail;
      
      const isAssigned = 
        (updatedTask.assignedTo && typeof updatedTask.assignedTo === 'object' && updatedTask.assignedTo._id === user?._id) ||
        (typeof updatedTask.assignedTo === 'string' && updatedTask.assignedTo === user?._id) ||
        (updatedTask.assignedToUsers && updatedTask.assignedToUsers.some(u => typeof u === 'object' ? u._id === user?._id : u === user?._id));

      setTasks((current) => {
        const exists = current.some(t => t._id === updatedTask._id);
        if (exists) {
          if (!isAssigned) return current.filter(t => t._id !== updatedTask._id);
          return current.map(t => t._id === updatedTask._id ? { ...t, ...updatedTask } : t);
        } else if (isAssigned) {
          return [updatedTask, ...current];
        }
        return current;
      });
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
  }, [user?._id]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of boardStatuses) map[s] = [];
    for (const t of tasks) (map[t.status] ??= []).push(t);
    return map;
  }, [tasks]);

  const updateStatus = async (taskId: string, nextStatus: string) => {
    const current = tasks.find((t) => t._id === taskId);
    if (!current || current.status === nextStatus) return;
    setUpdating((p) => ({ ...p, [taskId]: true }));
    try {
      await api.patch(`/tasks/update-status/${taskId}`, { status: nextStatus });
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: nextStatus } : t));
    } finally {
      setUpdating((p) => ({ ...p, [taskId]: false }));
    }
  };

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.24em] mb-1">My Workspace</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">My Tasks</h1>
          <p className="mt-2 text-sm text-gray-500">Tasks assigned specifically to you.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="text-center px-5 py-3 bg-white/5 border border-white/5 rounded-2xl">
            <p className="text-2xl font-black text-white">{totalCount}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">Total</p>
          </div>
          <div className="text-center px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <p className="text-2xl font-black text-emerald-400">{completedCount}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">Done</p>
          </div>
        </motion.div>
      </div>

      {loading && (
        <SoftLoader title="Loading your tasks" subtitle="Fetching tasks assigned to you." />
      )}
      {error && (
        <p className="text-sm text-red-400 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 font-bold">{error}</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 items-start">
          {boardStatuses.map((col, idx) => (
            <motion.div
              key={col}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.07 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[col]}`} />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
                    {formatStatusLabel(col)}
                  </h2>
                </div>
                <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-lg text-gray-500 border border-white/5">
                  {grouped[col]?.length ?? 0}
                </span>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {(grouped[col] ?? []).map((task) => (
                    <motion.div
                      key={task._id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#11161D] border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 transition-all group"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => router.push(`/tasks/${task._id}`)}
                      >
                        <p className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition-colors leading-snug mb-2">
                          {task.title}
                        </p>

                        {typeof task.projectId === "object" && task.projectId && (
                          <Link
                            href={`/projects/${task.projectId._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9px] font-black text-gray-600 hover:text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 w-fit"
                          >
                            <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
                            {task.projectId.name}
                          </Link>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Clock size={10} />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {task.deadlineDate || task.dueDate
                                ? new Date(task.deadlineDate || task.dueDate || "").toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                : "No deadline"}
                            </span>
                          </div>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border tracking-tighter ${
                            task.priority === "Urgent" ? "bg-red-500/5 text-red-500 border-red-500/20"
                            : task.priority === "High" ? "bg-amber-500/5 text-amber-500 border-amber-500/20"
                            : "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                          }`}>
                            {task.priority || "Normal"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-1.5">
                        {boardStatuses.map((opt) => (
                          <button
                            key={opt}
                            disabled={!!updating[task._id] || opt === task.status}
                            onClick={() => updateStatus(task._id, opt)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${
                              opt === task.status
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                : "border-white/8 bg-white/[0.03] text-gray-500 hover:border-white/15 hover:text-white"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusColors[opt]}`} />
                            {formatStatusLabel(opt)}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {(grouped[col] ?? []).length === 0 && (
                  <div className="text-[10px] text-gray-700 py-8 text-center font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-2xl">
                    Empty
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="mt-12 text-center py-20 bg-[#11161D] rounded-3xl border border-dashed border-gray-800">
          <CheckSquare className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No tasks assigned to you yet.</p>
          <button
            onClick={() => router.push("/tasks")}
            className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition"
          >
            Browse all tasks <ArrowRight size={14} />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
