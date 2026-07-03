import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

export interface SuccessModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoCloseDuration?: number;
}

export default function SuccessModal({ open, title, message, onClose, autoCloseDuration = 3000 }: SuccessModalProps) {
  
  useEffect(() => {
    if (open && autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [open, onClose, autoCloseDuration]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          {/* Backdrop (invisible but blocks clicks if needed, here we let it pass through for toasts) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/10 backdrop-blur-[2px] pointer-events-auto"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#111827] border border-[#10B981] shadow-[0_20px_50px_rgba(0,0,0,0.45)] rounded-[16px] p-5 z-10 mx-4 mb-4 sm:mb-auto pointer-events-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4 pr-6">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                </div>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {title}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
