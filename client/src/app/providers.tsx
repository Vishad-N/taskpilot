"use client";

import { MeProvider } from "@/hooks/useMe";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import GenderOnboardingModal from "@/components/ui/GenderOnboardingModal";
import AccountFreezeModal from "@/components/ui/AccountFreezeModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider>
      <ToastProvider>
        <NotificationProvider>
          <GenderOnboardingModal />
          <AccountFreezeModal />
          {children}
        </NotificationProvider>
      </ToastProvider>
    </MeProvider>
  );
}
