"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import SoftLoader from "@/components/ui/SoftLoader";
import { Calendar, CheckCircle, Clock, XCircle, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function LeavesPage() {
  const { user } = useMe();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my_balances"); // my_balances, apply, admin_requests
  
  const [balances, setBalances] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  // Apply Form
  const [applyType, setApplyType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState("morning");
  const [reason, setReason] = useState("");
  
  // Admin Requests
  const [adminRequests, setAdminRequests] = useState<any[]>([]);
  const [adminReviewNote, setAdminReviewNote] = useState("");

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const loadData = async () => {
    try {
      setLoading(true);
      const [balRes, reqRes, typeRes] = await Promise.all([
        api.get("/leaves/my-balances"),
        api.get("/leaves/my-requests"),
        api.get("/leaves/types")
      ]);
      setBalances(balRes.data.balances || []);
      setMyRequests(reqRes.data.requests || []);
      setLeaveTypes(typeRes.data.leaveTypes || []);

      if (isAdmin) {
        const adminReqRes = await api.get("/leaves/all-requests");
        setAdminRequests(adminReqRes.data.requests || []);
      }
    } catch (e: any) {
      console.error("Failed to load leave data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();

    const handleLeaveUpdated = () => {
      loadData();
    };

    window.addEventListener("taskpilot:leave_updated", handleLeaveUpdated);
    return () => {
      window.removeEventListener("taskpilot:leave_updated", handleLeaveUpdated);
    };
  }, [user]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyType || !startDate || !endDate || !reason) {
      alert("Please fill all required fields");
      return;
    }
    try {
      await api.post("/leaves/apply", {
        leaveTypeId: applyType,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
        reason
      });
      alert("Leave applied successfully!");
      setApplyType("");
      setStartDate("");
      setEndDate("");
      setIsHalfDay(false);
      setReason("");
      setActiveTab("my_balances");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to apply leave");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    try {
      await api.patch(`/leaves/${id}/cancel`);
      alert("Leave cancelled.");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to cancel leave");
    }
  };

  const handleReview = async (id: string, status: string) => {
    try {
      await api.patch(`/leaves/${id}/review`, { status, reviewNote: adminReviewNote });
      alert(`Leave ${status.toLowerCase()} successfully.`);
      setAdminReviewNote("");
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to review leave");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.24em] mb-1">Time Off</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Leaves</h1>
      </div>

      {loading ? (
        <SoftLoader title="Loading Leaves" subtitle="Fetching your leave data..." />
      ) : (
        <div className="space-y-8">
          <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto">
            <button onClick={() => setActiveTab("my_balances")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "my_balances" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>My Balances & Requests</button>
            <button onClick={() => setActiveTab("apply")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "apply" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>Apply for Leave</button>
            {isAdmin && (
              <button onClick={() => setActiveTab("admin_requests")} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === "admin_requests" ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-500 hover:text-white"}`}>
                All Requests {adminRequests.filter(r => r.status === "Pending").length > 0 && <span className="ml-2 bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[10px]">{adminRequests.filter(r => r.status === "Pending").length}</span>}
              </button>
            )}
          </div>

          {activeTab === "my_balances" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {balances.map(b => (
                  <div key={b._id} className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-500" />
                      {b.leaveTypeId?.name}
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Total</p>
                        <p className="text-2xl font-black text-gray-300 mt-1">{b.totalCredits}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Available</p>
                        <p className="text-2xl font-black text-emerald-400 mt-1">{b.available}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-4 text-xs">
                      <span className="text-amber-500">{b.pending} Pending</span>
                      <span className="text-red-400">{b.used} Used</span>
                    </div>
                  </div>
                ))}
                {balances.length === 0 && <p className="text-gray-500">No leave balances found.</p>}
              </div>

              <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6">My Recent Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Type</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Days</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 rounded-r-xl">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.map(r => (
                        <tr key={r._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-4 font-bold text-gray-300">{r.leaveTypeId?.name}</td>
                          <td className="px-4 py-4">{r.startDate} to {r.endDate} {r.isHalfDay && `(Half Day - ${r.halfDayPeriod})`}</td>
                          <td className="px-4 py-4">{r.totalDays}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                              r.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border" :
                              r.status === "Pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 border" :
                              r.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20 border" :
                              "bg-gray-500/10 text-gray-400 border-gray-500/20 border"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {r.status === "Pending" && (
                              <button onClick={() => handleCancel(r._id)} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest transition">Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {myRequests.length === 0 && <p className="text-gray-500 mt-4 text-center">No leave requests found.</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "apply" && (
            <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl max-w-2xl">
              <h3 className="text-lg font-bold text-white mb-6">Leave Application</h3>
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Leave Type</label>
                  <select 
                    value={applyType} 
                    onChange={e => setApplyType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 transition outline-none"
                    required
                  >
                    <option value="">Select Type</option>
                    {leaveTypes.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Start Date</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 transition outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">End Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 transition outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" checked={isHalfDay} onChange={e => setIsHalfDay(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 text-emerald-500" />
                    Half Day
                  </label>
                  {isHalfDay && (
                    <select 
                      value={halfDayPeriod} 
                      onChange={e => setHalfDayPeriod(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-emerald-500 transition outline-none text-sm"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold text-gray-500 mb-2">Reason</label>
                  <textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 transition outline-none min-h-[100px]"
                    required
                    placeholder="Provide a reason for your leave..."
                  ></textarea>
                </div>

                <div className="pt-4">
                  <button type="submit" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold uppercase tracking-widest transition">
                    Submit Application
                  </button>
                </div>
              </form>
            </div>
          )}

          {isAdmin && activeTab === "admin_requests" && (
            <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-6">Leave Requests (Admin)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                    <tr>
                      <th className="px-4 py-3 rounded-l-xl">Employee</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Duration (Days)</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 rounded-r-xl min-w-[200px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminRequests.map(r => (
                      <tr key={r._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-4 font-bold text-gray-300">
                          {r.userId?.name}
                          <p className="text-xs text-gray-500 font-normal mt-1">{r.userId?.email}</p>
                        </td>
                        <td className="px-4 py-4 font-medium text-emerald-400">{r.leaveTypeId?.name}</td>
                        <td className="px-4 py-4">{r.startDate} to {r.endDate} <br/><span className="text-xs text-gray-500">{r.totalDays} Days {r.isHalfDay ? `(${r.halfDayPeriod})` : ""}</span></td>
                        <td className="px-4 py-4 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            r.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border" :
                            r.status === "Pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/20 border" :
                            r.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20 border" :
                            "bg-gray-500/10 text-gray-400 border-gray-500/20 border"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {r.status === "Pending" ? (
                            <div className="flex flex-col gap-2">
                              <input 
                                type="text" 
                                placeholder="Review Note (Optional)" 
                                value={adminReviewNote} 
                                onChange={e => setAdminReviewNote(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded text-xs px-2 py-1 outline-none focus:border-emerald-500 text-white"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleReview(r._id, "Approved")} className="flex-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 transition">Approve</button>
                                <button onClick={() => handleReview(r._id, "Rejected")} className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-red-500/20 transition">Reject</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Reviewed by {r.reviewedBy?.name}<br/>
                              {r.reviewNote && <span className="italic">"{r.reviewNote}"</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminRequests.length === 0 && <p className="text-gray-500 mt-4 text-center">No leave requests found.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
