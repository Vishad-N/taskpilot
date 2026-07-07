"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import api from "@/services/api";

export type MeUser = {
  _id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "team" | "client";
  gender?: "male" | "female" | "not_specified";
  isAccountFrozen?: boolean;
  organizationId?: string;
  allowedOrganizations?: string[];
  activeOrganizationId?: string | null;
  organizations?: Array<{
    _id: string;
    name: string;
  }>;
};

type MeContextValue = {
  user: MeUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const MeContext = createContext<MeContextValue | null>(null);

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const e = error as { response?: { data?: { message?: unknown } } };
    if (typeof e.response?.data?.message === "string") {
      return e.response.data.message;
    }
  }
  return "Unauthorized";
};

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setUser(null);
    setError(null);
    setLoading(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!cancelled) setUser(res.data.user);
      } catch (err: unknown) {
        if (!cancelled) {
          setUser(null);
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refresh();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("taskpilot:account_frozen", refresh);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("taskpilot:account_frozen", refresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({ user, loading, error, refresh }), [user, loading, error, refresh]);

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error("useMe must be used within a MeProvider");
  }
  return context;
}
