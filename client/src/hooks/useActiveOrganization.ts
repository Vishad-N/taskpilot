"use client";

import { useEffect, useMemo, useState } from "react";
import { useMe } from "./useMe";

const STORAGE_KEY = "taskpilot.activeOrganizationId";

export function useActiveOrganization() {
  const { user, loading, error } = useMe();
  const organizations = user?.organizations ?? [];
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const validOrganizationIds = new Set(organizations.map((organization) => organization._id));
    const storedOrganizationId =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

    const nextOrganizationId =
      storedOrganizationId && validOrganizationIds.has(storedOrganizationId)
        ? storedOrganizationId
        : user.activeOrganizationId || organizations[0]?._id || null;

    setSelectedOrganizationId(nextOrganizationId);

    if (typeof window !== "undefined") {
      if (nextOrganizationId) {
        window.localStorage.setItem(STORAGE_KEY, nextOrganizationId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [user, organizations]);

  const activeOrganization = useMemo(() => {
    return organizations.find((organization) => organization._id === selectedOrganizationId) || null;
  }, [organizations, selectedOrganizationId]);

  const updateActiveOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, organizationId);
    }
  };

  return {
    user,
    loading,
    error,
    organizations,
    activeOrganization,
    activeOrganizationId: selectedOrganizationId,
    updateActiveOrganization,
    hasMultipleOrganizations: organizations.length > 1
  };
}

