import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

mongoose.set("bufferCommands", false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const globalForMongoose = globalThis;

if (!globalForMongoose.__taskPilotMongoose) {
  globalForMongoose.__taskPilotMongoose = {
    conn: null,
    promise: null
  };
}

const connectDb = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  const cached = globalForMongoose.__taskPilotMongoose;

  if (cached.conn || mongoose.connection.readyState === 1) {
    cached.conn = cached.conn || mongoose;
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log("Mongo connected");
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
};

export default connectDb;
