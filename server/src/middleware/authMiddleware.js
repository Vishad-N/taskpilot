import jwt from "jsonwebtoken";
import User from "../models/User.js";

const tokenCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/"
  };
};

const clearTokenCookie = (res) => {
  res.clearCookie("token", tokenCookieOptions());
  res.cookie("token", "", {
    ...tokenCookieOptions(),
    expires: new Date(0),
    maxAge: 0
  });
};


const getTokenFromRequest = (req) => {
  // Prefer HttpOnly cookie; fall back to Authorization header for local tooling.
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [, token] = authHeader.split(" ");
  return token || null;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Invalid token user" });
    }

    req.user = user;

    next();

  } catch (error) {
    clearTokenCookie(res);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const protect = async (req, res, next) => {
  return authMiddleware(req, res, next);
};

export default protect;
