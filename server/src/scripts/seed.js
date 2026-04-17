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

  const now = new Date();
  const passwordPlain = "Password123!";
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  // Clean existing data (only these collections)
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    Notification.deleteMany({}),
    ActivityLog.deleteMany({})
  ]);

  const org = await Organization.create({
    name: "Acme Corp",
    description: "Demo organization for TaskPilot",
    ownerId: new mongoose.Types.ObjectId()
  });

  const superadmin = await User.create({
    name: "Super Admin",
    email: "superadmin@taskpilot.dev",
    password: passwordHash,
    role: "superadmin",
    status: "approved",
    isActive: true
  });

  const admin = await User.create({
    name: "Admin User",
    email: "admin@acme.dev",
    password: passwordHash,
    role: "admin",
    organizationId: org._id,
    status: "approved",
    isActive: true
  });

  // Fix org ownerId to the real admin
  org.ownerId = admin._id;
  await org.save();

  const teamA = await User.create({
    name: "Team Member A",
    email: "teama@acme.dev",
    password: passwordHash,
    role: "team",
    organizationId: org._id,
    status: "approved",
    isActive: true
  });

  const teamB = await User.create({
    name: "Team Member B",
    email: "teamb@acme.dev",
    password: passwordHash,
    role: "team",
    organizationId: org._id,
    status: "approved",
    isActive: true
  });

  const client = await User.create({
    name: "Client User",
    email: "client@acme.dev",
    password: passwordHash,
    role: "client",
    organizationId: org._id,
    status: "approved",
    isActive: true
  });

  const projectAlpha = await Project.create({
    name: "Project Alpha",
    description: "Client-visible project",
    ownerId: admin._id,
    organizationId: org._id,
    teamMembers: [teamA._id, teamB._id],
    status: "active",
    priority: "P1",
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    clientVisible: true
  });

  const projectBeta = await Project.create({
    name: "Project Beta",
    description: "Internal-only project (client cannot view)",
    ownerId: admin._id,
    organizationId: org._id,
    teamMembers: [teamA._id],
    status: "active",
    priority: "P2",
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    clientVisible: false
  });

  const task1 = await Task.create({
    title: "Design wireframes",
    description: "Create initial wireframes for dashboard",
    projectId: projectAlpha._id,
    assignedTo: teamA._id,
    createdBy: admin._id,
    organizationId: org._id,
    status: "inprogress",
    clientVisible: true,
    priority: "P1",
    dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
  });

  const task2 = await Task.create({
    title: "Implement API integration",
    description: "Connect frontend to /dashboard and /tasks endpoints",
    projectId: projectAlpha._id,
    assignedTo: teamB._id,
    createdBy: admin._id,
    organizationId: org._id,
    status: "pending",
    clientVisible: true,
    priority: "P1",
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  });

  const task3 = await Task.create({
    title: "Internal refactor",
    description: "Cleanup middleware and add tests",
    projectId: projectBeta._id,
    assignedTo: teamA._id,
    createdBy: admin._id,
    organizationId: org._id,
    status: "review",
    clientVisible: false,
    priority: "P2",
    dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
  });

  await Comment.create([
    {
      taskId: task1._id,
      userId: admin._id,
      content: "Please share progress screenshots when ready.",
      isInternal: false
    },
    {
      taskId: task1._id,
      userId: teamA._id,
      content: "Working on the main dashboard layout now.",
      isInternal: false
    },
    {
      taskId: task3._id,
      userId: admin._id,
      content: "Internal task: keep this private.",
      isInternal: true
    }
  ]);

  await Notification.create([
    {
      userId: teamA._id,
      message: `You have been assigned a new task: ${task1.title}`,
      isRead: false,
      entityType: "task",
      entityId: task1._id,
      organizationId: org._id
    },
    {
      userId: teamB._id,
      message: `You have been assigned a new task: ${task2.title}`,
      isRead: false,
      entityType: "task",
      entityId: task2._id,
      organizationId: org._id
    }
  ]);

  await ActivityLog.create([
    {
      userId: admin._id,
      action: "created a task",
      entityType: "task",
      entityId: task1._id,
      organizationId: org._id,
      projectId: projectAlpha._id,
      changes: { title: task1.title }
    },
    {
      userId: teamA._id,
      action: "moved task to inprogress",
      entityType: "task",
      entityId: task1._id,
      organizationId: org._id,
      projectId: projectAlpha._id,
      changes: { from: "pending", to: "inprogress" }
    }
  ]);

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  admin@acme.dev /", passwordPlain);
  console.log("  teama@acme.dev /", passwordPlain);
  console.log("  teamb@acme.dev /", passwordPlain);
  console.log("  client@acme.dev /", passwordPlain);
  console.log("  superadmin@taskpilot.dev /", passwordPlain);
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

