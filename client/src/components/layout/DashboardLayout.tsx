"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { motion } from "framer-motion";
import SoftLoader from "@/components/ui/SoftLoader";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useActiveOrganization();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="relative flex min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[var(--accent)]/8 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <SoftLoader
            title="Loading workspace"
            subtitle="Fetching your profile, organization, and navigation before the dashboard appears."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[var(--accent)]/8 rounded-full blur-[140px] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main Area */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <Topbar onMenuToggle={() => setMobileNavOpen((current) => !current)} />

        {/* Page Content */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-5 lg:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
