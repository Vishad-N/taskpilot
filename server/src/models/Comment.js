import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    content: {
      type: String,
      required: true
    },

    isInternal: {
      type: Boolean,
      default: true
    },

    attachments: [
      {
        key: {
          type: String, // Cloudflare R2 object key
          required: true
        },
        filename: {
          type: String,
          required: true
        },
        fileType: {
          type: String,
          required: true
        },
        size: {
          type: Number, // File size in bytes
          required: true
        }
      }
    ]
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;