"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import {
  Projector,
  CheckSquare,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  ArrowRight,
  Activity,
  FolderKanban,
  Sparkles,
  MessageSquare,
  Trash2
} from "lucide-react";
import { motion, Variants } from "framer-motion";
import SoftLoader from "@/components/ui/SoftLoader";

type DashboardStats = {
  organization?: { name?: string };
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));

    api.get("/daily-updates/organization?limit=20")
      .then((res) => setUpdates(res.data.updates || []))
      .finally(() => setUpdatesLoading(false));
  }, []);

  const handleDeleteUpdate = async (id: string) => {
    await api.delete(`/daily-updates/${id}`);
    setUpdates((prev) => prev.filter((u) => u._id !== id));
  };

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const totalTasks = stats?.totalTasks ?? 0;
  const completedTasks = stats?.completedTasks ?? 0;
  const pendingTasks = stats?.pendingTasks ?? 0;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const backlogRate = totalTasks === 0 ? 0 : Math.round((pendingTasks / totalTasks) * 100);

  const statCards = stats
    ? [
        {
          title: "Projects",
          value: stats.totalProjects,
          helper: stats.totalProjects === 1 ? "1 workspace running" : `${stats.totalProjects} workspaces running`,
          badge: "Open projects",
          href: "/projects",
          accent: "emerald",
          icon: Projector,
          iconClass: "text-emerald-400",
          hoverCopy: "Jump into live projects and open the one that needs attention."
        },
        {
          title: "All Tasks",
          value: stats.totalTasks,
          helper: completionRate > 0 ? `${completionRate}% already delivered` : "No delivery progress yet",
          badge: "View task board",
          href: "/tasks",
          accent: "emerald",
          icon: CheckSquare,
          iconClass: "text-emerald-500",
          hoverCopy: "Review the full backlog, priorities, and task ownership."
        },
        {
          title: "Completed",
          value: stats.completedTasks,
          helper: totalTasks > 0 ? `${totalTasks - completedTasks} tasks still in flight` : "Nothing delivered yet",
          badge: "Track activity",
          href: "/activity",
          accent: "green",
          icon: CheckCircle2,
          iconClass: "text-green-400",
          hoverCopy: "See recent movement and confirm delivery momentum across the org."
        },
        {
          title: "Pending",
          value: stats.pendingTasks,
          helper: backlogRate > 40 ? "Backlog is building up" : "Backlog is under control",
          badge: "Review team load",
          href: "/users/team",
          accent: "amber",
          icon: Clock,
          iconClass: "text-amber-400",
          hoverCopy: "Check who can pick this up next and rebalance workload fast."
        }
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck size={20} className="text-emerald-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">Admin dashboard</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--foreground)] leading-none">Your Projects</h1>
          <p className="text-sm text-gray-500 mt-4">
            {stats?.organization?.name ? `Organization: ${stats.organization.name}` : "Organization scoped dashboard"}
          </p>
        </motion.div>
      </div>

      {loading && (
        <SoftLoader
          title="Loading admin overview"
          subtitle="Project counts, task totals, and workspace details are being prepared."
        />
      )}

      {stats && !loading && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-10"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <motion.div key={card.title} variants={item}>
                  <Link
                    href={card.href}
                    className={`glass-card block h-full p-8 rounded-[2rem] relative overflow-hidden group transition-all duration-300 ${
                      card.accent === "amber"
                        ? "hover:border-amber-500/30"
                        : "hover:border-emerald-500/30"
                    }`}
                  >
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-gray-500 text-[11px] uppercase tracking-[0.2em] font-semibold">{card.title}</p>
                          <p className={`text-5xl font-extrabold mt-3 tracking-tight ${
                            card.accent === "green"
                              ? "text-green-400"
                              : card.accent === "amber"
                                ? "text-amber-400"
                                : "text-white"
                          }`}>
                            {card.value}
                          </p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                          <Icon className={card.iconClass} size={18} />
                        </div>
                      </div>

                      <p className="mt-4 text-sm text-gray-400 min-h-[40px]">{card.helper}</p>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <div className={`flex items-center gap-2 font-semibold text-[10px] uppercase tracking-[0.18em] py-2 px-3 rounded-full w-fit ${
                          card.accent === "green"
                            ? "text-green-400 bg-green-500/5"
                            : card.accent === "amber"
                              ? "text-amber-400 bg-amber-500/5"
                              : "text-emerald-400 bg-emerald-500/5"
                        }`}>
                          <Users size={12} />
                          <span>{card.badge}</span>
                        </div>
                        <ArrowRight size={16} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-gray-500 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        {card.hoverCopy}
                      </div>
                    </div>

                    <Icon className={`absolute -bottom-4 -right-4 w-24 h-24 text-white/5 transition-all duration-500 ${
                      card.accent === "amber"
                        ? "group-hover:text-amber-500/5"
                        : card.accent === "green"
                          ? "group-hover:text-green-500/5"
                          : "group-hover:text-emerald-500/5"
                    }`} />
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <motion.div variants={item} className="glass-card p-8 md:p-10 rounded-[2.25rem] border border-white/5 overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">Team updates</p>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">Daily Updates</h2>
                <p className="text-gray-500 text-sm">Recent updates posted by your team across all projects.</p>
              </div>
            </div>

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
                  <div key={update._id} className="p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-white">{update.userId?.name}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{update.userId?.role}</span>
                          {update.projectId && (
                            <Link href={`/projects/${update.projectId._id}`} className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full hover:bg-emerald-500/20 transition-colors">
                              {update.projectId.name}
                            </Link>
                          )}
                          {update.taskId && (
                            <Link href={`/tasks/${update.taskId._id}`} className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full hover:bg-blue-500/20 transition-colors">
                              {update.taskId.title}
                            </Link>
                          )}
                          <span className="text-xs text-gray-600">{update.date}</span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{update.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteUpdate(update._id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 flex-shrink-0 mt-1"
                        title="Delete update"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8">
            <motion.div variants={item} className="glass-card p-8 md:p-10 rounded-[2.25rem] border border-white/5 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles size={16} className="text-emerald-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500">Operational focus</p>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">What needs attention now</h2>
                  <p className="text-gray-500 text-sm">A quick read on delivery pace, backlog pressure, and where to go next.</p>
                </div>
                <Activity className="text-emerald-500/20 w-12 h-12" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-white/2 border border-white/5 rounded-[1.75rem]">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-[0.18em] mb-2">Completion rate</p>
                  <p className="text-3xl font-extrabold text-white">{completionRate}%</p>
                  <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    {completionRate >= 70
                      ? "Delivery looks healthy. Keep momentum by checking activity and blockers."
                      : "Delivery is lagging. Review the task board and team workload next."}
                  </p>
                </div>

                <div className="p-6 bg-white/2 border border-white/5 rounded-[1.75rem]">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-[0.18em] mb-2">Backlog pressure</p>
                  <p className="text-3xl font-extrabold text-white">{backlogRate}%</p>
                  <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${backlogRate > 40 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${backlogRate}%` }} />
                  </div>
                  <p className="text-sm text-gray-500 mt-3">
                    {pendingTasks === 0
                      ? "Nothing is waiting to start right now."
                      : `${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"} should be triaged for ownership or priority.`}
                  </p>
                </div>

                <div className="p-6 bg-white/2 border border-white/5 rounded-[1.75rem]">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-[0.18em] mb-2">Suggested next move</p>
                  <p className="text-xl font-extrabold text-white leading-tight">
                    {pendingTasks > completedTasks ? "Rebalance the team" : "Inspect delivery flow"}
                  </p>
                  <p className="text-sm text-gray-500 mt-3">
                    {pendingTasks > completedTasks
                      ? "Pending work is outweighing delivery. Open the team view and spread the load."
                      : "Delivered work is moving. Open activity to verify recent progress and unblock anything aging."}
                  </p>
                  <Link href={pendingTasks > completedTasks ? "/users/team" : "/activity"} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                    Open recommended view
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </motion.div>

            <motion.div variants={item} className="glass-card p-8 rounded-[2.25rem] border border-white/5 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500 mb-2">Quick routes</p>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Admin actions</h2>
                </div>
                <FolderKanban className="text-emerald-500/20 w-12 h-12" />
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: "Projects workspace",
                    body: "Review live projects, create a new one, or drill into delivery details.",
                    href: "/projects"
                  },
                  {
                    title: "Task command center",
                    body: "Scan the org backlog and create or update work items quickly.",
                    href: "/tasks"
                  },
                  {
                    title: "Team directory",
                    body: "Check who is available and adjust ownership for pending work.",
                    href: "/users/team"
                  },
                  {
                    title: "Activity feed",
                    body: "Use recent events to understand movement and execution pace.",
                    href: "/activity"
                  }
                ].map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="block rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5 hover:border-emerald-500/25 hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">{action.title}</h3>
                        <p className="text-sm text-gray-500 mt-2">{action.body}</p>
                      </div>
                      <ArrowRight size={16} className="mt-1 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
