import Notification from "../models/Notification.js";
import { getIO } from "./socketHandler.js";

class NotificationService {
  /**
   * Create a notification and emit a real-time event.
   * @param {Object} data - Notification data
   * @param {string} data.userId - The ID of the user receiving the notification
   * @param {string} data.organizationId - The ID of the organization
   * @param {string} data.title - Title of the notification
   * @param {string} data.message - Main body of the notification
   * @param {string} data.type - One of the predefined enum types
   * @param {string} [data.taskId] - Optional Task ID related to the notification
   */
  static async createNotification(data) {
    try {
      // 1. Save to database
      const notification = await Notification.create({
        userId: data.userId,
        organizationId: data.organizationId,
        title: data.title,
        message: data.message,
        type: data.type,
        taskId: data.taskId,
      });

      // 2. Emit to Socket.IO room "user:<userId>"
      try {
        const io = getIO();
        io.to(`user:${data.userId}`).emit("new_notification", notification);
      } catch (socketError) {
        // Log socket error but don't fail the notification creation
        console.error("Failed to emit socket notification:", socketError);
      }

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
}

export default NotificationService;
