"use client";

import { FormEvent, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useMe } from "@/hooks/useMe";
import api from "@/services/api";
import { useToast } from "@/components/ui/ToastProvider";
import { Lock, Mail, Save, User as UserIcon } from "lucide-react";

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

export default function ProfileSettingsPage() {
  const { user, refresh } = useMe();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: ""
    });
  }, [user?.email, user?.name]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSaving(true);
      await api.patch("/auth/me", {
        name: form.name,
        email: form.email,
        password: form.password || undefined
      });
      refresh();
      setForm((current) => ({
        ...current,
        password: ""
      }));
      showToast({
        title: "Profile updated",
        description: "Your account details have been saved.",
        variant: "success"
      });
    } catch (error: unknown) {
      showToast({
        title: "Update failed",
        description: getErrorMessage(error, "We could not update your profile right now."),
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold italic tracking-tight text-white">Profile Settings</h1>
          <p className="mt-2 text-sm text-gray-400">
            Update your personal details and change your password whenever needed.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-white/8 bg-[#11161D] p-8 shadow-sm"
        >
          <div className="space-y-6">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                Full Name
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <UserIcon className="h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))}
                  className="w-full bg-transparent text-sm text-white outline-none"
                  placeholder="Your name"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                Email Address
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <Mail className="h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value
                    }))}
                  className="w-full bg-transparent text-sm text-white outline-none"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">
                New Password
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <Lock className="h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value
                    }))}
                  className="w-full bg-transparent text-sm text-white outline-none"
                  placeholder="Leave blank to keep your current password"
                />
              </div>
              <p className="text-xs text-gray-500">
                Use at least 6 characters if you want to change your password.
              </p>
            </label>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/5 pt-6">
            <div>
              <p className="text-sm font-semibold text-white">{user?.role ?? "Member"}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                Current account role
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
