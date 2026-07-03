import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
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
    attendanceDate: {
      type: String, // Stored as YYYY-MM-DD
      required: true,
    },
    clockIn: {
      type: Date,
    },
    clockOut: {
      type: Date,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    distanceFromOffice: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "Weekly Off", "On Leave"],
      default: "Present",
    },
    corrected: {
      type: Boolean,
      default: false,
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    correctionReason: {
      type: String,
    },
    freezeStatus: {
      type: String,
      enum: ["none", "frozen", "submitted_time", "resolved"],
      default: "none",
    },
    proposedClockOut: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent multiple attendance records for the same user on the same date
attendanceSchema.index({ userId: 1, attendanceDate: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
