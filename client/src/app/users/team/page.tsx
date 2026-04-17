"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { Users, Mail, Shield, UserPlus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
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

export default function TeamManagementPage() {
  const { showToast, dismissToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users/team");
      setUsers(res.data.users ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch team members"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const deleteUser = async (userId: string) => {
    const member = users.find((user) => user._id === userId);
    const toastId = showToast({
      title: `Delete ${member?.name ?? "this team member"}?`,
      description: "Their task assignments will be cleared.",
      variant: "error",
      durationMs: 9000,
      action: {
        label: "Delete",
        onClick: async () => {
          setDeletingUserId(userId);
          try {
            await api.delete(`/users/${userId}`);
            setUsers((prev) => prev.filter((user) => user._id !== userId));
            showToast({
              title: "Team member deleted",
              description: `${member?.name ?? "The user"} was removed successfully.`,
              variant: "success"
            });
          } catch (err: unknown) {
            const message = getErrorMessage(err, "Failed to delete team member");
            setError(message);
            showToast({
              title: "Delete failed",
              description: message,
              variant: "error"
            });
          } finally {
            setDeletingUserId(null);
          }
        }
      },
      secondaryAction: {
        label: "Cancel",
        onClick: () => dismissToast(toastId)
      }
    });
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold italic tracking-tight">Team Management</h1>
          <p className="text-gray-400 text-sm mt-1">View everyone associated with your organization and manage active members.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#11161D] border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-emerald-600 transition"
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition"
            onClick={() => alert("Invite feature coming soon! (New users should register and be approved by SuperAdmin)")}
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Synchronizing team records...</div>}
      {error && <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <div key={user._id} className="group bg-[#11161D] border border-white/5 rounded-3xl p-6 hover:border-emerald-600/30 transition shadow-sm hover:shadow-[0_0_30px_rgba(79,70,229,0.05)]">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-emerald-600/10 rounded-2xl group-hover:bg-emerald-600/20 transition">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-green-500/20">
                  {user.status}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">{user.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-gray-400">
                <Mail className="w-3.5 h-3.5" />
                <span className="text-xs">{user.email}</span>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-gray-600" />
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-500">{user.role}</span>
                </div>
                <button
                  onClick={() => deleteUser(user._id)}
                  disabled={deletingUserId === user._id}
                  className="w-10 h-10 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center disabled:opacity-50"
                  title="Delete team member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="lg:col-span-3 text-center py-20 bg-[#11161D] rounded-3xl border border-dashed border-gray-800">
              <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No organization members found.</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
