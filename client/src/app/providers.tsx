"use client";

import { MeProvider } from "@/hooks/useMe";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider>
      <ToastProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </ToastProvider>
    </MeProvider>
  );
}
