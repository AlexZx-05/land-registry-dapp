import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "dev_access_secret_change_me";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Missing access token" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth?.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ message: `Role ${req.auth.role} is not allowed` });
    }

    return next();
  };
}
