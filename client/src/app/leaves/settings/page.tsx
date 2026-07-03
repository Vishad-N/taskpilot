"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import SoftLoader from "@/components/ui/SoftLoader";
import ErrorModal from "@/components/ui/ErrorModal";
import SuccessModal from "@/components/ui/SuccessModal";

export default function LeaveSettingsPage() {
  const { user } = useMe();
  const [loading, setLoading] = useState(true);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<any>({
    name: "",
    code: "",
    creditsPerYear: 0,
    maxConsecutiveDays: 0,
    requiresApproval: true,
    applicableGenders: ["male", "female"]
  });
  
  // Edit Rule State
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRuleForm, setEditRuleForm] = useState<any>({});

  // Employee Balances State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userBalances, setUserBalances] = useState<any[]>([]);
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editBalanceTotal, setEditBalanceTotal] = useState<number>(0);

  // Modals
  const [errorModal, setErrorModal] = useState({ open: false, title: "", message: "" });
  const [successModal, setSuccessModal] = useState({ open: false, title: "", message: "" });

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const loadData = async () => {
    try {
      setLoading(true);
      const [typeRes, usersRes] = await Promise.all([
        api.get("/leaves/types?all=true"),
        api.get("/users/assignable")
      ]);
      setLeaveTypes(typeRes.data.leaveTypes || []);
      setOrgUsers(usersRes.data.users || []);
    } catch (e: any) {
      console.error("Failed to load settings data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) loadData();
  }, [user, isAdmin]);

  const handleEditRuleClick = (rule: any) => {
    setEditingRuleId(rule._id);
    setEditRuleForm({
      creditsPerYear: rule.creditsPerYear,
      creditsPerMonth: rule.creditsPerMonth,
      maxCarryForward: rule.maxCarryForward,
      maxConsecutiveDays: rule.maxConsecutiveDays,
      requiresApproval: rule.requiresApproval
    });
  };

  const handleSaveRule = async (id: string) => {
    try {
      await api.put(`/leaves/types/${id}`, editRuleForm);
      setSuccessModal({ open: true, title: "Rule Updated", message: "Leave rule updated successfully!" });
      setEditingRuleId(null);
      loadData();
    } catch (e: any) {
      setErrorModal({ open: true, title: "Update Failed", message: e.response?.data?.message || "Failed to update leave rule" });
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave type?")) return;
    try {
      const res = await api.delete(`/leaves/types/${id}`);
      setSuccessModal({ open: true, title: "Rule Deleted", message: res.data.message || "Leave rule deleted." });
      loadData();
    } catch (e: any) {
      setErrorModal({ open: true, title: "Deletion Failed", message: e.response?.data?.message || "Failed to delete leave rule" });
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/leaves/types", createForm);
      setSuccessModal({ open: true, title: "Rule Created", message: "Leave rule created successfully!" });
      setShowCreateForm(false);
      setCreateForm({
        name: "",
        code: "",
        creditsPerYear: 0,
        maxConsecutiveDays: 0,
        requiresApproval: true,
        applicableGenders: ["male", "female"]
      });
      loadData();
    } catch (e: any) {
      setErrorModal({ open: true, title: "Creation Failed", message: e.response?.data?.message || "Failed to create leave rule" });
    }
  };

  const loadUserBalances = async (userId: string) => {
    setSelectedUserId(userId);
    setEditingBalanceId(null);
    if (!userId) {
      setUserBalances([]);
      return;
    }
    try {
      const res = await api.get(`/leaves/balances/${userId}`);
      setUserBalances(res.data.balances || []);
    } catch (e: any) {
      console.error("Failed to load user balances", e);
    }
  };

  const handleEditBalanceClick = (balance: any) => {
    setEditingBalanceId(balance._id);
    setEditBalanceTotal(balance.totalCredits);
  };

  const handleSaveBalance = async (id: string) => {
    try {
      await api.put(`/leaves/balances/${id}`, { totalCredits: editBalanceTotal });
      setSuccessModal({ open: true, title: "Balance Updated", message: "Balance updated successfully!" });
      setEditingBalanceId(null);
      loadUserBalances(selectedUserId); // Reload
    } catch (e: any) {
      setErrorModal({ open: true, title: "Update Failed", message: e.response?.data?.message || "Failed to update balance" });
    }
  };

  if (!user) return null;
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <p className="text-red-400">You do not have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-[0.24em] mb-1">HR Administration</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Leave Settings</h1>
      </div>

      {loading ? (
        <SoftLoader title="Loading Settings" subtitle="Fetching configuration..." />
      ) : (
        <div className="space-y-8">
          
          {/* Global Leave Rules */}
          <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold text-lg">Global Leave Rules</h2>
              <button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition"
              >
                {showCreateForm ? "Cancel" : "Create New Rule"}
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateRule} className="mb-8 p-4 border border-white/10 rounded-xl bg-white/[0.02] space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input required type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Sick Leave" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Code</label>
                    <input required type="text" value={createForm.code} onChange={e => setCreateForm({...createForm, code: e.target.value})} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="SL" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Credits/Year</label>
                    <input required type="number" value={createForm.creditsPerYear} onChange={e => setCreateForm({...createForm, creditsPerYear: Number(e.target.value)})} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Consecutive (0=Unl)</label>
                    <input required type="number" value={createForm.maxConsecutiveDays} onChange={e => setCreateForm({...createForm, maxConsecutiveDays: Number(e.target.value)})} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Requires Approval</label>
                    <select value={createForm.requiresApproval ? "yes" : "no"} onChange={e => setCreateForm({...createForm, requiresApproval: e.target.value === "yes"})} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Applicable Genders</label>
                    <select value={createForm.applicableGenders.length === 2 ? "all" : createForm.applicableGenders[0]} onChange={e => {
                      const val = e.target.value;
                      setCreateForm({...createForm, applicableGenders: val === "all" ? ["male", "female"] : [val]});
                    }} className="w-full bg-[#11161D] border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="all">All</option>
                      <option value="male">Male Only</option>
                      <option value="female">Female Only</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-500/30 transition">Save Rule</button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Leave Type</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Credits/Year</th>
                    <th className="px-4 py-3">Max Consecutive</th>
                    <th className="px-4 py-3">Requires Approval</th>
                    <th className="px-4 py-3 rounded-r-xl text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map(rule => {
                    const isEditing = editingRuleId === rule._id;
                    return (
                      <tr key={rule._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-4 font-bold text-gray-300">{rule.name}</td>
                        <td className="px-4 py-4">{rule.code}</td>
                        <td className="px-4 py-4">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={editRuleForm.creditsPerYear} 
                              onChange={(e) => setEditRuleForm({...editRuleForm, creditsPerYear: Number(e.target.value)})}
                              className="bg-[#11161D] border border-white/10 rounded px-2 py-1 text-white w-20 text-sm focus:border-emerald-500 outline-none"
                            />
                          ) : (
                            rule.creditsPerYear
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={editRuleForm.maxConsecutiveDays} 
                              onChange={(e) => setEditRuleForm({...editRuleForm, maxConsecutiveDays: Number(e.target.value)})}
                              className="bg-[#11161D] border border-white/10 rounded px-2 py-1 text-white w-20 text-sm focus:border-emerald-500 outline-none"
                            />
                          ) : (
                            rule.maxConsecutiveDays === 0 ? "Unlimited" : rule.maxConsecutiveDays
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {isEditing ? (
                            <select
                              value={editRuleForm.requiresApproval ? "yes" : "no"}
                              onChange={(e) => setEditRuleForm({...editRuleForm, requiresApproval: e.target.value === "yes"})}
                              className="bg-[#11161D] border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-emerald-500 outline-none"
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          ) : (
                            rule.requiresApproval ? <span className="text-amber-400">Yes</span> : <span className="text-emerald-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingRuleId(null)} className="px-3 py-1 bg-white/5 text-gray-400 rounded-lg text-xs font-bold hover:bg-white/10 transition">Cancel</button>
                              <button onClick={() => handleSaveRule(rule._id)} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition">Save</button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleEditRuleClick(rule)} className="px-3 py-1 bg-white/5 text-gray-300 rounded-lg text-xs font-bold hover:bg-white/10 transition">Edit</button>
                              <button onClick={() => handleDeleteRule(rule._id)} className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition">Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee Leave Balances */}
          <div className="bg-[#11161D] border border-white/5 rounded-3xl p-6 shadow-xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold text-lg">Employee Leave Balances</h2>
              <select
                value={selectedUserId}
                onChange={(e) => loadUserBalances(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white min-w-[200px] focus:border-emerald-500 outline-none"
              >
                <option value="" className="bg-[#11161D]">Select an Employee...</option>
                {orgUsers.map(u => (
                  <option key={u._id} value={u._id} className="bg-[#11161D]">{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            {selectedUserId ? (
              userBalances.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-white/5">
                      <tr>
                        <th className="px-4 py-3 rounded-l-xl">Leave Type</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Total Credits (Year)</th>
                        <th className="px-4 py-3">Used</th>
                        <th className="px-4 py-3">Available</th>
                        <th className="px-4 py-3 rounded-r-xl text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userBalances.map(bal => {
                        const isEditing = editingBalanceId === bal._id;
                        return (
                          <tr key={bal._id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-4 py-4 font-bold text-gray-300">{bal.leaveTypeId?.name}</td>
                            <td className="px-4 py-4">{bal.leaveTypeId?.code}</td>
                            <td className="px-4 py-4">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  value={editBalanceTotal} 
                                  onChange={(e) => setEditBalanceTotal(Number(e.target.value))}
                                  className="bg-[#11161D] border border-white/10 rounded px-2 py-1 text-white w-20 text-sm focus:border-emerald-500 outline-none"
                                />
                              ) : (
                                bal.totalCredits
                              )}
                            </td>
                            <td className="px-4 py-4 text-red-400">{bal.used}</td>
                            <td className="px-4 py-4 text-emerald-400 font-bold">{bal.available}</td>
                            <td className="px-4 py-4 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingBalanceId(null)} className="px-3 py-1 bg-white/5 text-gray-400 rounded-lg text-xs font-bold hover:bg-white/10 transition">Cancel</button>
                                  <button onClick={() => handleSaveBalance(bal._id)} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition">Save</button>
                                </div>
                              ) : (
                                <button onClick={() => handleEditBalanceClick(bal)} className="px-3 py-1 bg-white/5 text-gray-300 rounded-lg text-xs font-bold hover:bg-white/10 transition">Edit Quota</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center bg-white/5 rounded-xl border border-white/10">
                  <p className="text-gray-400 mb-2">No active leave balances found for this user.</p>
                  <p className="text-xs text-gray-500">The user's balances will be automatically initialized when they visit their Leaves page.</p>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-gray-500">
                Please select an employee from the dropdown above to view and edit their balances.
              </div>
            )}
          </div>
        </div>
      )}

      <ErrorModal 
        open={errorModal.open} 
        title={errorModal.title} 
        message={errorModal.message} 
        onClose={() => setErrorModal({ ...errorModal, open: false })} 
      />
      <SuccessModal 
        open={successModal.open} 
        title={successModal.title} 
        message={successModal.message} 
        onClose={() => setSuccessModal({ ...successModal, open: false })} 
      />
    </DashboardLayout>
  );
}
