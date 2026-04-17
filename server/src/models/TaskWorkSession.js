import mongoose from "mongoose";

const taskWorkSessionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    endedAt: {
      type: Date,
      default: null
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    sessionState: {
      type: String,
      enum: ["active", "paused", "stopped"],
      default: "active",
      index: true
    },
    workDate: {
      type: String,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

taskWorkSessionSchema.index(
  { userId: 1, organizationId: 1, sessionState: 1 },
  {
    partialFilterExpression: { sessionState: "active" }
  }
);

const TaskWorkSession = mongoose.model("TaskWorkSession", taskWorkSessionSchema);

export default TaskWorkSession;
