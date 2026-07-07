"use client";

import { useState } from "react";
import api from "@/services/api";

export default function CreateProjectModal({ refresh }: any) {

  const [open,setOpen] = useState(false);
  const [name,setName] = useState("");

  const createProject = async () => {

    if(!name) return;

    await api.post("/projects/create",{
      name
    });

    setName("");
    setOpen(false);

    if(refresh){
      refresh();
    }

  };

  return (

    <>
      <button
        onClick={()=>setOpen(true)}
        className="bg-emerald-600 text-white px-4 py-2 rounded"
      >
        + Create Project
      </button>

      {open && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">

          <div className="bg-white text-black p-6 rounded w-full max-w-md max-h-[90vh] overflow-y-auto">

            <h2 className="text-xl font-bold mb-4">
              Create Project
            </h2>

            <input
              className="border p-2 w-full mb-4"
              placeholder="Project name"
              value={name}
              onChange={(e)=>setName(e.target.value)}
            />

            <div className="flex gap-3">

              <button
                onClick={createProject}
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
