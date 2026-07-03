"use client";

import { useState, useEffect } from "react";
import { useMe } from "@/hooks/useMe";
import { usePathname } from "next/navigation";
import { GenderIntersex, GenderMale, GenderFemale } from "@phosphor-icons/react";
import api from "@/services/api";
import { useToast } from "@/components/ui/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function GenderOnboardingModal() {
  const { user, refresh } = useMe();
  const pathname = usePathname();
  const { showToast } = useToast();
  
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Don't show on public pages
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  // Only show if user is loaded and gender is not_specified
  const isVisible = user && user.gender === "not_specified";

  const handleSubmit = async () => {
    if (!selectedGender) return;
    
    setSubmitting(true);
    try {
      await api.patch("/auth/me/gender", { gender: selectedGender });
      
      showToast({
        title: "Profile Updated",
        description: "Your gender has been successfully saved.",
        variant: "success",
      });
      
      refresh(); // Reload user context to hide the modal
    } catch (error: any) {
      showToast({
        title: "Update Failed",
        description: error.response?.data?.message || "Failed to save gender.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-white/10 bg-[var(--surface)] shadow-2xl shadow-black/50"
          >
            <div className="p-10 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20">
                <GenderIntersex weight="duotone" className="h-10 w-10 text-emerald-400" />
              </div>
              
              <h2 className="mb-3 text-2xl font-black text-white">Complete Your Profile</h2>
              <p className="mb-8 text-sm text-gray-400">
                To continue using TaskPilot and access all features including our leave management system, please select your gender. 
                <strong className="text-emerald-400 block mt-2">This is a one-time selection and cannot be changed later.</strong>
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => setSelectedGender("male")}
                  className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-[1.5rem] border p-6 transition-all ${
                    selectedGender === "male"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/5 bg-[var(--surface-2)] hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <GenderMale 
                    weight={selectedGender === "male" ? "fill" : "duotone"} 
                    className={`h-10 w-10 ${selectedGender === "male" ? "text-emerald-400" : "text-gray-400 group-hover:text-gray-300"}`} 
                  />
                  <span className={`font-bold ${selectedGender === "male" ? "text-emerald-400" : "text-gray-400 group-hover:text-gray-300"}`}>
                    Male
                  </span>
                  {selectedGender === "male" && (
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-[1.5rem] pointer-events-none" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedGender("female")}
                  className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-[1.5rem] border p-6 transition-all ${
                    selectedGender === "female"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/5 bg-[var(--surface-2)] hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <GenderFemale 
                    weight={selectedGender === "female" ? "fill" : "duotone"} 
                    className={`h-10 w-10 ${selectedGender === "female" ? "text-emerald-400" : "text-gray-400 group-hover:text-gray-300"}`} 
                  />
                  <span className={`font-bold ${selectedGender === "female" ? "text-emerald-400" : "text-gray-400 group-hover:text-gray-300"}`}>
                    Female
                  </span>
                  {selectedGender === "female" && (
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-[1.5rem] pointer-events-none" />
                  )}
                </button>
              </div>

              <button
                type="button"
                disabled={!selectedGender || submitting}
                onClick={handleSubmit}
                className="group relative w-full overflow-hidden rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="relative z-10">{submitting ? "Saving..." : "Save Selection & Continue"}</span>
                <div className="absolute inset-0 -translate-x-[200%] bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-[200%]" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
