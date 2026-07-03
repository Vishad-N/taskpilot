"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";

type Organization = {
  _id: string;
  name: string;
};

type Project = {
  _id: string;
  name: string;
};

type UserRecord = {
  _id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "team" | "client";
  status: "pending" | "approved";
  organizationId?: Organization | null;
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

export default function SuperAdminDashboard() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserRecord[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("client");
  const [newUserGender, setNewUserGender] = useState("male");
  const [newUserOrg, setNewUserOrg] = useState("");
  const [newUserAllowedOrgs, setNewUserAllowedOrgs] = useState<string[]>([]);
  const [newUserProjectIds, setNewUserProjectIds] = useState<string[]>([]);
  const [orgProjects, setOrgProjects] = useState<Project[]>([]);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [orgsRes, allUsersRes, pendingUsersRes] = await Promise.all([
        api.get("/organization"),
        api.get("/users/all"),
        api.get("/users/pending")
      ]);

      const organizations = orgsRes.data.organizations ?? [];
      setOrgs(organizations);
      setAllUsers(allUsersRes.data.users ?? []);
      setPendingUsers(pendingUsersRes.data.users ?? []);

      if (!newUserOrg && organizations[0]?._id) {
        setNewUserOrg(organizations[0]._id);
      }
    } finally {
      setLoading(false);
    }
  }, [newUserOrg]);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };

    void run();
  }, [loadData]);

  useEffect(() => {
    if (newUserRole === "client" && newUserOrg) {
      api
        .get(`/projects/org-projects?organizationId=${newUserOrg}&limit=1000`)
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
    setNewUserProjectIds([]);
  }, [newUserOrg, newUserRole]);

  const createOrg = async () => {
    if (!orgName.trim()) {
      return;
    }

    try {
      setCreatingOrg(true);
      setOrgError(null);
      setOrgSuccess(null);
      await api.post("/organization/create", {
        name: orgName,
        description: orgDesc
      });
      setOrgName("");
      setOrgDesc("");
      setOrgSuccess("Organization created.");
      await loadData();
      showToast({
        title: "Organization created",
        description: "The new workspace is ready for admins, team members, and clients.",
        variant: "success"
      });
    } catch (requestError: unknown) {
      const message = getErrorMessage(requestError, "Failed to create organization");
      setOrgError(message);
      showToast({
        title: "Organization creation failed",
        description: message,
        variant: "error"
      });
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleCreateOrgSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createOrg();
  };

  const createUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserRole || !newUserOrg) {
      return;
    }

    try {
      setCreatingUser(true);
      setCreateUserError(null);
      setCreatedCredentials(null);

      const response = await api.post("/users/create", {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        gender: newUserGender,
        organizationId: newUserOrg,
        allowedOrganizations: newUserAllowedOrgs.filter((organizationId) => organizationId !== newUserOrg),
        projectIds: newUserRole === "client" ? newUserProjectIds : [],
        password: newUserPassword || undefined
      });

      setCreatedCredentials(response.data.credentials);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserAllowedOrgs([]);
      setNewUserProjectIds([]);
      await loadData();
      showToast({
        title: "User created",
        description: `An approved ${newUserRole} account is ready to share.`,
        variant: "success"
      });
    } catch (requestError: unknown) {
      const message = getErrorMessage(requestError, "Failed to create user");
      setCreateUserError(message);
      showToast({
        title: "User creation failed",
        description: message,
        variant: "error"
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateUserSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createUser();
  };

  const stats = useMemo(
    () => [
      { label: "Organizations", value: orgs.length },
      { label: "All users", value: allUsers.length },
      { label: "Pending approvals", value: pendingUsers.length },
      { label: "Admins", value: allUsers.filter((user) => user.role === "admin").length }
    ],
    [allUsers, orgs.length, pendingUsers.length]
  );

  const recentUsers = allUsers.slice(0, 5);

  if (loading && orgs.length === 0 && allUsers.length === 0) {
    return (
      <DashboardLayout>
        <SoftLoader
          title="Loading control center"
          subtitle="Bringing organizations, users, and pending approvals into view."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Superadmin / Control Center
          </p>
          <h1 className="text-3xl font-semibold">Access and workspace control</h1>
          <p className="max-w-3xl text-sm text-[var(--muted)]">
            Keep the top-level setup here, then use the dedicated sidebar routes for full user records
            and approval handling.
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

        <div className="grid gap-4 xl:grid-cols-3">
          <Link
            href="/superadmin/users"
            className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6 transition hover:border-emerald-500/25"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">User records</p>
            <h2 className="mt-3 text-2xl font-semibold">Manage every account</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Search users, filter by role and organization, change access, deactivate accounts, and reset passwords.
            </p>
          </Link>

          <Link
            href="/superadmin/approvals"
            className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6 transition hover:border-emerald-500/25"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Approvals</p>
            <h2 className="mt-3 text-2xl font-semibold">Review pending signups</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Assign role, set primary organization, and grant multi-organization access during approval.
            </p>
          </Link>

          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Quick status</p>
            <h2 className="mt-3 text-2xl font-semibold">Latest account activity</h2>
            <div className="mt-4 space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No users found yet.</p>
              ) : (
                recentUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between rounded-2xl bg-[var(--surface-2)] px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-[var(--muted)]">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      {user.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Create organization</h2>
              <p className="text-sm text-[var(--muted)]">
                Add a new workspace before assigning admins, teams, or clients to it.
              </p>
            </div>

            <form onSubmit={handleCreateOrgSubmit} className="mt-5 space-y-4">
              <input
                type="text"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                placeholder="Organization name"
                className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
              />
              <input
                type="text"
                value={orgDesc}
                onChange={(event) => setOrgDesc(event.target.value)}
                placeholder="Description"
                className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
              />
              {(orgSuccess || orgError) && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    orgError
                      ? "border-red-500/20 bg-red-500/8 text-red-400"
                      : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
                  }`}
                >
                  {orgError ?? orgSuccess}
                </div>
              )}
              <button
                type="submit"
                disabled={creatingOrg}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {creatingOrg ? "Creating organization..." : "Create organization"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Create user directly</h2>
              <p className="text-sm text-[var(--muted)]">
                Provision an approved account with ready-to-share credentials and preconfigured organization access.
              </p>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                />
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <select
                  value={newUserRole}
                  onChange={(event) => setNewUserRole(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                >
                  <option value="client">Client</option>
                  <option value="team">Team</option>
                  <option value="admin">Admin</option>
                </select>

                <select
                  value={newUserGender}
                  onChange={(event) => setNewUserGender(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>

                <select
                  value={newUserOrg}
                  onChange={(event) => setNewUserOrg(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                >
                  <option value="">Select primary organization</option>
                  {orgs.map((organization) => (
                    <option key={organization._id} value={organization._id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
                <p className="text-sm font-medium">Additional organization access</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {orgs.map((organization) => {
                    const disabled = organization._id === newUserOrg;
                    const checked = disabled || newUserAllowedOrgs.includes(organization._id);

                    return (
                      <label
                        key={organization._id}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                          checked
                            ? "border-emerald-500/20 bg-emerald-500/8"
                            : "border-[var(--card-border)] bg-[var(--surface)]"
                        }`}
                      >
                        <span>{organization.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() =>
                            setNewUserAllowedOrgs((current) =>
                              current.includes(organization._id)
                                ? current.filter((value) => value !== organization._id)
                                : [...current, organization._id]
                            )
                          }
                          className="h-4 w-4"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {newUserRole === "client" && (
                <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface-2)] p-4">
                  <p className="text-sm font-medium">Project Access</p>
                  <p className="text-xs text-[var(--muted)] mb-3">Select the projects this client is allowed to access.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {orgProjects.map((project) => {
                      const checked = newUserProjectIds.includes(project._id);
                      return (
                        <label
                          key={project._id}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            checked
                              ? "border-emerald-500/20 bg-emerald-500/8"
                              : "border-[var(--card-border)] bg-[var(--surface)]"
                          }`}
                        >
                          <span>{project.name}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setNewUserProjectIds((current) =>
                                current.includes(project._id)
                                  ? current.filter((value) => value !== project._id)
                                  : [...current, project._id]
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

              <input
                type="text"
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
                placeholder="Password (leave blank to auto-generate)"
                className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
              />

              {createUserError && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                  {createUserError}
                </div>
              )}

              {createdCredentials && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-400">
                  Login created: {createdCredentials.email} / {createdCredentials.password}
                </div>
              )}

              <button
                type="submit"
                disabled={creatingUser}
                className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {creatingUser ? "Creating user..." : "Create user"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
