import mongoose from "mongoose";

const attendanceCorrectionRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      // Optional: because the user might be requesting to create an entirely missing record
    },
    requestedClockIn: {
      type: Date,
    },
    requestedClockOut: {
      type: Date,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Half Day"],
      default: "Pending",
    },
    isManual: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "AttendanceCorrectionRequest",
  attendanceCorrectionRequestSchema
);
