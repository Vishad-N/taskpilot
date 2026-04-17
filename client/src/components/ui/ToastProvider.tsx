"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, RotateCcw, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
  secondaryAction?: ToastAction;
};

type ToastRecord = ToastInput & {
  id: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<
  ToastVariant,
  {
    icon: typeof CheckCircle2;
    iconClass: string;
    accent: string;
    border: string;
    background: string;
    tile: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    accent: "#14b87a",
    border: "rgba(20, 184, 122, 0.24)",
    background: "color-mix(in srgb, var(--surface) 88%, #14b87a 12%)",
    tile: "color-mix(in srgb, var(--surface-2) 82%, #14b87a 18%)"
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-red-500",
    accent: "#ef4444",
    border: "rgba(239, 68, 68, 0.24)",
    background: "color-mix(in srgb, var(--surface) 90%, #ef4444 10%)",
    tile: "color-mix(in srgb, var(--surface-2) 84%, #ef4444 16%)"
  },
  info: {
    icon: Info,
    iconClass: "text-sky-500",
    accent: "#38bdf8",
    border: "rgba(56, 189, 248, 0.22)",
    background: "color-mix(in srgb, var(--surface) 90%, #38bdf8 10%)",
    tile: "color-mix(in srgb, var(--surface-2) 84%, #38bdf8 16%)"
  }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutMap = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    const timeout = timeoutMap.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMap.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast: ToastRecord = {
      variant: "info",
      durationMs: 4500,
      ...toast,
      id
    };

    setToasts((current) => [...current.slice(-2), nextToast]);

    const timeout = setTimeout(() => dismissToast(id), nextToast.durationMs);
    timeoutMap.current.set(id, timeout);

    return id;
  }, [dismissToast]);

  useEffect(() => {
    const timeoutEntries = timeoutMap.current;

    return () => {
      timeoutEntries.forEach((timeout) => clearTimeout(timeout));
      timeoutEntries.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = variantStyles[toast.variant ?? "info"];
            const Icon = style.icon;

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="pointer-events-auto overflow-hidden rounded-[1.6rem] border px-4 py-4 shadow-2xl backdrop-blur-xl"
                style={{
                  borderColor: style.border,
                  background: `linear-gradient(180deg, ${style.background}, color-mix(in srgb, ${style.background} 88%, transparent))`,
                  boxShadow: `0 20px 50px -30px ${style.accent}33`
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 rounded-2xl p-2"
                    style={{ background: style.tile, border: `1px solid ${style.border}` }}
                  >
                    <Icon className={`h-4 w-4 ${style.iconClass}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--foreground)]">{toast.title}</p>
                    {toast.description && (
                      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{toast.description}</p>
                    )}

                    {(toast.action || toast.secondaryAction) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {toast.action && (
                          <button
                            onClick={async () => {
                              await toast.action?.onClick();
                              dismissToast(toast.id);
                            }}
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition"
                            style={{
                              border: `1px solid ${style.border}`,
                              background: style.tile,
                              color: "var(--foreground)"
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {toast.action.label}
                          </button>
                        )}

                        {toast.secondaryAction && (
                          <button
                            onClick={async () => {
                              await toast.secondaryAction?.onClick();
                              dismissToast(toast.id);
                            }}
                            className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition"
                            style={{
                              border: `1px solid ${style.border}`,
                              background: "transparent",
                              color: "var(--muted)"
                            }}
                          >
                            {toast.secondaryAction.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-full p-1.5 text-[var(--muted)] transition"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
