"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { motion } from "framer-motion";
import api from "@/services/api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useMe } from "@/hooks/useMe";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { refresh } = useMe();

  const login = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/login", {
        email,
        password
      });
      refresh(); // Clear stale user state and re-fetch for the new session
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }

    await login();
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-3 rounded-2xl glass text-gray-400 hover:text-white transition"
        aria-label="Toggle theme"
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="bg-[var(--surface)] border border-white/5 p-12 rounded-[2.5rem] w-[450px] shadow-3xl shadow-black/50 backdrop-blur-3xl relative z-10 transition-all hover:border-emerald-500/20 group">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-emerald-500/10 shadow-xl group-hover:scale-110 transition-transform duration-300">
            <Image src="/logo.png" alt="TaskPilot icon" width={38} height={38} className="h-9 w-9 object-contain" />
          </div>
          <h1 className="text-3xl font-black mb-2 text-center text-[var(--foreground)] tracking-tighter italic font-display">
            TASK<span className="text-emerald-500">PILOT</span>
          </h1>
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em]">Authorization Protocol</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 mb-2 block font-display">Credential ID</label>
            <input
              type="email"
              value={email}
              className="bg-[var(--surface-2)] border border-white/5 p-4 w-full rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-gray-700 text-white font-bold text-sm"
              placeholder="operator@taskpilot.io"
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 mb-2 block font-display">Access Key</label>
            <input
              type="password"
              value={password}
              className="bg-[var(--surface-2)] border border-white/5 p-4 w-full rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-gray-700 text-white font-bold text-sm"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group/btn relative bg-emerald-600 hover:bg-emerald-500 text-white w-full py-4 px-6 rounded-2xl font-black tracking-widest text-xs uppercase disabled:opacity-50 transition-all shadow-2xl shadow-emerald-500/20 active:scale-[0.98] mt-4 flex items-center justify-center gap-3 overflow-hidden"
          >
            <span className="relative z-10">{loading ? "Synchronizing..." : "Initiate Access"}</span>
            {!loading && <ArrowRight weight="bold" className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform relative z-10" />}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-[200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000" />
          </button>
        </form>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/5 text-red-500 p-4 rounded-2xl mt-8 text-[11px] font-black uppercase tracking-widest flex items-center gap-3 border border-red-500/10 shadow-lg shadow-red-500/2"
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            {error}
          </motion.div>
        )}

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600 text-[10px] font-bold">
            <span>New Operator?</span>
            <Link href="/register" className="text-emerald-500 hover:text-emerald-400 transition-colors underline underline-offset-4 decoration-2">Request Credentials</Link>
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-700 opacity-40 hover:opacity-100 transition-opacity cursor-default mt-2">
            Simbolo Multimedia
          </div>
        </div>
      </div>
    </div>
  );
}
