import bcrypt from "bcryptjs";
import User, { ALLOWED_ROLES } from "../models/user.model.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyRefreshToken
} from "../services/token.service.js";

const COOKIE_NAME = "refreshToken";
const ROLES_REQUIRING_APPROVAL = ["tehsildar", "sdm", "collector"];

function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });
}

function toUserPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    approvalStatus: user.approvalStatus || "approved"
  };
}

export async function signup(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const assignedRole = role || "buyer";
    const needsApproval = ROLES_REQUIRING_APPROVAL.includes(assignedRole);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      approvalStatus: needsApproval ? "pending" : "approved"
    });

    if (needsApproval) {
      return res.status(202).json({
        pendingApproval: true,
        message: "Account created. Awaiting high-authority approval before first login.",
        user: toUserPayload(user)
      });
    }

    const refreshToken = createRefreshToken(user);
    user.refreshTokenHashes.push(hashRefreshToken(refreshToken));
    await user.save();

    const accessToken = createAccessToken(user);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      accessToken,
      user: toUserPayload(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const approvalStatus = user.approvalStatus || "approved";
    if (approvalStatus === "pending") {
      return res.status(403).json({ message: "Your account is pending high-authority approval." });
    }
    if (approvalStatus === "rejected") {
      return res.status(403).json({ message: "Your account approval request was rejected. Contact administrator." });
    }

    const refreshToken = createRefreshToken(user);
    user.refreshTokenHashes.push(hashRefreshToken(refreshToken));
    await user.save();

    const accessToken = createAccessToken(user);
    setRefreshCookie(res, refreshToken);

    return res.json({
      accessToken,
      user: toUserPayload(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const incomingHash = hashRefreshToken(refreshToken);
    if (!user.refreshTokenHashes.includes(incomingHash)) {
      return res.status(401).json({ message: "Refresh token revoked" });
    }

    user.refreshTokenHashes = user.refreshTokenHashes.filter((hash) => hash !== incomingHash);

    const nextRefreshToken = createRefreshToken(user);
    user.refreshTokenHashes.push(hashRefreshToken(nextRefreshToken));
    await user.save();

    const accessToken = createAccessToken(user);
    setRefreshCookie(res, nextRefreshToken);

    return res.json({
      accessToken,
      user: toUserPayload(user)
    });
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAME];
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.sub);
      if (user) {
        user.refreshTokenHashes = user.refreshTokenHashes.filter((hash) => hash !== tokenHash);
        await user.save();
      }
    }
  } catch (_error) {
    // Ignore logout token parsing errors and clear cookie anyway.
  }

  clearRefreshCookie(res);
  return res.json({ message: "Logged out" });
}

export async function me(req, res) {
  try {
    const user = await User.findById(req.auth.userId).select("-passwordHash -refreshTokenHashes");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user: toUserPayload(user) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listPendingApprovals(req, res) {
  try {
    const users = await User.find({
      role: { $in: ROLES_REQUIRING_APPROVAL },
      approvalStatus: "pending"
    })
      .select("name email role approvalStatus createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function reviewAccountApproval(req, res) {
  try {
    const userId = req.params.userId;
    const { action, remark = "" } = req.body || {};

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be either approve or reject" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!ROLES_REQUIRING_APPROVAL.includes(user.role)) {
      return res.status(400).json({ message: "This role does not require high-authority approval" });
    }

    user.approvalStatus = action === "approve" ? "approved" : "rejected";
    user.approvalRemark = String(remark || "");
    user.approvedBy = req.auth.userId;
    user.approvedAt = new Date();
    if (action === "reject") {
      user.refreshTokenHashes = [];
    }

    await user.save();

    return res.json({
      message: `Account ${action === "approve" ? "approved" : "rejected"} successfully`,
      user: toUserPayload(user)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
