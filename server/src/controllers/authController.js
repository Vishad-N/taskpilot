import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import {
  getAccessibleOrganizationIds,
  resolveActiveOrganizationId
} from "../utils/organizationScope.js";

const tokenCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
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

/*
=============================
REGISTER USER
=============================
*/
export const registerUser = async (req, res) => {
  try {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "team",
      status: "pending"
    });

    res.status(201).json({
      message: "User registered. Awaiting approval by SuperAdmin."
    });

  } catch (error) {

    console.error("Register error:", error);

    res.status(500).json({
      message: "Registration failed"
    });

  }
};


/*
=============================
LOGIN USER
=============================
*/
export const loginUser = async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const normalizedEmail = email.toLowerCase();

    // 1️⃣ Find user
    const user = await User.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // 2️⃣ Compare password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // 3️⃣ Check approval
    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          "Your account is pending approval from SuperAdmin"
      });
    }

    // 4️⃣ Generate token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        organizationId: user.organizationId
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 5️⃣ Safe user response
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    };

    res
      .cookie("token", token, tokenCookieOptions())
      .json({
      message: "Login successful",
      user: userData
    });

  } catch (error) {

    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed"
    });

  }
};

export const logoutUser = async (_req, res) => {
  clearTokenCookie(res);
  res.json({ message: "Logged out" });
};

export const getMe = async (req, res) => {
  try {
    const organizationIds = await getAccessibleOrganizationIds(req);
    const organizations = organizationIds.length
      ? await Organization.find({ _id: { $in: organizationIds } })
          .select("_id name")
          .sort({ name: 1 })
      : [];

    let activeOrganizationId = null;

    try {
      activeOrganizationId = await resolveActiveOrganizationId(req);
    } catch {
      activeOrganizationId = organizationIds[0] || null;
    }

    res.json({
      user: {
        ...req.user.toObject(),
        organizations,
        activeOrganizationId
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load current user" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, password } = req.body;

    // Gender cannot be changed via profile update — use PATCH /auth/me/gender
    if (req.body.gender !== undefined) {
      return res.status(403).json({ message: "Gender cannot be modified through profile updates" });
    }

    if (name !== undefined) {
      const normalizedName = String(name).trim();

      if (!normalizedName) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }

      user.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();

      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({ message: "Another user already uses this email" });
      }

      user.email = normalizedEmail;
    }

    if (password !== undefined && String(password).trim()) {
      const normalizedPassword = String(password);

      if (normalizedPassword.trim().length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      user.password = await bcrypt.hash(normalizedPassword, 10);
    }

    await user.save();

    const organizationIds = await getAccessibleOrganizationIds({
      ...req,
      user
    });
    const organizations = organizationIds.length
      ? await Organization.find({ _id: { $in: organizationIds } })
          .select("_id name")
          .sort({ name: 1 })
      : [];

    let activeOrganizationId = null;

    try {
      activeOrganizationId = await resolveActiveOrganizationId({
        ...req,
        user
      });
    } catch {
      activeOrganizationId = organizationIds[0] || null;
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        ...user.toObject(),
        organizations,
        activeOrganizationId
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};

export const setMyGender = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { gender } = req.body;

    if (!gender || !["male", "female"].includes(gender)) {
      return res.status(400).json({ message: "Gender must be 'male' or 'female'" });
    }

    if (user.gender !== "not_specified") {
      return res.status(403).json({ message: "Gender has already been set and cannot be changed" });
    }

    user.gender = gender;
    await user.save();

    const organizationIds = await getAccessibleOrganizationIds({ ...req, user });
    const organizations = organizationIds.length
      ? await Organization.find({ _id: { $in: organizationIds } })
          .select("_id name")
          .sort({ name: 1 })
      : [];

    let activeOrganizationId = null;
    try {
      activeOrganizationId = await resolveActiveOrganizationId({ ...req, user });
    } catch {
      activeOrganizationId = organizationIds[0] || null;
    }

    res.json({
      message: "Gender set successfully",
      user: {
        ...user.toObject(),
        organizations,
        activeOrganizationId
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to set gender" });
  }
};
