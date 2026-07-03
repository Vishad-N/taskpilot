"use client";

import { useEffect, useState } from "react";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Clock, AlertTriangle } from "lucide-react";

export default function AccountFreezeModal() {
  const { user, refresh } = useMe();
  const [frozenRecord, setFrozenRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [proposedTime, setProposedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If the user's account is frozen, fetch the attendance record that caused it
    if (user?.isAccountFrozen) {
      setLoading(true);
      api.get("/attendance/my")
        .then((res) => {
          const records = res.data.attendance || [];
          const frozen = records.find((r: any) => ["frozen", "submitted_time"].includes(r.freezeStatus));
          if (frozen) {
            setFrozenRecord(frozen);
            if (frozen.proposedClockOut) {
              const dt = new Date(frozen.proposedClockOut);
              setProposedTime(dt.toISOString().slice(0, 16)); // YYYY-MM-DDThh:mm format for datetime-local
            }
          }
        })
        .catch((err) => {
          console.error("Failed to fetch frozen record", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user]);

  if (!user || !user.isAccountFrozen) return null;

  const handleSubmitTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedTime || !frozenRecord) return;
    
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/attendance/submit-proposed-time", {
        proposedTime: new Date(proposedTime).toISOString(),
        attendanceId: frozenRecord._id
      });
      // Update local state to show the waiting screen
      setFrozenRecord({ ...frozenRecord, freezeStatus: "submitted_time", proposedClockOut: proposedTime });
      // We don't refresh the user yet because they are still frozen until admin unfreezes them.
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit time.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-[#11161D] shadow-2xl border border-red-500/20"
        >
          {/* Header */}
          <div className="bg-red-500/10 p-6 text-center border-b border-red-500/20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Lock className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
              Account Frozen
            </h2>
            <p className="mt-2 text-sm text-red-400 font-medium">
              You forgot to clock out.
            </p>
          </div>

          {/* Body */}
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              </div>
            ) : frozenRecord ? (
              frozenRecord.freezeStatus === "frozen" ? (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-4 flex gap-3 text-sm text-gray-300">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p>
                      Your attendance on <strong>{frozenRecord.attendanceDate}</strong> has no clock-out time and was marked as Half Day. To restore your account access, please submit your actual clock-out time for manager approval.
                    </p>
                  </div>

                  <form onSubmit={handleSubmitTime} className="space-y-4">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-widest font-bold text-gray-500">Actual Clock Out Time</span>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="datetime-local"
                          value={proposedTime}
                          onChange={(e) => setProposedTime(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-red-500 transition outline-none"
                          required
                        />
                      </div>
                    </label>

                    {error && (
                      <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !proposedTime}
                      className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-red-500 disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Time"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4 text-center py-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 mb-4">
                    <Clock className="h-6 w-6 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Pending Approval</h3>
                  <p className="text-sm text-gray-400">
                    Your proposed clock-out time for <strong>{frozenRecord.attendanceDate}</strong> has been sent to your manager.
                  </p>
                  <p className="text-sm font-medium text-amber-500 bg-amber-500/10 p-3 rounded-xl mt-4">
                    Please wait for them to review and unfreeze your account. Try refreshing the page later.
                  </p>
                  <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-widest">
                    Refresh Page
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-gray-400 text-sm">
                No frozen record found. Contact your admin.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
