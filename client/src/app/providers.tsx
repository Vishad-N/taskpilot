"use client";

import { MeProvider } from "@/hooks/useMe";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider>
      <ToastProvider>{children}</ToastProvider>
    </MeProvider>
  );
}
