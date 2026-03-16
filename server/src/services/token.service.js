import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "dev_access_secret_change_me";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "dev_refresh_secret_change_me";

export function createAccessToken(user) {
  return jwt.sign(
    {
      role: user.role,
      email: user.email,
      name: user.name
    },
    ACCESS_TOKEN_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: "15m"
    }
  );
}

export function createRefreshToken(user) {
  return jwt.sign({}, REFRESH_TOKEN_SECRET, {
    subject: user._id.toString(),
    expiresIn: "7d"
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
