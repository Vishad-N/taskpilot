"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Plus, 
  MessageSquare, 
  Layout, 
  Settings, 
  ShieldCheck,
  Target,
  Pencil,
  Trash2
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/ToastProvider";
import SoftLoader from "@/components/ui/SoftLoader";

type Project = {
  _id: string;
  name: string;
  description?: string;
  organizationId: string;
};

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignedTo?: { _id: string; name: string };
  createdBy?: { _id: string; name: string } | null;
};

const canCreateTasks = (role?: string) => role === "admin" || role === "superadmin" || role === "team";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null
  ) {
    if ("message" in error.response.data && typeof error.response.data.message === "string") {
      return error.response.data.message;
    }

    if ("error" in error.response.data && typeof error.response.data.error === "string") {
      return error.response.data.error;
    }
  }

  return fallback;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500"
};

export default function ProjectWorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useMe();
  const { showToast, dismissToast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [projRes, tasksRes] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get(`/tasks/project/${id}`)
        ]);
        setProject(projRes.data.project);
        setTasks(tasksRes.data.tasks ?? []);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load project workspace"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canCreateTask = canCreateTasks(user?.role);
  const canManageTasks = user?.role === "admin" || user?.role === "superadmin";

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
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
      description: "This task will be removed from this project.",
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
              description: `${task.title} was removed from this project.`,
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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <DashboardLayout>
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <motion.button 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => router.push("/projects")}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-indigo-600 transition-all group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </motion.button>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
               <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Strategic Workspace</span>
               <span className="text-gray-800 text-xs">•</span>
               <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Node_{(typeof id === "string" ? id : id?.[0] || "")?.slice(-4).toUpperCase()}</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black italic tracking-tighter text-white uppercase leading-none">{project?.name ?? "WORKSPACE_LOAD"}</h1>
          </motion.div>
        </div>

        <div className="flex items-center gap-3">
          {canCreateTask && (
            <button 
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl flex items-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 font-black text-xs uppercase tracking-widest"
              onClick={() => router.push(`/tasks?projectId=${id}&create=true`)}
            >
              <Plus size={18} />
              Deploy Vector
            </button>
          )}
          <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-all">
             <Settings size={20} />
          </button>
        </div>
      </div>

      {loading && (
        <SoftLoader
          title="Loading project workspace"
          subtitle="Initializing project details, tasks, and workspace intelligence."
        />
      )}
      
      {error && <div className="text-red-400 p-8 bg-red-500/10 rounded-3xl border border-red-500/20 text-center font-black uppercase tracking-widest">{error}</div>}

      {!loading && !error && (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-3 gap-10"
        >
          {/* Tasks Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                <Layout size={16} className="text-indigo-500" />
                Active Operations
              </h2>
              <div className="flex items-center gap-2">
                 <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">{tasks.length} Vectors</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tasks.map((task) => (
                <motion.div 
                  variants={item}
                  key={task._id}
                  onClick={() => router.push(`/tasks/${task._id}`)}
                  className="glass-card p-6 rounded-4xl hover:border-indigo-500/30 transition-all duration-300 group cursor-pointer relative flex flex-col h-full overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${statusColors[task.status] || 'bg-gray-500'} glow-border`} />
                       <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{task.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-white/5 text-indigo-400 border border-white/5 uppercase tracking-tighter">{task.priority || "P2"}</span>
                      {canManageTasks && (
                        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                          <button
                            onClick={() => openEditTask(task)}
                            className="rounded-lg p-1.5 text-gray-500 hover:text-indigo-400 transition"
                            title="Edit task"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task)}
                            disabled={deletingTaskId === task._id}
                            className="rounded-lg p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-50 transition"
                            title="Delete task"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-white italic tracking-tighter uppercase mb-2 group-hover:text-indigo-400 transition-colors leading-tight relative z-10">{task.title}</h3>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed line-clamp-2 mb-8 relative z-10">{task.description || "NO_DESCRIPTION_SIGNAL_FOUND"}</p>
                  <div className="mb-6 relative z-10">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                      <span className="text-gray-600">Created by</span>
                      <span className="text-indigo-300">{task.createdBy?.name ?? "Unknown"}</span>
                    </span>
                  </div>
                  
                  <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                          <MessageSquare size={12} className="text-indigo-400 group-hover:text-white" />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Discussion</span>
                          <span className="text-[10px] font-black text-white">Active Feed</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{task.assignedTo?.name || "FIELD_UNASSIGNED"}</span>
                       <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-white uppercase transition-colors">
                        {task.assignedTo?.name?.charAt(0) || "?"}
                       </div>
                    </div>
                  </div>

                  {/* Decorative background icon */}
                  <ShieldCheck size={80} className="absolute -bottom-8 -right-8 opacity-0 group-hover:opacity-5 transition-opacity grayscale text-white" />
                </motion.div>
              ))}
            </div>

            {tasks.length === 0 && (
              <motion.div 
                variants={item}
                className="glass-card border-dashed border-white/10 p-20 rounded-[3rem] text-center grayscale opacity-40"
              >
                <Target size={48} className="mx-auto mb-6 text-gray-600" />
                <p className="text-sm font-black text-gray-500 uppercase tracking-[0.4em] mb-6">Zero Operational Vectors Detected</p>
                {canCreateTask && (
                   <button 
                    className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black text-indigo-400 uppercase tracking-widest transition-all"
                    onClick={() => router.push(`/tasks?projectId=${id}&create=true`)}
                   >
                    Initialize First Vector
                   </button>
                )}
              </motion.div>
            )}
          </div>

        </motion.div>
      )}

      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setEditingTask(null)}
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
