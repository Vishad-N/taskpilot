"use client";

import { useState } from "react";
import api from "@/services/api";
import { MapPin, Clock } from "lucide-react";

type ClockInOutCardProps = {
  attendanceToday: any;
  onUpdate: () => void;
};

export default function ClockInOutCard({ attendanceToday, onUpdate }: ClockInOutCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClockIn = () => {
    setError(null);
    setLoading(true);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.post("/attendance/clock-in", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          onUpdate();
        } catch (err: any) {
          setError(err.response?.data?.message || "Failed to clock in");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError("Unable to retrieve your location. Please allow location access.");
        setLoading(false);
      }
    );
  };

  const handleClockOut = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/attendance/clock-out");
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to clock out");
    } finally {
      setLoading(false);
    }
  };

  const hasClockedIn = !!attendanceToday?.clockIn;
  const hasClockedOut = !!attendanceToday?.clockOut;
  const isAbsent = attendanceToday?.status === "Absent";

  return (
    <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Clock size={20} />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">Today's Attendance</h2>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest mt-0.5">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl font-bold">
          {error}
        </div>
      )}

      {isAbsent && (
        <div className="mb-6 space-y-2">
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-red-500/20">
            <span className="text-xs text-red-400 font-bold uppercase tracking-widest">Status</span>
            <span className="text-red-500 font-black text-sm uppercase">Absent (Late)</span>
          </div>
          <p className="text-xs text-gray-500 text-center font-medium">A correction request has been submitted automatically.</p>
        </div>
      )}

      {!hasClockedIn ? (
        <div className="space-y-4">
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? "Checking Location..." : "Clock In"}
          </button>
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            <MapPin size={12} />
            <span>Requires Location Access</span>
          </div>
        </div>
      ) : !hasClockedOut ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Clocked In</span>
            <span className="text-white font-black text-sm">
              {new Date(attendanceToday.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Clock Out"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
           <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Clocked In</span>
            <span className="text-white font-black text-sm">
              {new Date(attendanceToday.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Clocked Out</span>
            <span className="text-white font-black text-sm">
              {new Date(attendanceToday.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="text-center py-2 text-emerald-400 font-black uppercase tracking-widest text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            Total Hours: {attendanceToday.totalHours?.toFixed(2)}h
          </div>
        </div>
      )}
    </div>
  );
}
