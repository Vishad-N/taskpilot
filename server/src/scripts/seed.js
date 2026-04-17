import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import ActivityLog from "../models/ActivityLog.js";

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI must be set (check server/.env)");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    Notification.deleteMany({}),
    ActivityLog.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash("Aman@1234", 10);

  const org = await Organization.create({
    name: "Simbolo Multimedia",
    description: "",
    ownerId: new mongoose.Types.ObjectId()
  });

  const superadmin = await User.create({
    name: "Aman Manhar",
    email: "amanmanhar2003@gmail.com",
    password: passwordHash,
    role: "superadmin",
    status: "approved",
    isActive: true
  });

  org.ownerId = superadmin._id;
  await org.save();

  console.log("Seed complete.");
  console.log("Login: amanmanhar2003@gmail.com / Aman@1234");
  console.log("OrganizationId:", String(org._id));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
