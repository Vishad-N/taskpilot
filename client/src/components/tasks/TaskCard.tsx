"use client";

import { useDraggable } from "@dnd-kit/core";

export default function TaskCard({ task }: any) {

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task._id
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (

    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white border rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition cursor-grab"
    >

      {/* Task title */}
      <h3 className="font-semibold text-sm mb-2">
        {task.title}
      </h3>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3">
        {task.description}
      </p>

      {/* Footer */}
      <div className="flex justify-between items-center">

        {/* Avatar */}
        <div className="flex items-center gap-2">

          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center">

            {task.assignedTo?.name?.charAt(0) || "U"}

          </div>

          <span className="text-xs text-gray-500">
            {task.assignedTo?.name || "Unassigned"}
          </span>

        </div>

        {/* Status */}
        <span className="text-[10px] bg-gray-100 px-2 py-1 rounded">
          {task.status}
        </span>

      </div>

    </div>

  );
}
