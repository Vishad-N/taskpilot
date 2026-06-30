"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/ui/Pagination";
import { usePaginationLimit } from "@/hooks/usePaginationLimit";

type ActivityLog = {
  _id: string;
  action: string;
  userId: { _id: string; name: string; role: string };
  entityType: string;
  entityId: string;
  createdAt: string;
  changes?: Record<string, unknown>;
};

const getChangeValue = (changes: Record<string, unknown> | undefined, key: string) => {
  const value = changes?.[key];
  return typeof value === "string" ? value : null;
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

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = usePaginationLimit();
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchLogs = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/activity/feed?page=${currentPage}&limit=${limit}`);
      setLogs(res.data.data ?? res.data.logs ?? []);
      setTotalPages(res.data.totalPages ?? 1);
      setTotalRecords(res.data.totalRecords ?? 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch activity logs"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page, limit]);

  const formatAction = (action: string) => {
    if (action.includes("moved task to")) return "Status Update";
    if (action.includes("created task") || action.includes("created a task")) return "Creation";
    if (action.includes("edited task") || action.includes("edited project")) return "Edit";
    if (action.includes("deleted task") || action.includes("deleted project")) return "Deletion";
    if (action.includes("added a comment")) return "Discussion";
    return "General";
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Activity Feed</h1>
          <p className="text-gray-400 text-sm mt-1">Timeline of all actions across the organization.</p>
        </div>
        <button
          onClick={() => fetchLogs(1)}
          className="p-2 hover:bg-white/5 rounded-full transition"
          title="Refresh Feed"
        >
          <Activity className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      <div className="max-w-4xl">
        {loading && <div className="text-gray-500 text-sm">Synchronizing logs...</div>}
        {error && <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl">{error}</div>}

        {!loading && !error && (
          <div className="space-y-6">
            {logs.map((log) => (
              <div key={log._id} className="relative pl-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] before:w-[2px] before:bg-gray-800 last:before:hidden">
                <div className="absolute left-0 top-1 p-1 bg-[#11161D] border border-gray-700 rounded-full z-10">
                  <div className={`w-3 h-3 rounded-full ${log.action.includes("delete") ? "bg-red-500" :
                      log.action.includes("edit") ? "bg-amber-400" :
                        log.action.includes("create") ? "bg-green-500" :
                          log.action.includes("move") ? "bg-blue-500" :
                            log.action.includes("comment") ? "bg-yellow-500" : "bg-gray-500"
                    }`} />
                </div>

                <div className="bg-[#11161D] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition">
                  {(() => {
                    const fromChange = getChangeValue(log.changes, "from");
                    const toChange = getChangeValue(log.changes, "to");

                    return (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          {formatAction(log.action)}
                        </span>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm text-gray-200">
                        <span className="font-semibold text-white">{log.userId?.name}</span> {log.action}
                      </p>

                      {fromChange && toChange && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-lg border border-white/5 w-fit">
                          <span className="text-[10px] uppercase font-bold text-gray-500">{fromChange}</span>
                          <ArrowRight className="w-3 h-3 text-gray-700" />
                          <span className="text-[10px] uppercase font-bold text-emerald-400">{toChange}</span>
                        </div>
                      )}
                    </div>

                    {log.entityType === "task" && !log.action.includes("deleted task") && (
                      <Link
                        href={`/tasks/${log.entityId}`}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                    );
                  })()}
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="text-center py-20 bg-[#11161D] rounded-3xl border border-dashed border-gray-800">
                <Activity className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No activity recorded yet.</p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalRecords={totalRecords}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
