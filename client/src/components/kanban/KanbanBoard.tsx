"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import api from "@/services/api";

interface Task {
  _id: string;
  title: string;
  status: string;
  assignedTo?: {
    _id: string;
    name: string;
  };
  assignedToUsers?: Array<{ _id: string; name: string }>;
}

interface User {
  _id: string;
  name: string;
}

const columns = ["pending", "inprogress", "review", "completed"];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return fallback;
};

export default function KanbanBoard({
  projectId,
  organizationId,
  canCreate = true,
  canUpdateStatus = true
}: {
  projectId: string;
  organizationId?: string;
  canCreate?: boolean;
  canUpdateStatus?: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [title, setTitle] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  // 🔹 Fetch Tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/project/${projectId}`);
      setTasks(res.data.tasks ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  // 🔹 Fetch Team Users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users/assignable", {
        params: organizationId ? { organizationId } : {}
      });
      setUsers(res.data.users ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [organizationId]);

  useEffect(() => {
    const loadBoard = async () => {
      await fetchTasks();
      if (canCreate) {
        await fetchUsers();
      }
    };

    void loadBoard();
  }, [canCreate, fetchTasks, fetchUsers]);

  // 🔹 Create Task
  const createTask = async () => {
    if (!title || assignedToIds.length === 0) return;

    try {
      setCreateError(null);
      await api.post("/tasks/create", {
        title,
        assignedToIds,
        projectId
      });
      setTitle("");
      setAssigneeDraft("");
      setAssignedToIds([]);
      await fetchTasks();
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create task"));
    }
  };

  const handleCreateTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createTask();
  };

  // 🔹 Update Status
  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.patch(`/tasks/update-status/${taskId}`, { status });
      await fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* 🔥 CREATE TASK */}
      {canCreate && (
        <div className="bg-[#0B0F14] p-4 rounded-xl mb-6">
          <h3 className="text-sm mb-3 text-gray-400">Create Task</h3>

          <form onSubmit={handleCreateTaskSubmit} className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#11161D] p-2 rounded w-full outline-none"
            />

            <select
              value={assigneeDraft}
              onChange={(e) => {
                const next = e.target.value;
                setAssigneeDraft(next);
                if (!next) return;
                setAssignedToIds((prev) => (prev.includes(next) ? prev : [...prev, next]));
              }}
              className="bg-[#11161D] p-2 rounded w-full outline-none"
            >
              <option value="">Tag Users</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>

            {assignedToIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assignedToIds.map((id) => {
                  const u = users.find((x) => x._id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAssignedToIds((prev) => prev.filter((x) => x !== id))}
                      className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition"
                      title="Remove"
                    >
                      {u?.name ?? id} ×
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              className="bg-emerald-600 px-4 py-2 rounded"
            >
              Create
            </button>
          </form>
          {createError && (
            <p className="text-sm text-red-400 mt-3">{createError}</p>
          )}
        </div>
      )}

      {/* 🔥 KANBAN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col} className="bg-[#0B0F14] p-4 rounded-xl">
            <h3 className="capitalize mb-4 text-sm text-gray-400">{col}</h3>

            <div className="flex flex-col gap-3">
              {tasks
                .filter((task) => task.status === col)
                .map((task) => (
                  <div
                    key={task._id}
                    className="bg-[#11161D] p-3 rounded-xl"
                  >
                    <p className="text-sm font-medium">{task.title}</p>

                    <p className="text-xs text-gray-400 mt-1">
                      {task.assignedToUsers && task.assignedToUsers.length > 0
                        ? task.assignedToUsers.map((u) => u.name).join(", ")
                        : (task.assignedTo?.name || "Unassigned")}
                    </p>

                    {canUpdateStatus && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {columns.map((c) => (
                          <button
                            key={c}
                            onClick={() => updateStatus(task._id, c)}
                            className="text-xs px-2 py-1 bg-emerald-600 rounded"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
