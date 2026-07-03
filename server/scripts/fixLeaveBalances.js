import mongoose from "mongoose";
import dotenv from "dotenv";
import LeaveBalance from "../src/models/LeaveBalance.js";
import LeaveType from "../src/models/LeaveType.js";
import LeaveRequest from "../src/models/LeaveRequest.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB.");

    const year = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); // e.g. 6 for July

    // Find all monthly use-it-or-lose-it leave types (EL and MSL typically)
    const monthlyLeaveTypes = await LeaveType.find({ creditsPerMonth: 1, maxCarryForward: 0 });
    const monthlyTypeIds = monthlyLeaveTypes.map(lt => lt._id.toString());
    
    console.log(`Found ${monthlyTypeIds.length} monthly use-it-or-lose-it leave types.`);

    // Find all balances for these types in the current year
    const balances = await LeaveBalance.find({ 
      year, 
      leaveTypeId: { $in: monthlyTypeIds } 
    });

    for (const balance of balances) {
      // Find how many leaves were taken in the past months (Jan up to last month)
      const requests = await LeaveRequest.find({
        userId: balance.userId,
        leaveTypeId: balance.leaveTypeId,
        status: { $in: ["Approved", "Pending"] },
        year: year
      });

      let pastUsed = 0;
      for (const req of requests) {
        const startMonth = new Date(req.startDate).getMonth();
        const startYear = new Date(req.startDate).getFullYear();
        // If the leave was taken before the current month, count it as a past used leave
        if (startYear === year && startMonth < currentMonthIndex && startMonth >= 0) {
          pastUsed += req.totalDays; // Add the actual days used (e.g. 1)
        }
      }

      // Calculate expired based on the formula: expired = months passed - leaves used in those months
      let expired = currentMonthIndex - pastUsed;
      if (expired < 0) expired = 0; // Just in case

      balance.expired = expired;
      await balance.save();
      console.log(`Updated balance for user ${balance.userId}: expired set to ${expired}`);
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

run();
