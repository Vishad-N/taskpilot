"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, UserPlus, Envelope, Lock, IdentificationBadge } from "@phosphor-icons/react";
import Link from "next/link";
import api from "@/services/api";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/ui/ToastProvider";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const register = async () => {
    try {
      setLoading(true);
      setError(null);

      await api.post("/auth/register", {
        name,
        email,
        password
      });

      showToast({
        title: "Request submitted",
        description: "Your registration was sent for approval. You can log in after a superadmin approves it.",
        variant: "success"
      });
      setName("");
      setEmail("");
      setPassword("");
    } catch {
      const message = "Registration failed. Please check your details and try again.";
      setError(message);
      showToast({
        title: "Registration failed",
        description: message,
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await register();
  };

  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] font-sans text-[var(--foreground)]">
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[120px]" />

      <button
        onClick={toggleTheme}
        className="glass absolute top-6 right-6 z-20 rounded-2xl p-3 text-gray-400 transition hover:text-white"
        aria-label="Toggle theme"
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="group relative z-10 w-[500px] rounded-[2.5rem] border border-white/5 bg-[var(--surface)] p-12 shadow-3xl shadow-black/50 backdrop-blur-3xl transition-all hover:border-emerald-500/20">
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 shadow-xl shadow-emerald-500/10 transition-transform duration-300 group-hover:scale-110">
            <UserPlus weight="fill" className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="font-display text-center text-3xl font-black tracking-tighter text-white italic">
            TASK<span className="text-emerald-500">PILOT</span>
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.4em] text-gray-600">
            Initialization Protocol
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="font-display mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Operator Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  className="w-full rounded-2xl border border-white/5 bg-[var(--surface-2)] p-4 pl-12 text-sm font-bold text-white outline-none transition-all placeholder:text-gray-700 focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Full Name"
                  onChange={(event) => setName(event.target.value)}
                />
                <IdentificationBadge
                  className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-700"
                  weight="fill"
                />
              </div>
            </div>

            <div>
              <label className="font-display mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Communication Uplink
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  className="w-full rounded-2xl border border-white/5 bg-[var(--surface-2)] p-4 pl-12 text-sm font-bold text-white outline-none transition-all placeholder:text-gray-700 focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="email@taskpilot.io"
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Envelope
                  className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-700"
                  weight="fill"
                />
              </div>
            </div>

            <div>
              <label className="font-display mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Secure Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  className="w-full rounded-2xl border border-white/5 bg-[var(--surface-2)] p-4 pl-12 text-sm font-bold text-white outline-none transition-all placeholder:text-gray-700 focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Password"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Lock
                  className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-700"
                  weight="fill"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group/btn relative mt-4 flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-emerald-600 px-6 py-4 text-xs font-black tracking-widest text-white uppercase shadow-2xl shadow-emerald-500/20 transition-all active:scale-[0.98] hover:bg-emerald-500 disabled:opacity-50"
          >
            <span className="relative z-10">{loading ? "Submitting..." : "Request Access"}</span>
            {!loading && (
              <ArrowRight
                weight="bold"
                className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1"
              />
            )}
            <div className="absolute inset-0 -translate-x-[200%] bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover/btn:translate-x-[200%]" />
          </button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/5 pt-8">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600">
            <span>Already Authorized?</span>
            <Link
              href="/login"
              className="text-emerald-500 underline decoration-2 underline-offset-4 transition-colors hover:text-emerald-400"
            >
              Access Portal
            </Link>
          </div>
          <div className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-700 opacity-40 transition-opacity hover:opacity-100">
            Simbolo Multimedia
          </div>
        </div>
      </div>
    </div>
  );
}
