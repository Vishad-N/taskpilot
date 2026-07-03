import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, X } from "lucide-react";

export interface ErrorModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function ErrorModal({ open, title, message, onClose }: ErrorModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // Focus the Got it button
      setTimeout(() => buttonRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
        
        // Trap focus
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
              }
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[6px]"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
            aria-describedby="error-modal-message"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#111827] border border-[#EF4444] shadow-[0_20px_50px_rgba(0,0,0,0.45)] rounded-t-[16px] sm:rounded-[16px] p-6 z-10 mx-4 mb-0 sm:mb-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-[#EF4444]" />
                </div>
              </div>
              <div className="flex-1 mt-1">
                <h3 id="error-modal-title" className="text-lg font-semibold text-white mb-2">
                  {title}
                </h3>
                <p id="error-modal-message" className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                ref={buttonRef}
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#EF4444] focus:ring-offset-2 focus:ring-offset-[#111827]"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
