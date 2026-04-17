import { Suspense } from "react";
import TasksPageContent from "./TasksPageContent";
import SoftLoader from "@/components/ui/SoftLoader";

export default function Page() {
  return (
    <Suspense fallback={<SoftLoader title="Loading tasks" subtitle="Preparing your task board and filters." />}>
      <TasksPageContent />
    </Suspense>
  );
}
