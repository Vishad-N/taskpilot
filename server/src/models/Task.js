import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    description: {
      type: String
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // Multi-assignee support (backwards compatible with assignedTo).
    assignedToUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    
    status: {
      type: String,
      enum: ["pending", "inprogress", "review", "completed", "blocked", "rejected", "cancelled"],
      default: "pending"
    },
  
    clientVisible: {
      type: Boolean,
      default: false
    },
    
    priority: {
      type: String,
      enum: ["Urgent", "High", "Normal"],
      default: "Normal"
    },

    startDate: {
      type: Date
    },

    endDate: {
      type: Date
    },

    deadlineDate: {
      type: Date
    },

    dueDate: {
      type: Date
    },

    meetingNotes: [
      {
        meetingDate: {
          type: Date,
          required: true
        },
        title: {
          type: String,
          required: true,
          trim: true
        },
        description: {
          type: String,
          required: true,
          trim: true
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", taskSchema);

export default Task;
