import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use((socket, next) => {
    try {
      // Extract token from cookie headers or auth object
      let token = null;
      if (socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.split('=')[1];
        }
      }

      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`Socket connected for user: ${socket.userId}`);
    
    // Join a room specifically for this user
    socket.join(`user:${socket.userId}`);

    try {
      const connectDb = (await import("./../db.js")).default;
      await connectDb();

      const User = (await import("../models/User.js")).default;
      const user = await User.findById(socket.userId).select("organizationId allowedOrganizations");
      if (user) {
        if (user.organizationId) {
          socket.join(`org:${user.organizationId}`);
        }
        if (user.allowedOrganizations && user.allowedOrganizations.length > 0) {
          user.allowedOrganizations.forEach((orgId) => {
            socket.join(`org:${orgId}`);
          });
        }
      }
    } catch (error) {
      console.error("Error joining organization rooms for socket:", error);
    }

    socket.on("disconnect", () => {
      console.log(`Socket disconnected for user: ${socket.userId}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized");
  }
  return io;
};
