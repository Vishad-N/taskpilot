"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { Sun, Moon } from "lucide-react";
import Image from "next/image";
import { useTheme } from "@/hooks/useTheme";

export default function Home() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[120px]" />

      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-3 rounded-2xl glass text-gray-400 hover:text-white transition"
        aria-label="Toggle theme"
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="max-w-4xl w-full glass-card rounded-[3rem] shadow-3xl overflow-hidden border border-white/5 transition-all hover:shadow-emerald-500/10 relative z-10">
        <div className="flex flex-col md:flex-row">
          <div className="bg-white/2 backdrop-blur-3xl p-16 flex flex-col justify-center items-center md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 group">
            <div className="w-20 h-20 bg-white rounded-4xl flex items-center justify-center mb-8 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
              <Image src="/logo.png" alt="TaskPilot icon" width={52} height={52} className="h-13 w-13 object-contain" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter text-white italic font-display">TASK<span className="text-emerald-500">PILOT</span></h2>
          </div>
          
          <div className="p-16 md:w-2/3 flex flex-col justify-center relative">
            <div className="uppercase tracking-[0.4em] text-[10px] text-emerald-500 font-black mb-6 font-display opacity-80">
              Strategic Task Orchestration
            </div>
            <h1 className="text-5xl font-black text-white tracking-tight leading-[1.05] mb-8 font-display">
              Navigate your workspace with <span className="text-emerald-500 italic">absolute precision.</span>
            </h1>
            <p className="text-gray-500 leading-relaxed mb-12 text-lg font-medium opacity-80">
              A high-velocity, intelligent management system designed for teams that demand maximum operational efficiency and minimal friction.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-5">
              <a
                href="/login"
                className="bg-emerald-600 text-white hover:bg-emerald-500 px-10 py-5 rounded-2xl font-black text-center transition-all shadow-2xl shadow-emerald-500/20 active:scale-[0.98] flex-1 flex items-center justify-center gap-3 uppercase tracking-widest text-xs group"
              >
                <span>Login</span>
                <ArrowRight weight="bold" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="/register"
                className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-10 py-5 rounded-2xl font-black text-center transition-all active:scale-[0.98] flex-1 uppercase tracking-widest text-xs"
              >
                Initialization
              </a>
            </div>

            <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between opacity-40">
               <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">TaskPilot Protocol © 2026</div>
               <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Simbolo Multimedia</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
