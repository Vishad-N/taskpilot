"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { Users, Mail, Shield, UserPlus, Search, Trash2, X, CheckSquare, Clock, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Pagination from "@/components/ui/Pagination";
import { usePaginationLimit } from "@/hooks/usePaginationLimit";

type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  gender?: "male" | "female" | "not_specified";
};

type Task = {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  deadlineDate?: string;
  dueDate?: string;
  projectId?: { _id: string; name: string } | string;
  assignedTo?: { _id: string; name?: string } | string | null;
  assignedToUsers?: Array<{ _id: string; name?: string } | string>;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  inprogress: "bg-blue-500",
  review: "bg-purple-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
};

const formatStatusLabel = (s: string) => {
  if (s === "inprogress") return "In Progress";
  if (s === "blocked") return "Rejected";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" && error !== null &&
    "response" in error &&
    typeof error.response === "object" && error.response !== null &&
    "data" in error.response &&
    typeof (error as { response: { data?: { message?: string } } }).response.data?.message === "string"
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return fallback;
};

export default function TeamManagementPage() {
  const router = useRouter();
  const { showToast, dismissToast } = useToast();
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  const [page, setPage] = useState(1);
  const limit = usePaginationLimit();
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchTeam = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/users/team?page=${currentPage}&limit=${limit}`);
      const members: TeamMember[] = res.data.users ?? [];
      setUsers(members);
      setTotalPages(res.data.totalPages ?? 1);
      setTotalRecords(res.data.totalRecords ?? 0);
      // Fetch task counts for all members in parallel
      const counts = await Promise.all(
        members.map((m) =>
          api.get(`/tasks/by-member/${m._id}`)
            .then((r) => ({ id: m._id, count: (r.data.tasks ?? []).length }))
            .catch(() => ({ id: m._id, count: 0 }))
        )
      );
      const countMap: Record<string, number> = {};
      for (const { id, count } of counts) countMap[id] = count;
      setTaskCounts(countMap);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch team members"));
    } finally {
      setLoading(false);
    }
  };

  const openMemberTasks = async (member: TeamMember) => {
    setSelectedMember(member);
    setTasksLoading(true);
    setMemberTasks([]);
    try {
      const res = await api.get(`/tasks/by-member/${member._id}`);
      setMemberTasks(res.data.tasks ?? []);
    } catch {
      setMemberTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam(page);
  }, [page, limit]);

  useEffect(() => {
    const handleTaskCreated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const newTask = customEvent.detail;
      
      const assignedIds = [
        ...(newTask.assignedTo && typeof newTask.assignedTo === 'object' ? [newTask.assignedTo._id] : []),
        ...(typeof newTask.assignedTo === 'string' ? [newTask.assignedTo] : []),
        ...(newTask.assignedToUsers ? newTask.assignedToUsers.map(u => typeof u === 'object' ? u._id : u) : [])
      ];

      setTaskCounts(prev => {
        const next = { ...prev };
        assignedIds.forEach(id => {
          if (next[id] !== undefined) next[id] += 1;
        });
        return next;
      });

      if (selectedMember && assignedIds.includes(selectedMember._id)) {
        setMemberTasks(current => {
          if (current.some(t => t._id === newTask._id)) return current;
          return [newTask, ...current];
        });
      }
    };

    const handleTaskUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<Task>;
      const updatedTask = customEvent.detail;
      
      const assignedIds = [
        ...(updatedTask.assignedTo && typeof updatedTask.assignedTo === 'object' ? [updatedTask.assignedTo._id] : []),
        ...(typeof updatedTask.assignedTo === 'string' ? [updatedTask.assignedTo] : []),
        ...(updatedTask.assignedToUsers ? updatedTask.assignedToUsers.map(u => typeof u === 'object' ? u._id : u) : [])
      ];

      setMemberTasks((current) => {
        const exists = current.some((t) => t._id === updatedTask._id);
        if (exists) {
           if (selectedMember && !assignedIds.includes(selectedMember._id)) {
             return current.filter(t => t._id !== updatedTask._id);
           }
           return current.map(t => t._id === updatedTask._id ? { ...t, ...updatedTask } : t);
        } else if (selectedMember && assignedIds.includes(selectedMember._id)) {
           return [updatedTask, ...current];
        }
        return current;
      });
    };

    const handleTaskDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ _id: string }>;
      const { _id } = customEvent.detail;
      setMemberTasks(current => current.filter((task) => task._id !== _id));
    };

    window.addEventListener("taskpilot:task_created", handleTaskCreated);
    window.addEventListener("taskpilot:task_updated", handleTaskUpdated);
    window.addEventListener("taskpilot:task_deleted", handleTaskDeleted);

    return () => {
      window.removeEventListener("taskpilot:task_created", handleTaskCreated);
      window.removeEventListener("taskpilot:task_updated", handleTaskUpdated);
      window.removeEventListener("taskpilot:task_deleted", handleTaskDeleted);
    };
  }, [selectedMember]);

  const deleteUser = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const member = users.find((u) => u._id === userId);
    const toastId = showToast({
      title: `Delete ${member?.name ?? "this team member"}?`,
      description: "Their task assignments will be cleared.",
      variant: "error",
      durationMs: 9000,
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingUserId(userId);
          try {
            await api.delete(`/users/${userId}`);
            setUsers((prev) => prev.filter((u) => u._id !== userId));
            if (selectedMember?._id === userId) setSelectedMember(null);
            showToast({ title: "Team member deleted", description: `${member?.name ?? "The user"} was removed.`, variant: "success" });
          } catch (err: unknown) {
            const message = getErrorMessage(err, "Failed to delete team member");
            setError(message);
            showToast({ title: "Delete failed", description: message, variant: "error" });
          } finally {
            setDeletingUserId(null);
          }
        }
      },
      secondaryAction: { label: "Cancel", onClick: () => dismissToast(toastId) }
    });
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = (id: string) => memberTasks.filter((t) => t._id && selectedMember?._id === id && t.status !== "completed").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tight">Team Management</h1>
          <p className="text-gray-400 text-sm mt-1">Click a member to see their assigned tasks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#11161D] border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition"
            onClick={() => alert("Invite feature coming soon!")}
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Synchronizing team records...</div>}
      {error && <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((member) => (
            <motion.div
              key={member._id}
              whileHover={{ scale: 1.01 }}
              onClick={() => openMemberTasks(member)}
              className={`group bg-[#11161D] border rounded-3xl p-6 cursor-pointer transition shadow-sm ${
                selectedMember?._id === member._id
                  ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                  : "border-white/5 hover:border-emerald-600/30"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-emerald-600/10 rounded-2xl group-hover:bg-emerald-600/20 transition">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-green-500/20">
                    {member.status}
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">{member.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-gray-400">
                <Mail className="w-3.5 h-3.5" />
                <span className="text-xs">{member.email}</span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs text-gray-500 font-bold">
                  {taskCounts[member._id] ?? "—"} task{taskCounts[member._id] !== 1 ? "s" : ""} assigned
                </span>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-500">{member.role}</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gray-600 ml-2">
                    • {member.gender === "not_specified" ? "-" : member.gender}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    View tasks <ArrowRight size={10} />
                  </span>
                  <button
                    onClick={(e) => deleteUser(member._id, e)}
                    disabled={deletingUserId === member._id}
                    className="w-9 h-9 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center disabled:opacity-50"
                    title="Delete team member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="lg:col-span-3 text-center py-20 bg-[#11161D] rounded-3xl border border-dashed border-gray-800">
              <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No organization members found.</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className="mt-8">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalRecords={totalRecords}
            limit={limit}
          />
        </div>
      )}

      {/* Member Tasks Drawer */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0B0F14] border-l border-white/5 z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600/10 rounded-xl">
                    <Users className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Assigned Tasks</p>
                    <h2 className="text-lg font-bold text-white">{selectedMember.name}</h2>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                {["pending", "inprogress", "completed"].map((s) => {
                  const count = memberTasks.filter((t) => t.status === s).length;
                  return (
                    <div key={s} className="flex-1 text-center py-2 bg-white/[0.03] border border-white/5 rounded-xl">
                      <p className={`text-xl font-black ${s === "completed" ? "text-emerald-400" : s === "inprogress" ? "text-blue-400" : "text-amber-400"}`}>{count}</p>
                      <p className="text-[8px] uppercase tracking-widest text-gray-600 font-bold mt-0.5">{formatStatusLabel(s)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {tasksLoading && (
                  <p className="text-sm text-gray-500 text-center pt-10">Loading tasks...</p>
                )}

                {!tasksLoading && memberTasks.length === 0 && (
                  <div className="text-center pt-16">
                    <CheckSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No tasks assigned to {selectedMember.name}.</p>
                  </div>
                )}

                {!tasksLoading && memberTasks.map((task) => (
                  <motion.div
                    key={task._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => router.push(`/tasks/${task._id}`)}
                    className="bg-[#11161D] border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 cursor-pointer group transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition leading-snug flex-1">
                        {task.title}
                      </p>
                      <ArrowRight size={14} className="text-gray-700 group-hover:text-emerald-400 transition shrink-0 mt-0.5" />
                    </div>

                    {typeof task.projectId === "object" && task.projectId && (
                      <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold mb-2">
                        {task.projectId.name}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status] ?? "bg-gray-500"}`} />
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                          {formatStatusLabel(task.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {(task.deadlineDate || task.dueDate) && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock size={10} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">
                              {new Date(task.deadlineDate || task.dueDate || "").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        )}
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border tracking-tighter ${
                          task.priority === "Urgent" ? "bg-red-500/5 text-red-500 border-red-500/20"
                          : task.priority === "High" ? "bg-amber-500/5 text-amber-500 border-amber-500/20"
                          : "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {task.priority || "Normal"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              {!tasksLoading && memberTasks.length > 0 && (
                <div className="p-4 border-t border-white/5">
                  <button
                    onClick={() => router.push(`/tasks?member=${selectedMember._id}`)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition shadow-lg shadow-emerald-600/20"
                  >
                    View in Task Board
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
