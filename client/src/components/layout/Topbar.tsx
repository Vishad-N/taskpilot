"use client";

import { Bell, User as UserIcon, LogOut, ChevronDown, Sun, Moon, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { useTheme } from "@/hooks/useTheme";
import { useMe } from "@/hooks/useMe";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const router = useRouter();
  const {
    user,
    activeOrganization,
    activeOrganizationId,
    organizations,
    hasMultipleOrganizations,
    updateActiveOrganization
  } = useActiveOrganization();
  const { isDark, toggleTheme } = useTheme();
  const { refresh } = useMe();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const initial = useMemo(() => {
    const n = user?.name?.trim();
    return n ? n[0].toUpperCase() : "?";
  }, [user?.name]);

  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout");
      localStorage.removeItem("token");
      localStorage.removeItem("taskpilot.activeOrganizationId");
      refresh();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/5 glass">
      <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <button
            onClick={onMenuToggle}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/5 bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Open navigation menu"
            title="Open navigation menu"
          >
            <Menu size={18} />
          </button>

          {(activeOrganization || hasMultipleOrganizations) ? (
            <div className="min-w-0 max-w-full flex-1 rounded-[1.35rem] border border-white/5 bg-white/5 px-4 py-3 sm:max-w-[24rem]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                Active Organization
              </p>
              {hasMultipleOrganizations ? (
                <select
                  value={activeOrganizationId ?? ""}
                  onChange={(event) => {
                    updateActiveOrganization(event.target.value);
                    window.location.reload();
                  }}
                  className="w-full min-w-0 bg-transparent text-sm text-white outline-none"
                >
                  {organizations.map((organization) => (
                    <option key={organization._id} value={organization._id} className="bg-[#06090D]">
                      {organization.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-sm font-semibold text-white">
                  {activeOrganization?.name ?? "No organization"}
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-5">
          <button
            onClick={toggleTheme}
            className="rounded-[1.1rem] border border-white/5 bg-white/5 p-2.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => router.push("/notifications")}
            className="group relative rounded-[1.1rem] border border-white/5 bg-white/5 p-2.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            title="Open notifications"
            aria-label="Open notifications"
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full border-2 border-[var(--background)] bg-emerald-500 transition-transform group-hover:scale-110" />
          </button>

          <div className="mx-1 hidden h-8 w-px bg-white/5 md:block" />

          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="group flex max-w-full items-center gap-3 rounded-[1.2rem] py-1.5 pl-2 pr-2 transition-all duration-300 hover:bg-white/5 sm:pr-3"
              aria-label="User menu"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-linear-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-105">
                {initial}
              </div>
              <div className="hidden min-w-0 text-left md:block">
                <p className="text-xs font-bold leading-none text-white">{user?.name ?? "User"}</p>
                <p className="mt-1 text-[10px] capitalize leading-none text-gray-500">{user?.role ?? "Member"}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {open && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-[2rem] border shadow-2xl"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--card-border)",
                      boxShadow: "0 24px 64px rgba(15, 23, 18, 0.18)"
                    }}
                  >
                    <div className="border-b px-5 py-5" style={{ borderColor: "var(--card-border)" }}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-linear-to-br from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold" style={{ color: "var(--foreground)" }}>
                            {user?.name ?? "User"}
                          </p>
                          <p className="mt-1 truncate text-xs" style={{ color: "var(--muted)" }}>
                            {user?.email ?? ""}
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">
                              {user?.role ?? "Member"}
                            </span>
                            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                              {activeOrganization?.name ?? "No active organization"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3">
                      <button
                        onClick={() => {
                          setOpen(false);
                          router.push("/users/profile");
                        }}
                        className="group flex w-full items-center gap-3 rounded-[1.35rem] px-4 py-3 text-left text-sm transition-all"
                        style={{ color: "var(--muted)" }}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-black/5 transition-colors group-hover:bg-emerald-500/10 dark:bg-white/5">
                          <UserIcon className="h-4 w-4 text-gray-500 transition-colors group-hover:text-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold transition-colors group-hover:text-[var(--foreground)]">
                            Profile Settings
                          </p>
                          <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                            Update your name, email, and password
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={logout}
                        disabled={loading}
                        className="group mt-1 flex w-full items-center gap-3 rounded-[1.35rem] px-4 py-3 text-left text-sm text-red-500/80 transition-all hover:bg-red-500/6 hover:text-red-500"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-red-500/8 transition-colors group-hover:bg-red-500/12">
                          <LogOut className="h-4 w-4 text-red-500/55 group-hover:text-red-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{loading ? "Logging out..." : "Sign Out"}</p>
                          <p className="mt-0.5 text-[11px] text-red-500/60">End this session safely</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
