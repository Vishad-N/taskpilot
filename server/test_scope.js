import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Organization from "./src/models/Organization.js";
import User from "./src/models/User.js";
import { getAccessibleOrganizationIds, resolveActiveOrganizationId } from "./src/utils/organizationScope.js";

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: "amanmanhar2003@gmail.com" });
  console.log("User:", user.email, "Role:", user.role);
  
  const accessible = await getAccessibleOrganizationIds({ user });
  console.log("Accessible Orgs:", accessible);

  try {
    const active = await resolveActiveOrganizationId({ user, headers: {}, query: {}, body: {} });
    console.log("Active Org:", active);
  } catch (err) {
    console.log("Error:", err.message);
  }

  process.exit(0);
}
test();
