"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Coffee, AlertCircle } from "lucide-react";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";

interface QuickViewModalProps {
  user: any;
  onClose: () => void;
}

export default function AttendanceQuickViewModal({ user, onClose }: QuickViewModalProps) {
  const { user: currentUser } = useMe();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const fetchMonthData = async () => {
      setLoading(true);
      try {
        const monthStr = (month + 1).toString();
        const isSelf = currentUser?._id === user._id;
        const endpoint = isSelf 
          ? `/attendance/my?month=${monthStr}&year=${year}` 
          : `/attendance/all?user=${user._id}&month=${monthStr}&year=${year}`;
        const res = await api.get(endpoint);
        setAttendanceData(res.data.attendance || []);
      } catch (error) {
        console.error("Failed to fetch user attendance", error);
      } finally {
        setLoading(false);
      }
    };
    if (user?._id) fetchMonthData();
  }, [user?._id, month, year]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => {
    setSelectedRecord(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setSelectedRecord(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setSelectedRecord(null);
    setCurrentDate(new Date());
  };

  const computedDays = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    const isPastMonth = new Date(year, month, 1) < today && !isCurrentMonth;
    const lastEvaluatedDay = isCurrentMonth ? today.getDate() : (isPastMonth ? daysInMonth : 0);

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSunday = date.getDay() === 0;
      const isPastOrToday = day <= lastEvaluatedDay;
      const isFuture = date > today;
      
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      let dbRecord = attendanceData.find(a => a.attendanceDate === dateStr);

      let status = "Not Evaluated"; 
      let totalHours = 0;

      if (dbRecord) {
        status = dbRecord.status;
        totalHours = dbRecord.totalHours || 0;
        
        // Correct backend marking Sunday as absent
        if (status === "Absent" && isSunday) {
           status = "Weekly Off";
        }
      } else {
        if (isPastOrToday) {
          if (isSunday) {
            status = "Weekly Off";
          } else {
            if (day < today.getDate() || isPastMonth) {
              status = "Absent";
            } else {
              status = "Pending";
            }
          }
        }
      }
      
      result.push({ day, dateStr, isSunday, isFuture, status, totalHours, dbRecord });
    }
    return result;
  }, [attendanceData, year, month, daysInMonth]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let totalHours = 0;

    computedDays.forEach(d => {
      totalHours += d.totalHours;

      if (d.status === "Present" || d.status === "Late") present++;
      else if (d.status === "Absent") absent++;
      else if (d.status === "Half Day") halfDay++;
      else if (d.status === "Leave" || d.status === "On Leave" || d.status === "Weekly Off") leave++;
    });

    const baseDays = present + absent + halfDay;
    const percentage = baseDays > 0 ? Math.round(((present + halfDay * 0.5) / baseDays) * 100) : 0;

    return { present, absent, halfDay, leave, totalHours: totalHours.toFixed(1), percentage };
  }, [computedDays]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-[950px] h-[90vh] bg-[#11161D] dark:bg-[#11161D] bg-white border border-white/10 dark:border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* Main Calendar Area */}
          <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center text-emerald-400 font-bold text-2xl border border-emerald-500/20">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user.email}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-emerald-500/20">
                        Present: {stats.present}
                      </span>
                      <span className="px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-red-500/20">
                        Absent: {stats.absent}
                      </span>
                      <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] uppercase tracking-widest font-bold rounded-lg border border-amber-500/20">
                        Half Day: {stats.halfDay}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition md:hidden"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Month Selector */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.02] p-2 rounded-2xl border border-gray-200 dark:border-white/5">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} className="text-emerald-500" />
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {currentDate.toLocaleString("default", { month: "long" })} {year}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={goToToday} className="px-3 py-1.5 bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-xl transition">
                    Today
                  </button>
                  <button onClick={nextMonth} className="p-2 hover:bg-gray-200 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6 md:p-8 flex-1">
              <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4">
                {days.map(d => (
                  <div key={d} className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {d}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2 md:gap-4">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-2xl bg-transparent" />
                  ))}
                  
                  {computedDays.map((d) => {
                    const { day, status, isFuture, isSunday, dbRecord } = d;
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                    const isWeekend = isSunday || new Date(year, month, day).getDay() === 6;

                    let bgClass = "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400";
                    let dotClass = "";

                    if (status === "Present" || status === "Late") {
                      bgClass = "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20";
                      dotClass = "bg-emerald-500";
                    } else if (status === "Absent") {
                      bgClass = "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20";
                      dotClass = "bg-red-500";
                    } else if (status === "Half Day") {
                      bgClass = "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20";
                      dotClass = "bg-amber-500";
                    } else if (status === "Weekly Off" || status === "Leave" || status === "On Leave") {
                      bgClass = "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20";
                      dotClass = "bg-blue-500";
                    } else if (isFuture) {
                      bgClass = "bg-transparent border-transparent text-gray-400 dark:text-gray-600 opacity-50";
                    } else if (isWeekend) {
                      bgClass = "bg-gray-100 dark:bg-white/[0.01] border-gray-200 dark:border-white/5 text-gray-400 dark:text-gray-500";
                    } else {
                      bgClass = "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05]";
                    }

                    const isSelected = selectedRecord?.day === day;

                    return (
                      <motion.button
                        whileHover={!isFuture ? { scale: 1.05 } : {}}
                        whileTap={!isFuture ? { scale: 0.95 } : {}}
                        key={day}
                        disabled={isFuture}
                        onClick={() => !isFuture && setSelectedRecord({ day, record: dbRecord || { status, totalHours: 0 } })}
                        className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 ${bgClass} ${isToday ? 'ring-2 ring-emerald-500/50' : ''} ${isSelected ? 'ring-2 ring-emerald-500 dark:ring-white/50 bg-gray-100 dark:bg-white/10' : ''}`}
                      >
                        <span className="font-bold text-sm md:text-lg">{day}</span>
                        {dotClass && (
                          <div className={`absolute bottom-2 md:bottom-3 w-1.5 h-1.5 rounded-full ${dotClass}`} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Side Summary / Detail Panel */}
          <div className="w-full md:w-[350px] bg-gray-50 dark:bg-black/20 border-l border-gray-200 dark:border-white/5 flex flex-col">
            <div className="p-6 md:p-8 flex justify-between items-center border-b border-gray-200 dark:border-white/5 hidden md:flex">
              <h3 className="text-gray-900 dark:text-white font-bold">Summary</h3>
              <button
                onClick={onClose}
                className="p-2 bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {selectedRecord ? (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <button onClick={() => setSelectedRecord(null)} className="text-xs font-bold text-gray-500 dark:text-gray-500 uppercase tracking-widest hover:text-gray-900 dark:hover:text-white mb-4 flex items-center gap-1">
                        <ChevronLeft size={14} /> Back to Summary
                      </button>
                      <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {new Date(year, month, selectedRecord.day).toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </h4>
                      {selectedRecord.record ? (
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border inline-block mt-2 ${
                          selectedRecord.record.status === 'Present' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                          selectedRecord.record.status === 'Absent' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20' :
                          selectedRecord.record.status === 'Half Day' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' :
                          'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                        }`}>
                          {selectedRecord.record.status}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-gray-200 dark:border-gray-500/20 bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400 inline-block mt-2">
                          No Record
                        </span>
                      )}
                    </div>

                    {selectedRecord.record && (
                      <div className="space-y-4">
                        {selectedRecord.record.clockIn && (
                          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Clock In</p>
                              <p className="text-gray-900 dark:text-white font-bold">{new Date(selectedRecord.record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        )}
                        
                        {selectedRecord.record.clockOut && (
                          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Clock Out</p>
                              <p className="text-gray-900 dark:text-white font-bold">{new Date(selectedRecord.record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        )}

                        {selectedRecord.record.totalHours > 0 && (
                          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                              <Coffee size={20} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Total Hours</p>
                              <p className="text-gray-900 dark:text-white font-bold">{selectedRecord.record.totalHours.toFixed(2)} hrs</p>
                            </div>
                          </div>
                        )}

                        {(selectedRecord.record.status === 'Absent' || selectedRecord.record.correctionReason) && (
                          <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-2xl p-4 mt-4">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                              <AlertCircle size={16} />
                              <span className="text-xs font-bold uppercase tracking-widest">Notes / Reason</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {selectedRecord.record.correctionReason || "Marked Absent automatically due to missing clock-in."}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center justify-center py-6 bg-gradient-to-b from-emerald-50 dark:from-emerald-500/10 to-transparent rounded-3xl border border-emerald-200 dark:border-emerald-500/20">
                      <div className="relative w-32 h-32 mx-auto flex items-center justify-center mb-4">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                          <circle cx="64" cy="64" r="56" className="stroke-gray-200 dark:stroke-white/10" strokeWidth="12" fill="none" />
                          <circle 
                            cx="64" cy="64" r="56" 
                            className="stroke-emerald-500 transition-all duration-1000 ease-out" 
                            strokeWidth="12" fill="none" 
                            strokeDasharray={2 * Math.PI * 56} 
                            strokeDashoffset={2 * Math.PI * 56 * (1 - stats.percentage / 100)}
                            strokeLinecap="round" 
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-3xl font-black text-gray-900 dark:text-white leading-none">{stats.percentage}%</span>
                          <span className="text-[9px] uppercase tracking-widest text-emerald-600 dark:text-emerald-500 font-bold mt-1">Attendance</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Present</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.present}</p>
                      </div>
                      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Absent</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.absent}</p>
                      </div>
                      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Half Day</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.halfDay}</p>
                      </div>
                      <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Leaves</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.leave}</p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Total Hrs</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{stats.totalHours} <span className="text-sm text-gray-500 font-normal tracking-normal">hrs</span></p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Coffee size={24} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
