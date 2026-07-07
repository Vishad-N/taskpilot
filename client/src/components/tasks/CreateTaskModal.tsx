"use client";

import { useEffect, useState } from "react";
import api from "@/services/api";

type AssignableUser = {
  _id: string;
  name: string;
  role?: string;
  email?: string;
};

export default function CreateTaskModal({
  refresh
}: {
  refresh: () => void | Promise<void>;
}) {

  const [open,setOpen] = useState(false);

  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");

  const [team,setTeam] = useState<AssignableUser[]>([]);
  const [assigneeDraft,setAssigneeDraft] = useState("");
  const [assignedToIds,setAssignedToIds] = useState<string[]>([]);

  useEffect(()=>{

    api.get("/users/assignable")
      .then(res=>setTeam((res.data.users ?? []) as AssignableUser[]));

  },[]);

  const createTask = async()=>{

    await api.post("/tasks/create",{
      title,
      description,
      assignedToIds
    });

    setOpen(false);
    setTitle("");
    setDescription("");
    setAssigneeDraft("");
    setAssignedToIds([]);

    refresh();

  };

  return(

    <>
      <button
        onClick={()=>setOpen(true)}
        className="bg-emerald-600 text-white px-4 py-2 rounded"
      >
        + Create Task
      </button>

      {open && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white text-black p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">

            <h2 className="text-xl font-bold mb-4">
              Create Task
            </h2>

            <input
              className="border p-2 w-full mb-3"
              placeholder="Task title"
              value={title}
              onChange={e=>setTitle(e.target.value)}
            />

            <textarea
              className="border p-2 w-full mb-3"
              placeholder="Description"
              value={description}
              onChange={e=>setDescription(e.target.value)}
            />

            <select
              className="border p-2 w-full mb-4"
              value={assigneeDraft}
              onChange={e=>{
                const next = e.target.value;
                setAssigneeDraft(next);
                if (!next) return;
                setAssignedToIds(prev => prev.includes(next) ? prev : [...prev,next]);
              }}
            >

              <option value="">
                Tag users
              </option>

              {team.map(user=>(
                <option
                  key={user._id}
                  value={user._id}
                >
                  {user.name}
                </option>
              ))}

            </select>

            {assignedToIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {assignedToIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAssignedToIds((prev) => prev.filter((x) => x !== id))}
                    className="px-2 py-1 rounded border text-xs"
                    title="Remove"
                  >
                    {(team.find((u) => u._id === id)?.name ?? id)} ×
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">

              <button
                onClick={createTask}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Create
              </button>

              <button
                onClick={()=>setOpen(false)}
                className="border px-4 py-2 rounded"
              >
                Cancel
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}
