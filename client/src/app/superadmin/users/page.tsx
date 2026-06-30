"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import Pagination from "@/components/ui/Pagination";
import { usePaginationLimit } from "@/hooks/usePaginationLimit";

type Organization = {
  _id: string;
  name: string;
};

type Project = {
  _id: string;
  name: string;
};

type ManagedUser = {
  _id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "team" | "client";
  status: "pending" | "approved";
  isActive: boolean;
  createdAt: string;
  organizationId?: Organization | null;
  allowedOrganizations?: Organization[];
  projectIds?: Project[];
};

type UserEditor = {
  name: string;
  email: string;
  role: ManagedUser["role"];
  status: ManagedUser["status"];
  isActive: boolean;
  organizationId: string;
  allowedOrganizations: string[];
  projectIds: string[];
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

const mapUserToEditor = (user: ManagedUser): UserEditor => ({
  name: user.name ?? "",
  email: user.email ?? "",
  role: user.role,
  status: user.status,
  isActive: Boolean(user.isActive),
  organizationId: user.organizationId?._id ?? "",
  allowedOrganizations: (user.allowedOrganizations ?? []).map((organization) => organization._id),
  projectIds: (user.projectIds ?? []).map((project) => project._id)
});

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [editor, setEditor] = useState<UserEditor | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  
  const [page, setPage] = useState(1);
  const limit = usePaginationLimit();
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadData = useCallback(async (currentPage = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search,
        role: roleFilter,
        status: statusFilter,
        organizationId: orgFilter,
        isActive: activityFilter
      });

      const [usersRes, orgsRes] = await Promise.all([
        api.get(`/users/all?${params.toString()}`),
        api.get("/organization")
      ]);

      const nextUsers = usersRes.data.data ?? usersRes.data.users ?? [];
      setUsers(nextUsers);
      setTotalPages(usersRes.data.totalPages ?? 1);
      setTotalRecords(usersRes.data.totalRecords ?? 0);
      setOrgs(orgsRes.data.organizations ?? []);
      setSelectedUserId((current) =>
        current && nextUsers.some((user: ManagedUser) => user._id === current)
          ? current
          : nextUsers[0]?._id ?? ""
      );
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Failed to load user records"));
    } finally {
      setLoading(false);
    }
  }, [limit, search, roleFilter, statusFilter, orgFilter, activityFilter]);

  useEffect(() => {
    // Reset page to 1 on filter change
    setPage(1);
  }, [search, roleFilter, statusFilter, orgFilter, activityFilter]);

  useEffect(() => {
    const run = async () => {
      await loadData(page);
    };

    void run();
  }, [loadData, page]);

  const filteredUsers = users;

  const selectedUser = useMemo(
    () => users.find((user) => user._id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  useEffect(() => {
    if (!selectedUser) {
      setEditor(null);
      setPasswordDraft("");
      return;
    }

    setEditor(mapUserToEditor(selectedUser));
    setPasswordDraft("");
    setMessage(null);
    setError(null);
  }, [selectedUser]);

  useEffect(() => {
    if (editor?.role === "client" && editor?.organizationId) {
      api
        .get(`/projects/org-projects?organizationId=${editor.organizationId}&limit=1000`)
        .then((res) => {
          setOrgProjects(res.data.data ?? res.data.projects ?? []);
        })
        .catch((err) => {
          console.error("Failed to fetch projects", err);
          setOrgProjects([]);
        });
    } else {
      setOrgProjects([]);
    }
  }, [editor?.organizationId, editor?.role]);

  const applyUpdatedUser = (updatedUser: ManagedUser) => {
    setUsers((current) =>
      current.map((user) => (user._id === updatedUser._id ? updatedUser : user))
    );
  };

  const saveUser = async () => {
    if (!selectedUser || !editor) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const response = await api.patch(`/users/${selectedUser._id}`, {
        name: editor.name,
        email: editor.email,
        role: editor.role,
        status: editor.status,
        isActive: editor.isActive,
        organizationId: editor.organizationId || null,
        allowedOrganizations: editor.allowedOrganizations.filter(
          (organizationId) => organizationId !== editor.organizationId
        ),
        projectIds: editor.role === "client" ? editor.projectIds : []
      });

      applyUpdatedUser(response.data.user);
      setMessage("User access updated.");
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveUser();
  };

  const resetPassword = async () => {
    if (!selectedUser || !passwordDraft.trim()) {
      return;
    }

    try {
      setResettingPassword(true);
      setMessage(null);
      setError(null);
      await api.patch(`/users/${selectedUser._id}/password`, {
        password: passwordDraft.trim()
      });
      setPasswordDraft("");
      setMessage("Password reset completed.");
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Failed to reset password"));
    } finally {
      setResettingPassword(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: "Total Users", value: totalRecords },
      { label: "Current Page Users", value: users.length },
    ],
    [users, totalRecords]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Superadmin / User Records
          </p>
          <h1 className="text-3xl font-semibold">Complete user directory</h1>
          <p className="max-w-3xl text-sm text-[var(--muted)]">
            Search every account, filter access, change role, update organization visibility, disable users,
            and reset passwords from one place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, organization"
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
            >
              <option value="all">All roles</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="team">Team</option>
              <option value="client">Client</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
            <select
              value={orgFilter}
              onChange={(event) => setOrgFilter(event.target.value)}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
            >
              <option value="all">All organizations</option>
              <option value="none">No primary organization</option>
              {orgs.map((organization) => (
                <option key={organization._id} value={organization._id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <select
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value)}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
            >
              <option value="all">All activity states</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filtered users</h2>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
                {filteredUsers.length} results
              </span>
            </div>

            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No users match the current filters.</p>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = user._id === selectedUserId;

                  return (
                    <button
                      key={user._id}
                      onClick={() => setSelectedUserId(user._id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-emerald-500/40 bg-emerald-500/8"
                          : "border-[var(--card-border)] bg-[var(--surface-2)] hover:border-emerald-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
                        </div>
                        <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                          {user.role}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[var(--muted)]">
                          {user.organizationId?.name ?? "No org"}
                        </span>
                        <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[var(--muted)]">
                          {user.status}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 ${
                            user.isActive
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {totalPages > 1 && !loading && (
              <div className="mt-8">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalRecords={totalRecords}
                  limit={limit}
                />
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6">
            {!selectedUser || !editor ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-[var(--card-border)] bg-[var(--surface-2)] p-6 text-center text-sm text-[var(--muted)]">
                Select a user to edit their access, organizations, status, and password.
              </div>
            ) : (
              <form onSubmit={handleSaveUserSubmit} className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                      Account editor
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">{selectedUser.name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Created {new Date(selectedUser.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--muted)]">
                      {selectedUser.role}
                    </span>
                    <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--muted)]">
                      {selectedUser.status}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        selectedUser.isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {selectedUser.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {(message || error) && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      error
                        ? "border-red-500/20 bg-red-500/8 text-red-400"
                        : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
                    }`}
                  >
                    {error ?? message}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Full name</span>
                    <input
                      value={editor.name}
                      onChange={(event) =>
                        setEditor((current) => (current ? { ...current, name: event.target.value } : current))
                      }
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Email</span>
                    <input
                      value={editor.email}
                      onChange={(event) =>
                        setEditor((current) => (current ? { ...current, email: event.target.value } : current))
                      }
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Role</span>
                    <select
                      value={editor.role}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, role: event.target.value as ManagedUser["role"] } : current
                        )
                      }
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    >
                      <option value="superadmin">Superadmin</option>
                      <option value="admin">Admin</option>
                      <option value="team">Team</option>
                      <option value="client">Client</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Status</span>
                    <select
                      value={editor.status}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, status: event.target.value as ManagedUser["status"] } : current
                        )
                      }
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Primary organization</span>
                    <select
                      value={editor.organizationId}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? {
                                ...current,
                                organizationId: event.target.value,
                                allowedOrganizations: current.allowedOrganizations.filter(
                                  (organizationId) => organizationId !== event.target.value
                                )
                              }
                            : current
                        )
                      }
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    >
                      <option value="">No primary organization</option>
                      {orgs.map((organization) => (
                        <option key={organization._id} value={organization._id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Account active</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Disabled users keep history but lose access.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editor.isActive}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, isActive: event.target.checked } : current
                        )
                      }
                      className="h-4 w-4"
                    />
                  </label>
                </div>

                <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface-2)] p-5">
                  <div>
                    <h3 className="text-lg font-semibold">Organization access</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Select extra organizations the user can switch into from the top bar.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {orgs.map((organization) => {
                      const disabled = organization._id === editor.organizationId;
                      const checked = disabled || editor.allowedOrganizations.includes(organization._id);

                      return (
                        <label
                          key={organization._id}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            checked
                              ? "border-emerald-500/20 bg-emerald-500/8"
                              : "border-[var(--card-border)] bg-[var(--surface)]"
                          }`}
                        >
                          <div>
                            <p className="font-medium">{organization.name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {disabled ? "Primary organization" : "Additional organization access"}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() =>
                              setEditor((current) =>
                                current
                                  ? {
                                      ...current,
                                      allowedOrganizations: current.allowedOrganizations.includes(organization._id)
                                        ? current.allowedOrganizations.filter((value) => value !== organization._id)
                                        : [...current.allowedOrganizations, organization._id]
                                    }
                                  : current
                              )
                            }
                            className="h-4 w-4"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {editor.role === "client" && (
                  <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface-2)] p-5">
                    <div>
                      <h3 className="text-lg font-semibold">Project access</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Select the projects this client is allowed to access.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {orgProjects.map((project) => {
                        const checked = editor.projectIds.includes(project._id);

                        return (
                          <label
                            key={project._id}
                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                              checked
                                ? "border-emerald-500/20 bg-emerald-500/8"
                                : "border-[var(--card-border)] bg-[var(--surface)]"
                            }`}
                          >
                            <div>
                              <p className="font-medium">{project.name}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEditor((current) =>
                                  current
                                    ? {
                                        ...current,
                                        projectIds: current.projectIds.includes(project._id)
                                          ? current.projectIds.filter((value) => value !== project._id)
                                          : [...current.projectIds, project._id]
                                      }
                                    : current
                                )
                              }
                              className="h-4 w-4"
                            />
                          </label>
                        );
                      })}
                      {orgProjects.length === 0 && (
                        <p className="text-xs text-[var(--muted)] col-span-2">No projects found for this organization.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="space-y-2">
                    <span className="text-sm text-[var(--muted)]">Reset password</span>
                    <input
                      type="text"
                      value={passwordDraft}
                      onChange={(event) => setPasswordDraft(event.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={resetPassword}
                    disabled={resettingPassword || !passwordDraft.trim()}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resettingPassword ? "Resetting..." : "Update password"}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save access changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
