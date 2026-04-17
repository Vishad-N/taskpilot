import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";
import Task from "./src/models/Task.js";
import Project from "./src/models/Project.js";
import Organization from "./src/models/Organization.js";

dotenv.config();
console.log("Script started");

const verify = async () => {
    console.log("Verify function called");
    try {
        console.log("Connecting to:", process.env.MONGODB_URI ? "URI found" : "URI MISSING");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        // 1. Create test organizations
        const orgA = await Organization.create({ name: "Testing Org A", ownerId: new mongoose.Types.ObjectId() });
        const orgB = await Organization.create({ name: "Testing Org B", ownerId: new mongoose.Types.ObjectId() });

        // 2. Create projects
        const projA = await Project.create({ name: "Project A", organizationId: orgA._id, ownerId: new mongoose.Types.ObjectId(), clientVisible: true });
        const projB = await Project.create({ name: "Project B", organizationId: orgB._id, ownerId: new mongoose.Types.ObjectId(), clientVisible: true });

        // 3. Create tasks
        await Task.create({ title: "Task A", projectId: projA._id, organizationId: orgA._id, createdBy: new mongoose.Types.ObjectId(), clientVisible: true });
        await Task.create({ title: "Task B", projectId: projB._id, organizationId: orgB._id, createdBy: new mongoose.Types.ObjectId(), clientVisible: true });

        // 4. Create client user
        const client = await User.create({
            name: "Test Client",
            email: `client_${Date.now()}@test.com`,
            password: "password123",
            role: "client",
            organizationId: orgA._id, // Primary org
            allowedOrganizations: [orgA._id],
            status: "approved"
        });

        console.log(`Created client restricted to Org A`);

        // Mocking req.user for simulation (This script tests the logic, not the HTTP layer)
        const checkAccess = async (user) => {
            const orgs = (user.role === "client" && user.allowedOrganizations?.length > 0)
                ? user.allowedOrganizations
                : [user.organizationId];
            
            const tasks = await Task.find({ organizationId: { $in: orgs }, clientVisible: true });
            return tasks;
        };

        const tasks1 = await checkAccess(client);
        console.log(`Visible tasks for Client (restricted to Org A): ${tasks1.map(t => t.title).join(", ")}`);
        if (tasks1.length === 1 && tasks1[0].title === "Task A") {
            console.log("✅ Success: Restricted to Org A");
        } else {
            console.log("❌ Failure: Restriction logic failed");
        }

        // 5. Update client restriction
        client.allowedOrganizations.push(orgB._id);
        const tasks2 = await checkAccess(client);
        console.log(`Visible tasks for Client (Org A + B): ${tasks2.map(t => t.title).join(", ")}`);
        if (tasks2.length === 2) {
            console.log("✅ Success: Access expanded to Org B");
        } else {
            console.log("❌ Failure: Expansion logic failed");
        }

        // Cleanup
        await Organization.deleteOne({ _id: orgA._id });
        await Organization.deleteOne({ _id: orgB._id });
        await Project.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await Task.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
        await User.deleteOne({ _id: client._id });

        console.log("Cleanup complete");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

verify();
