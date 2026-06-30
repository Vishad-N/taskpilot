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

type PendingUser = {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
};

type ApprovalDraft = {
  role: "admin" | "team" | "client";
  organizationId: string;
  allowedOrganizations: string[];
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

export default function SuperAdminApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ApprovalDraft>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = usePaginationLimit();
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const buildDefaultDraft = (organizationId: string): ApprovalDraft => ({
    role: "team",
    organizationId,
    allowedOrganizations: []
  });

  const loadData = useCallback(async (currentPage = 1) => {
    try {
      setLoading(true);
      const [pendingRes, orgsRes] = await Promise.all([
        api.get(`/users/pending?page=${currentPage}&limit=${limit}`),
        api.get("/organization")
      ]);

      const organizations = orgsRes.data.organizations ?? [];
      const defaultOrganizationId = organizations[0]?._id ?? "";
      const pendingUsers = pendingRes.data.users ?? [];

      setUsers(pendingUsers);
      setTotalPages(pendingRes.data.totalPages ?? 1);
      setTotalRecords(pendingRes.data.totalRecords ?? 0);
      setOrgs(organizations);
      setDrafts((current) => {
        const nextDrafts = { ...current };

        pendingUsers.forEach((user: PendingUser) => {
          if (!nextDrafts[user._id]) {
            nextDrafts[user._id] = buildDefaultDraft(defaultOrganizationId);
          }
        });

        return nextDrafts;
      });
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Failed to load approvals"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const run = async () => {
      await loadData(page);
    };

    void run();
  }, [loadData, page]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (!query) {
        return true;
      }

      return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    });
  }, [search, users]);

  const approveUser = async (userId: string) => {
    const draft = drafts[userId];

    if (!draft?.organizationId) {
      setError("Select a primary organization before approving.");
      return;
    }

    try {
      setSubmittingId(userId);
      setMessage(null);
      setError(null);

      await api.patch("/users/approve", {
        userId,
        role: draft.role,
        organizationId: draft.organizationId,
        allowedOrganizations: draft.allowedOrganizations.filter(
          (organizationId) => organizationId !== draft.organizationId
        )
      });

      setUsers((current) => current.filter((user) => user._id !== userId));
      setMessage("User approved and added to access control.");
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Failed to approve user"));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleApproveSubmit = async (event: FormEvent<HTMLFormElement>, userId: string) => {
    event.preventDefault();
    await approveUser(userId);
  };

  const stats = useMemo(
    () => [
      { label: "Pending approvals", value: users.length },
      { label: "Organizations ready", value: orgs.length },
      {
        label: "Admin approvals",
        value: Object.values(drafts).filter((draft) => draft.role === "admin").length
      }
    ],
    [drafts, orgs.length, users.length]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Superadmin / Approvals
          </p>
          <h1 className="text-3xl font-semibold">Approval queue</h1>
          <p className="max-w-3xl text-sm text-[var(--muted)]">
            Review new signups, assign their role, pick the primary organization, and grant
            extra organization access before they enter the workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
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
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pending users by name or email"
            className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
          />
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

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
              Loading pending users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
              No pending approvals remain.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const draft = drafts[user._id] ?? buildDefaultDraft(orgs[0]?._id ?? "");

              return (
                <form
                  key={user._id}
                  onSubmit={(event) => void handleApproveSubmit(event, user._id)}
                  className="rounded-3xl border border-[var(--card-border)] bg-[var(--surface)] p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xl font-semibold">{user.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Requested {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-2">
                        <span className="text-sm text-[var(--muted)]">Role</span>
                        <select
                          value={draft.role}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [user._id]: {
                                ...draft,
                                role: event.target.value as ApprovalDraft["role"]
                              }
                            }))
                          }
                          className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                        >
                          <option value="team">Team</option>
                          <option value="client">Client</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>

                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm text-[var(--muted)]">Primary organization</span>
                        <select
                          value={draft.organizationId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [user._id]: {
                                ...draft,
                                organizationId: event.target.value,
                                allowedOrganizations: draft.allowedOrganizations.filter(
                                  (organizationId) => organizationId !== event.target.value
                                )
                              }
                            }))
                          }
                          className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                        >
                          <option value="">Select organization</option>
                          {orgs.map((organization) => (
                            <option key={organization._id} value={organization._id}>
                              {organization.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-[var(--card-border)] bg-[var(--surface-2)] p-5">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold">Additional organization access</h3>
                      <p className="text-sm text-[var(--muted)]">
                        These organizations become selectable after login.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {orgs.map((organization) => {
                        const disabled = organization._id === draft.organizationId;
                        const checked = disabled || draft.allowedOrganizations.includes(organization._id);

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
                                {disabled ? "Primary organization" : "Switchable workspace"}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() =>
                                setDrafts((current) => ({
                                  ...current,
                                  [user._id]: {
                                    ...draft,
                                    allowedOrganizations: draft.allowedOrganizations.includes(organization._id)
                                      ? draft.allowedOrganizations.filter((value) => value !== organization._id)
                                      : [...draft.allowedOrganizations, organization._id]
                                  }
                                }))
                              }
                              className="h-4 w-4"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingId === user._id}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingId === user._id ? "Approving..." : "Approve user"}
                    </button>
                  </div>
                </form>
              );
            })
          )}

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
      </div>
    </DashboardLayout>
  );
}
