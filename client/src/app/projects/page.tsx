"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/services/api";
import { useMe } from "@/hooks/useMe";
import SoftLoader from "@/components/ui/SoftLoader";
import { useToast } from "@/components/ui/ToastProvider";
import { AnimatePresence, motion } from "framer-motion";
import { PencilSimple, Trash } from "@phosphor-icons/react";

interface Project {
  _id: string;
  name: string;
  description: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useMe();
  const { showToast, dismissToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/projects/org-projects");
      setProjects(res.data.projects ?? []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;

    const projectName = name;

    try {
      setCreating(true);
      setCreateError(null);
      await api.post("/projects/create", {
        name,
        description,
        organizationId: organizationId || undefined
      });
      setName("");
      setDescription("");
      setOrganizationId("");
      showToast({
        title: "Project created",
        description: `${projectName} is now part of your workspace.`,
        variant: "success"
      });
      await fetchProjects();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      const message = anyErr?.response?.data?.message ?? "Failed to create project";
      setCreateError(message);
      showToast({
        title: "Project creation failed",
        description: message,
        variant: "error"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleCreate();
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? "");
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editName.trim()) return;

    try {
      setSavingEdit(true);
      await api.patch(`/projects/${editingProject._id}`, {
        name: editName,
        description: editDescription
      });
      setProjects((current) =>
        current.map((project) =>
          project._id === editingProject._id
            ? { ...project, name: editName, description: editDescription }
            : project
        )
      );
      showToast({
        title: "Project updated",
        description: `${editName} was updated successfully.`,
        variant: "success"
      });
      setEditingProject(null);
    } catch (err) {
      const anyErr = err as { response?: { data?: { error?: string; message?: string } } };
      showToast({
        title: "Project update failed",
        description: anyErr?.response?.data?.message ?? anyErr?.response?.data?.error ?? "Could not update the project.",
        variant: "error"
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleUpdateProject();
  };

  const handleDeleteProject = async (project: Project) => {
    const toastId = showToast({
      title: `Delete ${project.name}?`,
      description: "This will also remove its tasks.",
      variant: "error",
      durationMs: 9000,
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            setDeletingId(project._id);
            await api.delete(`/projects/${project._id}`);
            setProjects((current) => current.filter((item) => item._id !== project._id));
            showToast({
              title: "Project deleted",
              description: `${project.name} and its linked tasks were removed.`,
              variant: "success"
            });
          } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; message?: string } } };
            showToast({
              title: "Project delete failed",
              description: anyErr?.response?.data?.message ?? anyErr?.response?.data?.error ?? "Could not delete the project.",
              variant: "error"
            });
          } finally {
            setDeletingId(null);
          }
        }
      },
      secondaryAction: {
        label: "Cancel",
        onClick: () => dismissToast(toastId)
      }
    });

  };

  const canCreate = user?.role === "admin" || user?.role === "superadmin";
  const needsOrgId = user?.role === "superadmin" && !user?.organizationId;

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-6">Projects</h1>

      {canCreate && (
        <div className="bg-[#11161D] p-6 rounded-2xl mb-6">
          <h2 className="text-lg mb-4">Create Project</h2>

          <form onSubmit={handleCreateSubmit} className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0B0F14] p-3 rounded-xl w-full outline-none"
            />

            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#0B0F14] p-3 rounded-xl w-full outline-none"
            />

            {needsOrgId && (
              <input
                type="text"
                placeholder="Organization ID (required for SuperAdmin)"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="bg-[#0B0F14] p-3 rounded-xl w-full outline-none"
              />
            )}

            <button
              type="submit"
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-6 py-3 rounded-xl"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>

          {createError && (
            <p className="text-sm text-red-400 mt-3">{createError}</p>
          )}
        </div>
      )}

      {!canCreate && (
        <p className="text-sm text-gray-400 mb-6">
          Only Admin/SuperAdmin can create projects. Your role is{" "}
          <span className="text-gray-200">{user?.role ?? "unknown"}</span>.
        </p>
      )}

      {loading && (
        <SoftLoader
          title="Loading projects"
          subtitle="Pulling the latest project list and workspace details."
        />
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project._id}
              onClick={() => router.push(`/projects/${project._id}`)}
              className="bg-[#11161D] p-5 rounded-2xl hover:scale-[1.02] transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{project.name}</h3>
                {canCreate && (
                  <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      onClick={() => openEditProject(project)}
                      className="rounded-lg p-2 text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition"
                      title="Edit project"
                    >
                      <PencilSimple size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project)}
                      disabled={deletingId === project._id}
                      className="rounded-lg p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 transition disabled:opacity-50"
                      title="Delete project"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                {project.description || "No description"}
              </p>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setEditingProject(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 bg-[var(--surface)] p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Edit Project</h2>
              <form onSubmit={handleUpdateProjectSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none"
                  placeholder="Project name"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full min-h-28 rounded-2xl border border-[var(--card-border)] bg-[var(--surface-2)] px-4 py-3 outline-none resize-none"
                  placeholder="Description"
                />
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="rounded-2xl px-4 py-2 text-sm text-[var(--muted)] hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition"
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
