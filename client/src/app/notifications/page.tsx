"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { Bell, Check, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";

type Notification = {
  _id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityType?: "task" | "project";
  entityId?: string;
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

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [markingAll, setMarkingAll] = useState(false);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/notifications");
      setItems(res.data.notifications ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    const target = items.find((item) => item._id === id);
    if (!target || target.isRead) return;

    setUpdating((prev) => ({ ...prev, [id]: true }));

    try {
      await api.patch(`/notifications/${id}`, { isRead: true });
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      showToast({
        title: "Notification marked as read",
        description: "That update is now cleared from your unread list.",
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            await api.patch(`/notifications/${id}`, { isRead: false });
            setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
            showToast({
              title: "Notification restored",
              description: "It is unread again.",
              variant: "info"
            });
          }
        }
      });
    } catch {
      showToast({
        title: "Action failed",
        description: "We could not update that notification.",
        variant: "error"
      });
    } finally {
      setUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  const markAllRead = async () => {
    if (unreadCount === 0) return;

    setMarkingAll(true);

    try {
      await api.patch("/notifications/mark-all-read");
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      showToast({
        title: "Notifications cleared",
        description: "All notifications have been marked as read.",
        variant: "success"
      });
    } catch (e: unknown) {
      showToast({
        title: "Action failed",
        description: getErrorMessage(e, "We could not update all notifications."),
        variant: "error"
      });
    } finally {
      setMarkingAll(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tight">Notifications</h1>
          <p className="text-gray-400 text-sm mt-1">Stay updated with your latest task and project assignments.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={markAllRead}
            disabled={markingAll || unreadCount === 0}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300 rounded-xl transition disabled:opacity-50 disabled:hover:bg-emerald-600/10"
          >
            {markingAll ? "Marking..." : "Mark All As Read"}
          </button>
          <button
            onClick={load}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading && (
          <SoftLoader
            title="Loading notifications"
            subtitle="Fetching the latest task and project updates for you."
          />
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n._id}
                className={`group rounded-3xl p-5 border transition-all duration-300 relative overflow-hidden ${
                  n.isRead
                    ? "border-gray-800 bg-[#11161D]/50 opacity-80"
                    : "border-emerald-500/30 bg-[#11161D] shadow-[0_0_20px_rgba(79,70,229,0.05)]"
                }`}
              >
                {!n.isRead && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600" />
                )}

                <div className="flex items-start justify-between gap-6">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${n.isRead ? "bg-gray-800/50 text-gray-600" : "bg-emerald-600/10 text-emerald-400"}`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-sm leading-relaxed ${n.isRead ? "text-[var(--muted)]" : "text-[var(--foreground)] font-bold"}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                        {n.entityId && (
                          <Link
                            href={`/${n.entityType}s/${n.entityId}`}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                          >
                            View Details <ArrowRight className="w-2 h-2" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n._id)}
                      disabled={!!updating[n._id]}
                      className="shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-white transition group/btn"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4 group-hover/btn:scale-110 transition" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-gray-500">No notifications.</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
