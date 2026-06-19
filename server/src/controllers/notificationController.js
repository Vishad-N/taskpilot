import Notification from "../models/Notification.js";
import { requireActiveOrganizationId } from "../utils/organizationScope.js";

// 🔹 Get user notifications
export const getNotifications = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const notifications = await Notification.find({
      userId: req.user._id,
      organizationId
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ notifications });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};


// 🔹 Mark as read
export const markAsRead = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    const nextValue = typeof req.body?.isRead === "boolean" ? req.body.isRead : true;

    const notification = await Notification.findOneAndUpdate({
      _id: req.params.id,
      userId: req.user._id,
      organizationId
    }, {
      isRead: nextValue
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: nextValue ? "Marked as read" : "Marked as unread" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);

    const result = await Notification.updateMany(
      {
        userId: req.user._id,
        organizationId,
        isRead: false
      },
      {
        isRead: true
      }
    );

    res.json({
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount ?? 0
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const organizationId = await requireActiveOrganizationId(req);
    
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
      organizationId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};
