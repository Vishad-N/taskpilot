"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import api from "@/services/api";
import { motion } from "framer-motion";
import {
  SquaresFour,
  Briefcase,
  CheckSquare,
  Users,
  Bell,
  Pulse,
  SignOut,
  ClockCountdown,
  Stop,
  ArrowSquareOut,
  IdentificationCard,
} from "@phosphor-icons/react";

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

type NotificationRecord = {
  isRead?: boolean;
  message?: string;
};

type ActiveWorkSession = {
  _id: string;
  taskId: string;
  taskTitle: string;
  projectId?: string;
  projectName?: string;
  startedAt: string;
};

const formatElapsed = (startedAt: string, nowTimestamp: number) => {
  const elapsedMs = nowTimestamp - new Date(startedAt).getTime();
  const minutes = Math.max(1, Math.round(elapsedMs / (60 * 1000)));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useMe();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAttendanceRequests, setPendingAttendanceRequests] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveWorkSession | null>(
    null,
  );
  const [sessionTick, setSessionTick] = useState(() => Date.now());
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    const fetchNotifications = () => {
      if (user) {
        api
          .get("/notifications")
          .then((res) => {
            const notifications = (res.data.notifications ?? []) as NotificationRecord[];
            const count = notifications.filter(
              (notification) =>
                !notification.isRead &&
                !notification.message?.includes("moved to pending") &&
                !notification.message?.includes("moved to inprogress")
            ).length;
            setUnreadCount(count);
          })
          .catch(() => {});

        if (user.role === "admin" || user.role === "superadmin") {
          api
            .get("/attendance/analytics")
            .then((res) => {
              setPendingAttendanceRequests(res.data.pendingRequests || 0);
            })
            .catch(() => {});
        }
      }
    };

    fetchNotifications();

    const handleNewNotification = () => {
      fetchNotifications();
    };

    window.addEventListener("taskpilot:new_notification", handleNewNotification);

    return () => {
      window.removeEventListener("taskpilot:new_notification", handleNewNotification);
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "client") {
      setActiveSession(null);
      return;
    }

    let cancelled = false;

    const loadActiveSession = async () => {
      try {
        const res = await api.get("/tasks/work/current");
        if (!cancelled) {
          setActiveSession(
            (res.data.session ?? null) as ActiveWorkSession | null,
          );
          setSessionTick(Date.now());
        }
      } catch {
        if (!cancelled) {
          setActiveSession(null);
        }
      }
    };

    void loadActiveSession();

    const handleUpdate = () => {
      void loadActiveSession();
    };

    window.addEventListener("taskpilot:work-session-updated", handleUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(
        "taskpilot:work-session-updated",
        handleUpdate,
      );
    };
  }, [user]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSessionTick(Date.now());
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || typeof window === "undefined") {
      return;
    }

    const pausePayload = JSON.stringify({
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      organizationId: window.localStorage.getItem(
        "taskpilot.activeOrganizationId",
      ),
    });

    const pauseOnPageHide = () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const endpoint = `${baseUrl}/tasks/work/pause-active`;
      void fetch(endpoint, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: pausePayload,
      });
    };

    window.addEventListener("pagehide", pauseOnPageHide);

    return () => {
      window.removeEventListener("pagehide", pauseOnPageHide);
    };
  }, [activeSession]);

  const stopFromSidebar = async () => {
    if (!activeSession) return;

    try {
      setSessionLoading(true);
      await api.post(`/tasks/${activeSession.taskId}/work/stop`, {
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
      setActiveSession(null);
      window.dispatchEvent(new Event("taskpilot:work-session-updated"));
    } finally {
      setSessionLoading(false);
    }
  };

  const pauseActiveSession = async () => {
    if (!activeSession) return;

    try {
      await api.post("/tasks/work/pause-active", {
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
    } catch {
      // Best effort for logout and navigation cleanup.
    } finally {
      setActiveSession(null);
      window.dispatchEvent(new Event("taskpilot:work-session-updated"));
    }
  };

  const navItems = [
    ...(user?.role === "superadmin"
      ? [
          {
            name: "Control Center",
            href: "/dashboards/superadmin",
            icon: SquaresFour,
          },
          { name: "User Records", href: "/superadmin/users", icon: Users },
          {
            name: "Approvals",
            href: "/superadmin/approvals",
            icon: CheckSquare,
          },
        ]
      : [{ name: "Dashboard", href: "/dashboard", icon: SquaresFour }]),
    ...(user?.role !== "client"
      ? [{ name: "Projects", href: "/projects", icon: Briefcase }]
      : []),
    { name: "Team Tasks", href: "/tasks", icon: CheckSquare },
    ...(user?.role === "team"
      ? [{ name: "My Tasks", href: "/my-tasks", icon: CheckSquare }]
      : []),
    ...(user?.role === "admin" || user?.role === "superadmin"
      ? [
          { name: "My Tasks", href: "/my-tasks", icon: CheckSquare },
          { name: "Team", href: "/users/team", icon: Users },
          { name: "Activity", href: "/activity", icon: Pulse },
        ]
      : []),
    { name: "Notifications", href: "/notifications", icon: Bell },
    ...(user?.role !== "client"
      ? [{ name: "Attendance", href: "/attendance", icon: IdentificationCard }]
      : []),
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`glass fixed inset-y-3 left-3 z-50 flex w-[min(20rem,calc(100vw-1.5rem))] max-w-full flex-col rounded-[2rem] border border-white/5 p-4 shadow-2xl transition-transform duration-300 lg:static lg:inset-auto lg:h-[100dvh] lg:w-72 lg:translate-x-0 lg:rounded-none lg:border-b-0 lg:border-l-0 lg:border-r lg:border-t-0 lg:p-6 ${
          mobileOpen ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2 lg:mb-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-white shadow-lg shadow-emerald-500/20">
            <Image
              src="/logo.png"
              alt="TaskPilot icon"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none text-[var(--foreground)]">
              TaskPilot
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Simple team workspace
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative group"
                onClick={onClose}
              >
                <div
                  className={`relative z-10 flex items-center gap-4 rounded-2xl px-4 py-3 text-sm transition-all duration-300 ${
                    isActive
                      ? "text-white"
                      : "text-gray-500 hover:text-gray-200"
                  }`}
                >
                  <Icon
                    weight={isActive ? "fill" : "regular"}
                    className={`h-5.5 w-5.5 transition-colors duration-300 ${isActive ? "text-emerald-400" : "group-hover:text-gray-300"}`}
                  />
                  <span className="font-semibold tracking-[0.02em]">
                    {item.name}
                  </span>

                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span
                      className="z-20 ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-[var(--foreground)] shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                      suppressHydrationWarning
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}

                  {item.name === "Attendance" && pendingAttendanceRequests > 0 && (
                    <span
                      className="z-20 ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-[var(--foreground)] shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                      suppressHydrationWarning
                    >
                      {pendingAttendanceRequests > 9 ? "9+" : pendingAttendanceRequests}
                    </span>
                  )}

                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 -z-10 rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-5 pt-6">
          {activeSession && (
            <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ClockCountdown weight="bold" className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                    Active Session
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  {formatElapsed(activeSession.startedAt, sessionTick)}
                </span>
              </div>

              <p className="mt-3 text-sm font-bold leading-snug text-white">
                {activeSession.taskTitle}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
                {activeSession.projectName || "Task in progress"}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/tasks/${activeSession.taskId}`}
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-gray-200 transition hover:bg-white/10"
                >
                  <span className="inline-flex items-center gap-2">
                    <ArrowSquareOut className="h-3.5 w-3.5" />
                    Open
                  </span>
                </Link>
                <button
                  onClick={stopFromSidebar}
                  disabled={sessionLoading}
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Stop className="h-3.5 w-3.5" />
                    {sessionLoading ? "Stopping" : "Stop"}
                  </span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              try {
                if (activeSession) {
                  await pauseActiveSession();
                }
                await api.post("/auth/logout");
              } finally {
                localStorage.removeItem("token");
                localStorage.removeItem("taskpilot.activeOrganizationId");
                window.location.href = "/login";
              }
            }}
            className="group flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-gray-500 transition-all duration-300 hover:bg-red-400/5 hover:text-red-400"
          >
            <SignOut
              weight="bold"
              className="h-5.5 w-5.5 text-gray-600 group-hover:text-red-400/60"
            />
            <span>Logout</span>
          </button>

          <div className="px-4">
            <div className="mt-1 text-[8px] font-medium uppercase tracking-[0.2em] text-gray-500/40">
              Simbolo Multimedia
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
