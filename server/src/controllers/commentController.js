import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import ActivityLog from "../models/ActivityLog.js";

// Add Comment
export const addComment = async (req, res) => {
  try {

    const { taskId, content, isInternal } = req.body;

    // Clients cannot create internal comments
    if (req.user.role === "client" && isInternal) {
      return res.status(403).json({ message: "Clients cannot create internal comments" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const comment = await Comment.create({
      taskId,
      userId: req.user._id,
      content,
      isInternal
    });

    await ActivityLog.create({
      userId: req.user._id,
      action: "comment_added",
      entityType: "comment",
      entityId: comment._id,
      organizationId: req.user.organizationId,
      projectId: task.projectId,
      changes: { taskId }
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Get Task Comments
export const getTaskComments = async (req, res) => {
  try {

    const query = { taskId: req.params.taskId };

    // Client should not see internal comments
    if (req.user.role === "client") {
      query.isInternal = false;
    }

    const comments = await Comment.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 });

    res.json({
      comments
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};