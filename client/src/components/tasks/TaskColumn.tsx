"use client";

import { useDroppable } from "@dnd-kit/core";
import TaskCard from "./TaskCard";

export default function TaskColumn({ title, tasks, id }: any) {

  const { setNodeRef } = useDroppable({
    id
  });

  return (

    <div
      ref={setNodeRef}
      className="bg-gray-100 p-4 rounded-lg w-80 min-h-[500px]"
    >

      <h2 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-600">
        {title}
      </h2>

      {tasks.map((task:any)=>(
        <TaskCard
          key={task._id}
          task={task}
        />
      ))}

    </div>

  );
}
