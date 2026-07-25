import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "team", "client", "developer"],
      default: "team",
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },

    allowedOrganizations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
      },
    ],

    projectIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },

    avatar: {
      type: String,
    },

    gender: {
      type: String,
      enum: ["male", "female", "not_specified"],
      default: "not_specified",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isAccountFrozen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;