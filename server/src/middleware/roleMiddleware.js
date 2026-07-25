export const allowRoles = (...roles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'developer') {
      return res.status(403).json({
        message: "Access denied for this role"
      });
    }

    next();
  };
};