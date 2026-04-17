"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/useMe";
import SoftLoader from "@/components/ui/SoftLoader";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace(`/dashboards/${user.role}`);
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
      <SoftLoader />
    </div>
  );
}
