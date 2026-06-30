"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import { motion } from "framer-motion";
import SoftLoader from "@/components/ui/SoftLoader";
import ClockInOutCard from "@/components/attendance/ClockInOutCard";
import Pagination from "@/components/ui/Pagination";
import { usePaginationLimit } from "@/hooks/usePaginationLimit";

export default function AttendancePage() {
  const { user } = useMe();
  const [loading, setLoading] = useState(true);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("my"); // 'my', 'overview', 'requests', 'sheet'
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [sheetAttendance, setSheetAttendance] = useState<any[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSheetDate, setSelectedSheetDate] = useState(currentDateStr);

  // Correction Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqReason, setReqReason] = useState("");
  const [reqIn, setReqIn] = useState("");
  const [reqOut, setReqOut] = useState("");
  const [reqAttId, setReqAttId] = useState("");

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportEmployeeId, setExportEmployeeId] = useState("");
  const [exporting, setExporting] = useState(false);

  // Pagination for requests
  const [requestsPage, setRequestsPage] = useState(1);
  const limit = usePaginationLimit();
  const [requestsTotalPages, setRequestsTotalPages] = useState(1);
  const [requestsTotalRecords, setRequestsTotalRecords] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === "team") {
        const myRes = await api.get("/attendance/my");
        setMyAttendance(myRes.data.attendance || []);
      } else if (user?.role === "admin" || user?.role === "superadmin") {
        const [myRes, allRes, statRes, reqRes, usersRes] = await Promise.all([
          api.get("/attendance/my"),
          api.get("/attendance/all"),
          api.get("/attendance/analytics"),
          api.get(`/attendance/correction-requests?page=${requestsPage}&limit=${limit}`),
          api.get("/users/assignable")
        ]);
        setMyAttendance(myRes.data.attendance || []);
        setAllAttendance(allRes.data.attendance || []);
        setAnalytics(statRes.data || null);
        setRequests((reqRes.data.data ?? reqRes.data.requests) || []);
        setRequestsTotalPages(reqRes.data.totalPages ?? 1);
        setRequestsTotalRecords(reqRes.data.totalRecords ?? 0);
        setOrgUsers(usersRes.data.users || []);
      }
    } catch (e) {
      console.error("Failed to load attendance", e);
    } finally {
      setLoading(false);
    }
  }, [user, limit, requestsPage]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const loadSheetData = useCallback(async () => {
    if (!isAdmin || !selectedSheetDate) return;
    try {
      const res = await api.get(`/attendance/all?date=${selectedSheetDate}`);
      setSheetAttendance(res.data.attendance || []);
    } catch (e) {
      console.error("Failed to load sheet attendance", e);
    }
  }, [isAdmin, selectedSheetDate]);

  useEffect(() => {
    if (user && isAdmin) loadSheetData();
  }, [user, isAdmin, selectedSheetDate, loadSheetData]);

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timer = setTimeout(() => {
      const newTodayStr = new Date().toISOString().split("T")[0];
      setCurrentDateStr(newTodayStr);
      setSelectedSheetDate(prev => prev === currentDateStr ? newTodayStr : prev);
      loadData();
    }, msUntilMidnight + 1000); // 1 second after midnight to ensure date rollover

    return () => clearTimeout(timer);
  }, [currentDateStr, loadData]);

  useEffect(() => {
    const handleAttendanceUpdate = () => {
      loadData();
      if (isAdmin) loadSheetData();
    };

    window.addEventListener("taskpilot:attendance_updated", handleAttendanceUpdate);
    return () => {
      window.removeEventListener("taskpilot:attendance_updated", handleAttendanceUpdate);
    };
  }, [loadData, isAdmin, loadSheetData]);

  const attendanceToday = myAttendance.find(a => a.attendanceDate === currentDateStr);

  const submitCorrection = async () => {
    try {
      await api.post("/attendance/request-correction", {
        attendanceId: reqAttId || undefined,
        requestedClockIn: reqIn ? new Date(reqIn).toISOString() : undefined,
        requestedClockOut: reqOut ? new Date(reqOut).toISOString() : undefined,
        reason: reqReason
      });
      setShowRequestModal(false);
      setReqReason("");
      setReqIn("");
      setReqOut("");
      alert("Correction request submitted!");
      loadData();
      if (isAdmin) loadSheetData();
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to submit request.");
    }
  };

  const handleReqStatus = async (id: string, status: string) => {
    try {
      await api.put(`/attendance/correction-requests/${id}`, { status });
      loadData();
      if (isAdmin) loadSheetData();
    } catch (e) {
      alert("Failed to update request.");
    }
  };

  const uniqueUsers = Array.from(new Map(allAttendance.filter(a => a.userId).map(a => [a.userId._id, a.userId])).values());

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/attendance/export", {
        params: { month: exportMonth, year: exportYear, employeeId: exportEmployeeId || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Attendance_${exportMonth}_${exportYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowExportModal(false);
    } catch (e) {
      alert("Failed to export attendance.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.24em] mb-1">Time & Tracking</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Attendance</h1>
        </motion.div>
      </div>

      {loading && <SoftLoader title="Loading attendance" subtitle="Fetching your records..." />}

      {!loading && (
        <div className="space-y-8">
          {isAdmin && (
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <button onClick={() => setActiveTab("my")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "my" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>My Record</button>
              <button onClick={() => setActiveTab("overview")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "overview" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>Overview</button>
              <button onClick={() => setActiveTab("sheet")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "sheet" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>Attendance Sheet</button>
              <button onClick={() => setActiveTab("requests")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "requests" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>
                Requests {requests.filter(r => r.status === "Pending").length > 0 && <span className="ml-2 bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[10px]">{requests.filter(r => r.status === "Pending").length}</span>}
              </button>
              <button onClick={() => setShowExportModal(true)} className="ml-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                Export
              </button>
            </div>
          )}

          {activeTab === "my" && (
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <ClockInOutCard attendanceToday={attendanceToday} onUpdate={loadData} />
              
              <div className="flex-1 bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-white font-bold text-lg">My History</h2>
                  <button onClick={() => setShowRequestModal(true)} className="bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-lg text-gray-400 hover:text-white transition">Request Correction</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Date</th>
                        <th className="px-4 py-3">Clock In</th>
                        <th className="px-4 py-3">Clock Out</th>
                        <th className="px-4 py-3">Hours</th>
                        <th className="px-4 py-3 rounded-r-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myAttendance.map(record => (
                        <tr key={record._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold text-gray-300">{record.attendanceDate}</td>
                          <td className="px-4 py-4">{new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-4">{record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="px-4 py-4">{record.totalHours?.toFixed(2) || '-'}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              record.status === "Present" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : record.status === "Half Day" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : record.status === "Weekly Off" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {isAdmin && activeTab === "overview" && (
            <div className="space-y-6">
              {analytics && (
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-[#11161D] border border-white/5 rounded-2xl p-4">
                    <p className="text-2xl font-black text-white">{analytics.presentToday}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Present Today</p>
                  </div>
                  <div className="bg-[#11161D] border border-white/5 rounded-2xl p-4">
                    <p className="text-2xl font-black text-red-400">{analytics.absentToday}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Absent Today</p>
                  </div>
                  <div className="bg-[#11161D] border border-white/5 rounded-2xl p-4">
                    <p className="text-2xl font-black text-amber-400">{analytics.currentlyClockedIn}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Clocked In Now</p>
                  </div>
                  <div className="bg-[#11161D] border border-white/5 rounded-2xl p-4">
                    <p className="text-2xl font-black text-blue-400">{analytics.totalHoursToday.toFixed(1)}h</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Total Hours</p>
                  </div>
                  <div className="bg-[#11161D] border border-white/5 rounded-2xl p-4">
                    <p className="text-2xl font-black text-purple-400">{analytics.pendingRequests}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">Pending Corrections</p>
                  </div>
                 </div>
              )}

              <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
                <h2 className="text-white font-bold text-lg mb-6">Today's Active Records</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">User</th>
                        <th className="px-4 py-3">Clock In</th>
                        <th className="px-4 py-3">Clock Out</th>
                        <th className="px-4 py-3">Distance (m)</th>
                        <th className="px-4 py-3 rounded-r-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAttendance.filter(a => a.attendanceDate === currentDateStr).map(record => (
                        <tr key={record._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold text-gray-300">{record.userId?.name || 'Unknown'}</td>
                          <td className="px-4 py-4">{new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-4">{record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-400 animate-pulse text-xs">Active</span>}</td>
                          <td className="px-4 py-4">{record.distanceFromOffice ? Math.round(record.distanceFromOffice) : '-'}</td>
                          <td className="px-4 py-4">
                             <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              record.status === "Present" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : record.status === "Half Day" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : record.status === "Weekly Off" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {isAdmin && activeTab === "requests" && (
            <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
              <h2 className="text-white font-bold text-lg mb-6">Correction Requests</h2>
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">User</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Req. In</th>
                    <th className="px-4 py-3">Req. Out</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 rounded-r-xl">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-4 font-bold text-gray-300">{r.userId?.name}</td>
                      <td className="px-4 py-4">{r.reason}</td>
                      <td className="px-4 py-4">{r.requestedClockIn ? new Date(r.requestedClockIn).toLocaleString() : '-'}</td>
                      <td className="px-4 py-4">{r.requestedClockOut ? new Date(r.requestedClockOut).toLocaleString() : '-'}</td>
                      <td className="px-4 py-4">{r.status}</td>
                      <td className="px-4 py-4 flex gap-2">
                        {r.status === "Pending" && (
                          <>
                            <button onClick={() => handleReqStatus(r._id, "Approved")} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold transition hover:bg-emerald-500/20">Approve</button>
                            <button onClick={() => handleReqStatus(r._id, "Half Day")} className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-bold transition hover:bg-amber-500/20">Half Day</button>
                            <button onClick={() => handleReqStatus(r._id, "Rejected")} className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold transition hover:bg-red-500/20">Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {requestsTotalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={requestsPage}
                    totalPages={requestsTotalPages}
                    onPageChange={setRequestsPage}
                    totalRecords={requestsTotalRecords}
                    limit={limit}
                  />
                </div>
              )}
            </div>
          )}

          {isAdmin && activeTab === "sheet" && (
            <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-white font-bold text-lg">Attendance Sheet</h2>
                <input 
                  type="date" 
                  value={selectedSheetDate} 
                  onChange={(e) => setSelectedSheetDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">User</th>
                      <th className="px-4 py-3">Clock In</th>
                      <th className="px-4 py-3">Clock Out</th>
                      <th className="px-4 py-3">Total Hours</th>
                      <th className="px-4 py-3 rounded-r-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUsers.length > 0 ? orgUsers.map(user => {
                      const record = sheetAttendance.find(a => a.userId?._id === user._id);
                      
                      let displayStatus = "No Record";
                      let statusClass = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                      
                      if (record?.status) {
                        displayStatus = record.status;
                        if (record.status === "Present") statusClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        else if (record.status === "Half Day") statusClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        else if (record.status === "Weekly Off") statusClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        else statusClass = "bg-red-500/10 text-red-400 border-red-500/20";
                      } else {
                        // Check if it's past 12 PM for this date
                        const selectedDate = new Date(selectedSheetDate);
                        const todayDate = new Date(currentDateStr);
                        
                        selectedDate.setHours(0,0,0,0);
                        todayDate.setHours(0,0,0,0);
                        
                        const isPastDate = selectedDate < todayDate;
                        const isTodayPast12 = selectedDate.getTime() === todayDate.getTime() && new Date().getHours() >= 12;
                        
                        if (isPastDate || isTodayPast12) {
                          displayStatus = "Absent";
                          statusClass = "bg-red-500/10 text-red-400 border-red-500/20";
                        }
                      }

                      return (
                        <tr key={user._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold text-gray-300">{user.name}</td>
                          <td className="px-4 py-4">{record?.clockIn ? new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="px-4 py-4">{record?.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : record?.clockIn ? <span className="text-emerald-400 animate-pulse text-xs">Active</span> : '-'}</td>
                          <td className="px-4 py-4">{record?.totalHours ? record.totalHours.toFixed(2) + 'h' : '-'}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusClass}`}>
                              {displayStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-medium">No users found in the organization.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11161D] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Request Attendance Correction</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Reason *</label>
                <textarea className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" rows={3} value={reqReason} onChange={e => setReqReason(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Clock In Time</label>
                  <input type="datetime-local" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" value={reqIn} onChange={e => setReqIn(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Clock Out Time</label>
                  <input type="datetime-local" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" value={reqOut} onChange={e => setReqOut(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition">Cancel</button>
                <button onClick={submitCorrection} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition">Submit Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11161D] border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Export Attendance</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Month</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" value={exportMonth} onChange={e => setExportMonth(parseInt(e.target.value))}>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m} className="bg-[#11161D]">{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Year</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" value={exportYear} onChange={e => setExportYear(parseInt(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest font-bold">Employee</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white mt-1" value={exportEmployeeId} onChange={e => setExportEmployeeId(e.target.value)}>
                  <option value="" className="bg-[#11161D]">All Employees</option>
                  {uniqueUsers.map((u: any) => (
                    <option key={u._id} value={u._id} className="bg-[#11161D]">{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition" disabled={exporting}>Cancel</button>
                <button onClick={handleExport} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition flex items-center gap-2" disabled={exporting}>
                  {exporting ? "Exporting..." : "Download Excel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
