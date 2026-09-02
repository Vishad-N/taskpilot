"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

type SearchHandlerProps = {
  setShowCreate: (value: boolean) => void;
  setFormData: (
    value: TaskCreateFormState | ((current: TaskCreateFormState) => TaskCreateFormState)
  ) => void;
};

type TaskCreateFormState = {
  title: string;
  description: string;
  projectId: string;
  assignedToIds: string[];
  priority: string;
  startDate: string;
  endDate: string;
  deadlineDate: string;
  clientVisible: boolean;
  attachments: any[];
};

export default function SearchHandler({
  setShowCreate,
  setFormData
}: SearchHandlerProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreate(true);

      const pid = searchParams.get("projectId");
      if (pid) {
        setFormData((current) => ({ ...current, projectId: pid }));
      }
    }
  }, [searchParams, setShowCreate, setFormData]);

  return null; // no UI
}
