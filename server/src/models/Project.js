import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    description: {
      type: String
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },

    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    status: {
      type: String,
      enum: ["active", "completed", "onhold", "archived"],
      default: "active"
    },

    priority: {
      type: String,
      enum: ["Urgent", "High", "Normal"],
      default: "Normal"
    },

    dueDate: {
      type: Date
    },

    clientVisible: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;