import mongoose from "mongoose";

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    applicableGenders: [
      {
        type: String,
        enum: ["male", "female"],
      },
    ],
    creditsPerYear: { type: Number, default: 0 },
    creditsPerMonth: { type: Number, default: 0 },
    maxCarryForward: { type: Number, default: 0 },
    requiresApproval: { type: Boolean, default: true },
    maxConsecutiveDays: { type: Number, default: 0 }, // 0 = no limit
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

leaveTypeSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export default mongoose.models.LeaveType || mongoose.model("LeaveType", leaveTypeSchema);
