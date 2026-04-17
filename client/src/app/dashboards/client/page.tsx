"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Briefcase,
  CaretRight,
  HourglassMedium,
  TrendUp,
  Lightning,
  ArrowUpRight,
} from "@phosphor-icons/react";
import TaskChart from "@/components/charts/TaskChart";
import { motion, Variants } from "framer-motion";
import SoftLoader from "@/components/ui/SoftLoader";

type Project = {
  _id: string;
  name: string;
  description?: string;
  completedTasks?: number;
  totalTasks?: number;
};

type Task = {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectId?: { _id: string; name: string };
};

type DashboardStats = {
  organization?: { name?: string };
  totalProjects: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

function AnimatedBar({ value, max, color = "#10b981" }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  bar,
  max,
  variants,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  sub: string;
  bar?: boolean;
  max?: number;
  variants: Variants;
}) {
  return (
    <motion.div
      variants={variants}
      className="glass-card rounded-[2rem] p-7 relative overflow-hidden group hover:border-emerald-500/25 transition-all duration-300"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 80% 20%, ${color}08, transparent 60%)`,
        }}
      />
      <div className="flex items-start justify-between mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">{label}</p>
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}14`, border: `1px solid ${color}20` }}
        >
          <Icon weight="fill" size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-5xl font-extrabold tracking-tight text-white mb-1">{value}</p>
      {bar && max !== undefined && max > 0 && (
        <div className="mt-4">
          <AnimatedBar value={value} max={max} color={color} />
          <p className="text-[10px] text-gray-600 mt-2 font-semibold">
            {Math.round((value / max) * 100)}% of total
          </p>
        </div>
      )}
      <p className="mt-4 text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: `${color}99` }}>
        {sub}
      </p>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    completed: { label: "Completed", color: "#10b981", bg: "#10b98112", border: "#10b98130" },
    "in-progress": { label: "In Progress", color: "#6366f1", bg: "#6366f112", border: "#6366f130" },
    "in progress": { label: "In Progress", color: "#6366f1", bg: "#6366f112", border: "#6366f130" },
    pending: { label: "Pending", color: "#f59e0b", bg: "#f59e0b12", border: "#f59e0b30" },
    review: { label: "Review", color: "#3b82f6", bg: "#3b82f612", border: "#3b82f630" },
  };
  const s = map[status?.toLowerCase()] ?? { label: status, color: "#9ca3af", bg: "#9ca3af10", border: "#9ca3af25" };
  return (
    <span
      className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function ProjectProgressCard({ project, index }: { project: Project; index: number }) {
  const total = project.totalTasks ?? 0;
  const done = project.completedTasks ?? 0;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const hues = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6"];
  const color = hues[index % hues.length];

  return (
    <Link href={`/projects/${project._id}`}>
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ duration: 0.2 }}
        className="glass-card rounded-[1.75rem] p-6 hover:border-emerald-500/30 transition-all duration-300 group cursor-pointer"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-sm font-bold text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors">
              {project.name}
            </p>
            <p className="text-xs text-gray-600 mt-1 truncate">{project.description || "Active development phase"}</p>
          </div>
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
            style={{ background: `${color}14`, border: `1px solid ${color}25` }}
          >
            <ArrowUpRight weight="bold" size={16} style={{ color }} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Progress</span>
          <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 + index * 0.1 }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
        {total > 0 && (
          <p className="text-[10px] text-gray-600 mt-2">{done} of {total} tasks done</p>
        )}
      </motion.div>
    </Link>
  );
}

export default function ClientDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [statsRes, projectsRes, tasksRes] = await Promise.all([
          api.get("/dashboard"),
          api.get("/projects/org-projects"),
          api.get("/tasks/client-view"),
        ]);
        setStats(statsRes.data);
        setProjects(projectsRes.data.projects ?? []);
        setTasks(tasksRes.data.tasks ?? []);
      } catch (err) {
        console.error("Failed to load client dashboard", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <DashboardLayout>
        <SoftLoader title="Loading your dashboard" subtitle="Projects, tasks, and progress are being prepared for you." />
      </DashboardLayout>
    );

  if (!stats)
    return (
      <DashboardLayout>
        <div className="text-red-400 py-20 text-center font-bold">Failed to load organization statistics.</div>
      </DashboardLayout>
    );

  const compTasks = stats.completedTasks || 0;
  const inProgTasks = stats.inProgressTasks || 0;
  const pendTasks = stats.pendingTasks || 0;
  const totalTasks = compTasks + inProgTasks + pendTasks;
  const overallPct = totalTasks === 0 ? 0 : Math.round((compTasks / totalTasks) * 100);

  const reviewTasks = tasks.filter(t => t.status.toLowerCase() === "review");
  const recentTasks = tasks.slice(0, 8);

  return (
    <DashboardLayout>
      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-500 mb-3">
            {stats?.organization?.name ?? "Your Workspace"}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Project Overview
          </h1>
          <p className="text-[var(--muted)] text-sm mt-3 max-w-xl">
            Your projects, tasks, and team progress at a glance.
          </p>
        </div>

        {/* Overall progress ring */}
        <div className="glass-card rounded-[2rem] px-8 py-6 flex items-center gap-6 flex-shrink-0">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 56 56" className="rotate-[-90deg] w-16 h-16">
              <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <motion.circle
                cx="28" cy="28" r="22"
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - overallPct / 100) }}
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-extrabold text-white">{overallPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-semibold">Overall</p>
            <p className="text-base font-bold text-white mt-0.5">Completion</p>
            <p className="text-xs text-gray-600 mt-1">{stats.completedTasks} / {totalTasks} tasks done</p>
          </div>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10"
      >
        <StatCard label="Projects" value={stats.totalProjects || 0} icon={Briefcase} color="#10b981" sub="In pipeline" variants={item} />
        <StatCard
          label="Completed" value={compTasks} icon={CheckCircle} color="#10b981"
          sub="Delivered" bar max={totalTasks} variants={item}
        />
        <StatCard
          label="In Progress" value={inProgTasks} icon={Lightning} color="#6366f1"
          sub="Active now" bar max={totalTasks} variants={item}
        />
        <StatCard
          label="Pending" value={pendTasks} icon={HourglassMedium} color="#f59e0b"
          sub="Awaiting start" bar max={totalTasks} variants={item}
        />
      </motion.div>

      {/* ── Needs Review Section ── */}
      {reviewTasks.length > 0 && (
        <motion.div
          variants={item} initial="hidden" animate="show"
          className="mb-10 glass-card rounded-[2rem] p-8 border border-purple-500/20"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.05), transparent)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-purple-500 mb-1">Attention Required</p>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Awaiting Your Review</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reviewTasks.map(task => (
              <Link key={task._id} href={`/tasks/${task._id}`}>
                <div className="flex items-start justify-between p-5 rounded-2xl bg-white/5 border border-purple-500/20 hover:border-purple-500/50 hover:bg-white/10 transition-all cursor-pointer group">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-bold text-white tracking-tight group-hover:text-purple-400 transition-colors truncate">{task.title}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{task.projectId?.name || "General"}</p>
                  </div>
                  <button className="shrink-0 text-[9px] uppercase tracking-widest font-black bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-purple-500/20">
                    Review / Ask
                  </button>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Middle row: Chart + Tasks feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Task Distribution Donut */}
        <motion.div
          variants={item} initial="hidden" animate="show"
          className="glass-card rounded-[2rem] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-1">Analytics</p>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-6">Task Distribution</h2>

          {/* Mini stat row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Done", value: compTasks, color: "#10b981" },
              { label: "Active", value: inProgTasks, color: "#6366f1" },
              { label: "Pending", value: pendTasks, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-2xl p-3 text-center">
                <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-widest text-gray-600 font-semibold mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <TaskChart data={stats} />
        </motion.div>

        {/* Recent Tasks Feed */}
        <motion.div
          variants={item} initial="hidden" animate="show"
          className="glass-card rounded-[2rem] p-8 flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-1">Activity</p>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Recent Tasks</h2>
            </div>
            <Link href="/tasks" className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold hover:text-emerald-300 transition-colors flex items-center gap-1">
              View all <CaretRight weight="bold" size={10} />
            </Link>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {recentTasks.length === 0 && (
              <div className="flex items-center justify-center h-32 text-xs text-gray-600 uppercase tracking-widest font-bold border border-dashed border-white/5 rounded-2xl">
                No tasks yet
              </div>
            )}
            {recentTasks.map((task, i) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <Link href={`/tasks/${task._id}`}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-all duration-200 group cursor-pointer">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/10 transition-colors">
                      {task.status?.toLowerCase() === "completed"
                        ? <CheckCircle weight="fill" size={16} className="text-emerald-500" />
                        : task.status?.toLowerCase().includes("progress")
                          ? <Clock weight="fill" size={16} className="text-indigo-400" />
                          : <HourglassMedium weight="fill" size={16} className="text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">{task.title}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5 truncate">{task.projectId?.name || "General"}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Projects with Progress Bars ── */}
      <motion.div
        variants={item} initial="hidden" animate="show"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500 mb-1">Portfolio</p>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Your Projects</h2>
          </div>
          <Link href="/projects" className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold hover:text-emerald-300 transition-colors flex items-center gap-1">
            All projects <CaretRight weight="bold" size={10} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="glass-card rounded-[2rem] p-12 text-center">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-bold italic">No projects in pipeline.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <ProjectProgressCard key={project._id} project={project} index={i} />
            ))}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
